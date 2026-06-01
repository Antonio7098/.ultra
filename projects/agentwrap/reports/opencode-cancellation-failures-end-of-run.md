# OpenCode SDK Lifecycle Patterns: Cancellation, Failures, End-of-Run

## Purpose

This report documents how the OpenCode SDK's Effect-based runtime handles cancellation, failure detection/classification, and run completion, then maps each pattern to the agentwrap adapter at `agentwrap/opencode/runtime.go` with concrete recommendations for closing gaps.

---

## 1. Cancellation

### 1.1 OpenCode's Layered Cancellation

OpenCode has three independent cancellation mechanisms that compose:

**Layer 1 — Runner state machine** (`packages/opencode/src/effect/runner.ts`)

The `Runner<A, E>` (runner.ts:3-9) is a 4-state machine: `Idle`, `Running`, `Shell`, `ShellThenRun`. The `cancel` operation (runner.ts:171-202) transitions any non-Idle state → Idle:

- `Running`: interrupts the fiber (runner.ts:178), fails the deferred with `new Cancelled()` (runner.ts:179), then runs the idle callback (runner.ts:180)
- `Shell`: stops the shell via `stopShell()` which signals `shell.cancelled` deferred + interrupts the shell fiber (runner.ts:108-113)
- `ShellThenRun`: stops the shell AND fails the pending run's deferred (runner.ts:195-197)

The `Cancelled` error is a `Schema.TaggedErrorClass` (runner.ts:11), not a context error. This means cancellation can be caught and handled using `Effect.catchTag("RunnerCancelled", ...)`.

The `complete` helper (runner.ts:59-62) distinguishes between cancellation (interrupt-only cause → `Deferred.fail(new Cancelled())`) and other failures (→ `Deferred.done(exit)`).

**Layer 2 — AbortController per LLM stream** (`packages/opencode/src/session/llm.ts:411`)

Each `streamText()` call gets a dedicated `AbortController`:
```ts
const ctrl = yield* Effect.acquireRelease(
  Effect.sync(() => new AbortController()),
  (ctrl) => Effect.sync(() => ctrl.abort()),
)
```
When the fiber is interrupted, the `AbortController.abort()` is called as a finalizer, cancelling the in-flight HTTP request.

**Layer 3 — `onInterrupt` hooks** (`processor.ts:738-745`, `prompt.ts:1748-1756`)

The processor attaches `Effect.onInterrupt` to the stream processing pipeline:
```ts
Effect.onInterrupt(() => Effect.gen(function* () {
  aborted = true
  if (!ctx.assistantMessage.error) {
    yield* halt(new DOMException("Aborted", "AbortError"))
  }
}))
```

The prompt loop's `finalizeInterruptedAssistant` (prompt.ts:1748-1756) sets `msg.error = MessageV2.fromError(new DOMException("Aborted"))` and marks `time.completed`.

### 1.2 agentwrap's Current Cancellation

**File:** `agentwrap/opencode/runtime.go:192-215`

The adapter has two paths:

- **Explicit `Cancel()`** (runtime.go:192-200): emits lifecycle `cancelled` with reason `caller_cancel`, then calls `cleanup()` which sends SIGTERM → 2s grace → SIGKILL to the process group (`process_unix.go` via `signalProcessGroup`).
- **Context-driven `cancelOnContextDone()`** (runtime.go:207-215): spawned as a goroutine at line 75, watches `r.ctx.Done()`. If the lifecycle is not yet terminal, runs the same SIGTERM/SIGKILL cleanup. This catches timeouts and parent context cancellation.

### 1.3 Gaps and Recommendations

| Gap | OpenCode Reference | Recommendation |
|-----|-------------------|----------------|
| No mid-stream cancellation acknowledgment | `runner.ts:59-62` — the `complete` helper distinguishes interrupt-only causes | After sending SIGTERM, watch for a `cancel` or `abort` ack in the stdout JSON stream. If none arrives within a short window, escalate to SIGKILL. This lets the process produce one final `step_finish` or `error` event before dying. |
| `Cancel()` returns cleanup errors, not the run outcome | `runner.ts:171-202` — cancellation awaits the deferred (runner.ts:179) | Change `Cancel()` to wait for the run goroutine to drain (select on `r.done` with a timeout), so the caller can access the final `RunResult` populated by `finalResult()`. Currently, `Cancel()` emits the lifecycle and cleans up the process, but the `run()` goroutine may still be writing to the events channel. |
| Abort signal not piped to tools | `llm.ts:411` + `AbortSignal` passed to tool exec context | If OpenCode ever exposes a per-tool abort signal in its JSON output, the adapter should propagate it. For now, the process-level SIGTERM is the only signal. |

---

## 2. Failure Detection and Classification

### 2.1 OpenCode's Error Classification

**File:** `packages/opencode/src/session/message-v2.ts:1095-1164`

`fromError()` classifies errors into a tagged union:

| Error Type | Condition | Key Properties |
|-----------|-----------|----------------|
| `AbortedError` | `DOMException("Aborted")` + `ctx.aborted` flag | `{ message }` |
| `AuthError` | `LoadAPIKeyError` | `{ providerID, message }` |
| `APIError` | `APICallError` via `ProviderError.parseAPICallError()` | `{ message, statusCode, isRetryable, responseHeaders, responseBody, metadata }` |
| `ContextOverflowError` | `APICallError` with `context_overflow` type | `{ message, responseBody }` |
| `OutputLengthError` | Direct instance check | native schema |
| `ConnectionReset` | `ECONNRESET` | marked `isRetryable: true` |
| `ZlibError` | Decompression failure | `AbortedError` if aborted, else `APIError` with `isRetryable` |

**Key design choice:** Errors carry rich structured metadata (`statusCode`, `responseHeaders`, `responseBody`), NOT pre-classified booleans. Classification happens downstream in `retryable()`.

**File:** `packages/opencode/src/session/retry.ts:67-151`

`retryable(error, provider)` determines what to do:
- `ContextOverflowError` → `undefined` (never retry; triggers compaction instead)
- `APIError` with 5xx → always retryable
- `APIError` with rate-limit headers/body → retryable with `action` (upsell/link)
- Text-message pattern matching → retryable with message
- Error response JSON parsing → retryable for `too_many_requests`, `exhausted`, `unavailable`
- Everything else → `undefined`

The `Retryable` return type (retry.ts:13-23) carries:
```ts
{ message: string, action?: { reason, provider, title, message, label, link? } }
```

**File:** `packages/opencode/src/session/processor.ts:692-719`

When a non-retryable error occurs, `halt()`:
1. Parses the raw error via `parse(e)` (the configured parser)
2. For context overflow: sets `needsCompaction = true`, publishes `Session.Event.Error`
3. Otherwise: sets `ctx.assistantMessage.error = error`, publishes `Session.Event.Error`, sets status to `idle`
4. The outer `Effect.catch(halt)` at processor.ts:781 converts the error into state mutation + event emission

### 2.2 agentwrap's Current Error Classification

**File:** `agentwrap/opencode/runtime.go:281-385` (`finalResult()`)

The adapter uses a multi-case state machine:
1. Decode error → `classifyContextError` (Canceled/DeadlineExceeded → `ErrorCancellation`/`ErrorTimeout`) or `classifyDecodeError` (→ `ErrorMalformedEvent`)
2. Context error → `classifyContextError` same logic
3. `sawFinal` + good exit → `Completed`
4. `sawFinal` + bad exit → `Completed` if `ErrorRuntimeExit` (tolerated), else `Failed`
5. No final + bad exit → `Failed` with `classifyExitError` (rate-limit or `ErrorRuntimeExit`)
6. No final + zero exit → `Failed` with `ErrorRuntimeExit`

**File:** `agentwrap/opencode/rate_limit.go`

Rate-limit detection operates on:
- Stderr text patterns (`classifyRateLimitText`)
- Native event data (`classifyRateLimitData`, called from `projector.go`)
- Extracts `retryAfter`, `providerID`, `modelID`

### 2.3 Gaps and Recommendations

| Gap | OpenCode Reference | Recommendation |
|-----|-------------------|----------------|
| Lost structured error metadata | `message-v2.ts:1100-1164` — `fromError` preserves `responseHeaders`, `responseBody`, `statusCode` | agentwrap's `SDKError` should carry an `ErrorDetail` struct with `StatusCode`, `ResponseHeaders map[string]string`, `ResponseBody string`. Currently these are flattened into `DebugDetail` strings or lost entirely. |
| No retryable/non-retryable distinction from native events | `retry.ts:67-151` — `retryable()` classifies by error type + content | When the adapter projects a native `error` event, include `is_retryable` and `retry_after` fields from the JSON payload. The `PolicyRunner` should read these from the projected event rather than re-classifying from scratch. |
| `finalResult()` conflates cancellation and timeout at the context level | `prompt.ts:1748-1756` — `finalizeInterruptedAssistant` creates a distinct `AbortedError` | When `context.Canceled` is detected, check if the run emitted a `step_finish` before the cancel. If yes, it's a graceful cancellation (adapter should report `Completed`). If no, it's an interruption (`Cancelled`). This mirrors OpenCode's distinction between a cancelled stream and a completed stream with errors. |
| Exit code classification too coarse | `runtime.go:605-610` — `classifyExitError` checks only rate-limit patterns, everything else is `ErrorRuntimeExit` | Parse OpenCode's final error event from stderr/stdout for additional detail. If the native `error` event carries `{ type: "auth", providerID: "anthropic" }`, classify as `ErrorAuthentication` not `ErrorRuntimeExit`. |

---

## 3. End-of-Run Detection

### 3.1 OpenCode's Completion Detection

**Level 1 — Processor** (`processor.ts:721-789`)

The `process()` function returns one of three outcomes:
- `"compact"` — context overflow detected (processor.ts:785)
- `"stop"` — blocked by denied permission, or `assistantMessage.error` is set (processor.ts:786)
- `"continue"` — normal continuation, tool calls pending (processor.ts:787)

**Level 2 — Prompt Loop** (`prompt.ts:1643-1679`)

The `runLoop()` checks four exit conditions (prompt.ts:1671-1679):
```ts
if (
  lastAssistant?.finish &&                                    // 1. Model explicitly finished
  !["tool-calls"].includes(lastAssistant.finish) &&           // 2. No pending tool calls
  !hasToolCalls &&                                            // 3. No unprocessed tool results
  lastUser.id < lastAssistant.id                              // 4. Assistant responded after last user message
) break
```
Additional exits:
- Structured output captured (prompt.ts:1784)
- Processor result is `"stop"` (wired via `ctx.shouldBreak`)
- Agent max steps reached (prompt.ts:1727-1728)

**Level 3 — Bus Event** (`session/status.ts`)

When the prompt loop finishes, `status.set(sessionID, { type: "idle" })` fires a `session.idle` bus event. The V2 `POST /api/session/:sessionID/wait` endpoint blocks on this event.

**Level 4 — CLI `--format json`** (`cli/cmd/run.ts:611+`)

The CLI event subscription loop reads bus events and emits structured JSON lines. It breaks when `session.status` fires with `type: "idle"`. The last meaningful event before idle is typically `step_finish`.

### 3.2 agentwrap's Current End-of-Run Detection

**File:** `agentwrap/opencode/runtime.go:217-279` (`run()`)

The adapter:
1. Reads JSON lines from stdout (`scanNativeRecords`)
2. Sets `r.sawFinal = true` when `projected.final` is true (runtime.go:245-247) — this is set by `projector.go` when the native event `type` is `step_finish`
3. When the decode loop ends (EOF, error, or context done), calls `proc.Wait()` for the exit code
4. `finalResult()` (runtime.go:281-385) uses `r.sawFinal` as the authoritative indicator:

| `sawFinal` | Exit code | Result |
|------------|-----------|--------|
| `true` | 0 | `Completed` |
| `true` | non-zero | `Completed` (exit tolerated) or `Failed` if classified non-exit error |
| `false` | non-zero | `Failed` |
| `false` | 0 | `Failed` (missing final structured result) |

**File:** `agentwrap/opencode/projector.go`

`projectNative()` maps `step_finish` → `final: true`, which is the adapter's equivalent of OpenCode's `lastAssistant.finish !== undefined`.

### 3.3 Gaps and Recommendations

| Gap | OpenCode Reference | Recommendation |
|-----|-------------------|----------------|
| No trailing-event drain after `step_finish` | `prompt.ts:1643-1679` — the loop exits only when the condition block fires; trailing events (warnings, usage, artifacts) arrive before idle | After seeing `sawFinal`, continue reading stdout for a short grace period (e.g., 500ms) to collect trailing usage/artifact/warning events. Currently, `scanNativeRecords` returns on EOF/immediate error, potentially dropping events between `step_finish` and process exit. |
| No idle-event detection | `session/status.ts` — `session.idle` bus event is the authoritative end-of-run signal | If OpenCode's `--format json` output ever includes a `session.status` event with `type: "idle"`, the adapter should treat that as the definitive end-of-run signal instead of relying on `step_finish` + exit code. Currently, only `step_finish` sets `sawFinal`. |
| `postFinalDecodeWarning` ignores trailing errors | `runtime.go:387-400` — converts decode errors after final into warnings | This is correct behavior but should also preserve any trailing structured data (artifacts, usage) that arrived after the decode error. Currently, the decode loop stops at the first error, so any events after that point are lost. |
| No equivalent of OpenCode's `"stop"` vs `"continue"` distinction | `processor.ts:785-787` — `"stop"` (permission denied / error) vs `"continue"` (normal) | The adapter should distinguish between `Completed` (normal finish, `step_finish` with `continue`) and `Failed` (permission-denied or error-last finish). Currently both are `Completed` as long as `step_finish` was seen. |
| No unstructured-content-after-final detection | `prompt.ts:1664-1678` — the loop checks `hasToolCalls` before deciding to exit | If `step_finish` has `finish === "tool-calls"`, the adapter should NOT treat the run as complete — it should continue reading for follow-up events. Currently, any `step_finish` sets `sawFinal`. |

---

## 4. Summary: Key Patterns to Apply

### Critically Important
1. **Carry structured error metadata through events** — `responseHeaders`, `responseBody`, `statusCode` from native error events, parsed into `SDKError` fields instead of flattened into `DebugDetail`
2. **Grace period after `step_finish`** — drain trailing events before declaring completion
3. **Session-level idle detection** — if a `session.status` idle event arrives via stdout, use it as the definitive run-end

### Nice to Have
4. **Cancellation acknowledgment** — after SIGTERM, wait briefly for an ack event before SIGKILL
5. **Distinguish `"stop"` vs `"continue"` finishes** — `Completed` vs `Failed` based on the finish reason in the native event
6. **Check `finish === "tool-calls"` before declaring `sawFinal`** — the run continues until tool results are processed

### Source Reference Index

| Pattern | OpenCode File | Line | agentwrap File | Lines |
|---------|--------------|------|----------------|-------|
| Runner state machine + cancel | `runner.ts` | 3-9, 171-202 | `opencode/process.go` + `process_unix.go` | 68-95 |
| AbortController per stream | `llm.ts` | 411 | — (process-level only) | — |
| `onInterrupt` hooks | `processor.ts` | 738-745 | — | — |
| `finalizeInterruptedAssistant` | `prompt.ts` | 1748-1756 | — | — |
| Error classification | `message-v2.ts` | 1095-1164 | `opencode/runtime.go` | 593-617 |
| Retryability classification | `retry.ts` | 67-151 | `opencode/rate_limit.go` | full file |
| `halt()` / error event | `processor.ts` | 692-719 | `opencode/projector.go` | (projection) |
| Processor outcome | `processor.ts` | 785-787 | `opencode/runtime.go` | 281-385 |
| Prompt loop exit conditions | `prompt.ts` | 1643-1679 | `opencode/runtime.go` | 217-279 |
| `cancelOnContextDone` | — | — | `opencode/runtime.go` | 207-215 |
| `finalResult()` | — | — | `opencode/runtime.go` | 281-385 |
| `cleanup()` (SIGTERM→SIGKILL) | — | — | `opencode/runtime.go` | 412-423 |
| `sawFinal` tracking | — | — | `opencode/runtime.go` | 245-247, 308-318 |
| Event projection | — | — | `opencode/projector.go` | full file |

---

*Generated from direct source analysis of `studies/opencode-wrap-study/sources/opencode/` (TypeScript) and `agentwrap/` (Go).*
