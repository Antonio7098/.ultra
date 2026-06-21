# Repo Analysis: opencode

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | opencode |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/opencode` |
| Language / Stack | TypeScript/Node.js (Effect framework, AI SDK) |
| Analyzed | 2026-05-17 |

## Summary

opencode implements a sophisticated **constrained autonomy** model where agents operate within configurable permission boundaries. The system defaults to "allow all" but permits granular per-tool, per-agent, and per-directory restriction via a layered ruleset architecture. Human approval is requested through a formal `ask` mechanism with session lineage tracking for auto-accept rules. The philosophy is **AI-first with guardrails** rather than human-first or fully autonomous.

## Rating

**8/10** — Configurable autonomy with clear boundaries and safeguards. Deducted points because: (1) default is "allow all" requiring explicit lock-down rather than default-deny, (2) auto-accept permission uses a simple boolean rather than confidence thresholds, (3) no explicit mechanism for AI confidence-gated autonomy.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Permission rule structure | `Rule` schema with `permission`, `pattern`, `action` fields | `packages/opencode/src/permission/index.ts:22-27` |
| Default permission merge | `Permission.merge(defaults, user)` combining default + user rules | `packages/opencode/src/agent/agent.ts:128-135` |
| Default allow policy | `defaults = Permission.fromConfig({ "*": "allow", ... })` | `packages/opencode/src/agent/agent.ts:100-119` |
| Ask mechanism | `ctx.ask({ permission, patterns, always, metadata })` on Tool.Context | `packages/opencode/src/tool/tool.ts:25` |
| Ask → Deferred await | Permission.ask returns after Deferred.await, blocking agent | `packages/opencode/src/permission/index.ts:190-191` |
| Auto-accept tracking | `autoAccept: Record<string, boolean>` with session+directory key | `packages/app/src/context/permission.tsx:80` |
| Session lineage for auto-accept | `sessionLineage()` walks parent chain for inherited auto-accept | `packages/app/src/context/permission-auto-respond.ts:23-39` |
| Permission reply types | `Reply = "once" | "always" | "reject"` | `packages/opencode/src/permission/index.ts:47-48` |
| DeniedError on rule match | Returns `DeniedError` when rule.action === "deny" | `packages/opencode/src/permission/index.ts:169-172` |
| Task tool permission gate | `yield* ctx.ask({ permission: id, patterns: [params.subagent_type], always: ["*"] })` | `packages/opencode/src/tool/task.ts:46-54` |
| Shell tool permission ask | `yield* ctx.ask({ permission: ShellID.ToolID, patterns: Array.from(scan.patterns) })` | `packages/opencode/src/tool/shell.ts:282-287` |
| Agent mode types | `mode: "subagent" | "primary" | "all"` determines agent scope | `packages/opencode/src/agent/agent.ts:31` |
| Plan agent edit deny | `edit: { "*": "deny", ".opencode/plans/*.md": "allow" }` — plan mode blocks edits | `packages/opencode/src/agent/agent.ts:151-156` |
| Subagent permission derivation | `deriveSubagentSessionPermission()` combines parent agent denies + session rules | `packages/opencode/src/agent/subagent-permissions.ts:17-33` |
| External directory permission | `external_directory` permission key with glob patterns | `packages/opencode/src/tool/external-directory.ts:36` |
| Permission evaluate fallback | Returns `{ action: "ask", permission, pattern: "*" }` when no rule matches | `packages/opencode/src/permission/evaluate.ts:14` |
| Permission HTTP API | `POST /permission/:requestID/reply` with `{ reply, message? }` payload | `packages/opencode/src/server/routes/instance/httpapi/groups/permission.ts:30-42` |
| Auto-accept on permission: allow | When `permission: "allow"`, directory auto-accept is enabled automatically | `packages/app/src/context/permission.tsx:91-99` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Constrained autonomy (bounded choices)** with a default of "allow everything". opencode sits between "guided autonomy" and "fully autonomous" — the agent can act independently within permission boundaries, but those boundaries are configurable and checked per-tool-call.

Evidence: Default ruleset `Permission.fromConfig({ "*": "allow", doom_loop: "ask", ... })` at `packages/opencode/src/agent/agent.ts:100-119`. The `ask` action is the exception (for `doom_loop`, `external_directory`, `*.env` reads), not the default.

### 2. Is autonomy configurable per workflow or agent?

**Yes** — autonomy is configurable at multiple levels:
- **Global permission** in config: `permission: { "*": "allow" }` or stricter
- **Per-agent permission** overrides: `agent.build.permission: { bash: "deny" }`
- **Per-directory auto-accept** toggle (UI)
- **Per-session auto-accept** toggle (UI)

Evidence: `AgentSchema` with `permission: Schema.optional(ConfigPermission.Info)` at `packages/opencode/src/config/agent.ts:48`. Agent definitions merge defaults with user config at `packages/opencode/src/agent/agent.ts:128-135`.

### 3. What decisions are reserved for humans?

The `ask` action requires human input. The following trigger permission requests:
- `doom_loop` — loop detection, always asks
- `external_directory` — accessing dirs outside workspace, always asks by default
- `*.env` files — sensitive data, always asks
- `task` tool — spawning subagents, asks via `ctx.ask()` at `packages/opencode/src/tool/task.ts:46-54`
- `shell` tool — executing commands, asks at `packages/opencode/src/tool/shell.ts:282-287`
- `edit` tool in plan mode — blocked entirely (deny)

Humans can "always allow" specific patterns to grant permanent autonomy for those cases.

### 4. What is the default when AI confidence is low?

**No explicit confidence-gated autonomy.** opencode does not assess AI confidence before deciding to act. If a tool call is `allow` by permission rules, the agent proceeds without a confidence check. There is no fallback to "ask" when model confidence is below a threshold.

The "low confidence" case is handled indirectly: if the permission rules say "ask", the agent asks. But this is a static rule, not a dynamic confidence signal.

### 5. How is appropriate autonomy level determined?

**By configuration precedence:**
1. Hardcoded defaults (allow-all with doom_loop ask)
2. User global config (`permission: {...}`)
3. Per-agent config (`agent.<name>.permission: {...}`)
4. Runtime auto-accept toggles (session + directory level)

Evidence: `Permission.merge()` at `packages/opencode/src/agent/agent.ts:128-135` applies merges left-to-right with later entries winning.

### 6. What safeguards exist against autonomous mistakes?

1. **Permission ruleset** with allow/ask/deny actions checked before every tool execution
2. **Session lineage auto-accept** — auto-accept only applies within the session tree that enabled it, preventing cross-session propagation
3. **Reject cascade** — when a permission is rejected, all pending permissions for that session are also rejected (`packages/opencode/src/permission/index.ts:210-226`)
4. **Always patterns** — only patterns listed in `always` are permanently approved; others are one-shot
5. **Plan mode** — explicit edit-blocking agent mode with deny rules on all edit tools

### 7. How does the system handle edge cases?

- **Tool not in ruleset**: `evaluate()` returns `{ action: "ask", permission, pattern: "*" }` as default fallback (`packages/opencode/src/permission/evaluate.ts:14`)
- **Missing session for auto-accept**: `autoRespondsPermission()` returns `false` when no match found (`packages/app/src/context/permission-auto-respond.ts:50`)
- **Parent session gone**: `sessionLineage()` handles missing parents gracefully with `seen` set check (`packages/app/src/context/permission-auto-respond.ts:28-36`)
- **Rejected permission**: `RejectedError` or `CorrectedError` with user feedback propagates to the agent loop

### 8. What is the philosophy: "AI-first" or "human-first"?

**AI-first with configurable guardrails.** The default is to let the AI act, with guardrails that can be raised. This differs from "human-first" where everything requires approval by default.

Evidence: Default `Permission.fromConfig({ "*": "allow" })` at `packages/opencode/src/agent/agent.ts:100`. The prompt at `packages/opencode/src/session/prompt/codex.txt:49` says "Never ask permission questions like 'Should I proceed?'; proceed with the most reasonable option."

## Architectural Decisions

### Permission as a ruleset, not a binary flag
Rather than a simple on/off, permissions are a list of rules with `<permission, pattern, action>` triples. Pattern supports globs (`*.env`) and the wildcard `*`. This allows file-type-specific rules (ask for `*.env`, allow everything else).

### Ask is blocking via Deferred
When `Permission.ask()` is called, it publishes an event and then awaits a `Deferred`. The agent loop blocks at that point (`packages/opencode/src/permission/index.ts:190-191`). This is synchronous from the agent's perspective — it cannot continue until the user responds.

### Auto-accept is boolean, not probabilistic
Auto-accept is a simple boolean keyed by session ID + optional directory. No confidence thresholds or adaptive behavior. A user enabling auto-accept says "trust this session for patterns I've approved" — it's an all-or-nothing toggle.

### Subagent permissions inherit parent constraints
When spawning a subagent via the `task` tool, `deriveSubagentSessionPermission()` combines:
1. Parent agent's edit deny rules (to prevent plan mode bypass)
2. Parent session's deny rules and external_directory rules
3. Subagent's own rules plus defaults

This prevents a subagent from having more autonomy than its parent would have.

### Agent mode as a first-class concept
The `mode: "subagent" | "primary" | "all"` field distinguishes agents that can be used as main agents vs. only as subagents. The `build` agent is `mode: "primary"`, while `explore` and `general` are `mode: "subagent"`. Custom agents default to `mode: "all"`.

## Notable Patterns

### Permission evaluation uses last-match-wins
`rules.findLast()` at `packages/opencode/src/permission/evaluate.ts:11` means more specific rules take precedence over general ones, since later rules in the merged array override earlier ones.

### Tool execution wrapped in truncate + permission check
Every tool goes through: (1) schema validation, (2) execute, (3) truncate output, (4) auto-disable based on permission rules. The `disabled()` function at `packages/opencode/src/permission/index.ts:293-302` computes which tools are disabled for a given ruleset.

### Permission events published to bus
`Event.Asked` and `Event.Replied` are published via the Bus system (`packages/opencode/src/permission/index.ts:64-73`), allowing the UI to subscribe and display permission dialogs without the backend knowing about the UI.

### Always-allow patterns for trusted directories
`readonlyExternalDirectory` at `packages/opencode/src/agent/agent.ts:95-98` sets `"*": "ask"` for everything but whitelisted dirs (tmp, skill dirs) get `"allow"`. This allows read-only tools on trusted paths without prompting.

## Tradeoffs

### Default-allow vs. default-deny
opencode defaults to allow-all, requiring explicit configuration to lock down. This is easier for new users but less secure by default. A misconfigured permission still allows dangerous tools.

### Boolean auto-accept vs. per-decision trust
Auto-accept is all-or-nothing per session. There's no way to say "auto-accept for 5 minutes but then re-prompt." The TTL on `responded` map (`packages/app/src/context/permission.tsx:104`) is only for rate-limiting the UI's tracking, not the actual auto-accept window.

### No AI confidence gating
The system doesn't have a mechanism for "if confidence < X, ask anyway." It relies entirely on static permission rules, which means a highly uncertain response can still proceed if the rules allow it.

### Blocking ask model
`ctx.ask()` blocks the agent loop synchronously via `Deferred.await()`. For long-running tasks, this means the agent cannot do other work while waiting for user input. An alternative would be to let the agent continue and handle the response asynchronously.

## Failure Modes / Edge Cases

1. **Permission rule conflict**: If a user sets `"*": "allow"` globally and `"bash": "deny"` per-agent, the merge order determines the outcome. The `findLast` pattern means the more specific rule wins, but this requires understanding of array ordering.

2. **Auto-accept without session context**: If a directory-level auto-accept is enabled but the session lineage doesn't include the enabling session (e.g., session was restarted), auto-accept won't apply.

3. **Subagent permission derivation gap**: `deriveSubagentSessionPermission()` only considers the immediate parent's agent deny rules for `edit`. If a grandparent agent had a deny rule, it wouldn't be forwarded unless the parent also has it.

4. **No permission timeout**: If a user never responds to an ask, the pending permission stays in the map indefinitely (until app shutdown finalizer cleans it up at `packages/opencode/src/permission/index.ts:148-155`).

5. **Tool disabled doesn't mean blocked**: `disabled()` at `packages/opencode/src/permission/index.ts:293-302` marks tools as disabled, but the agent can still attempt to call them and get a `DeniedError`. The UI uses this to hide tools, but the agent loop still has to handle the error.

## Future Considerations

1. **Confidence-gated ask**: Add an optional `confidenceThreshold` to permission rules — if model confidence is below the threshold, treat the rule as `ask` even if it would normally be `allow`.

2. **Timed auto-accept**: Add expiration to auto-accept rules so that "always" permissions can be temporary.

3. **Hierarchical permission inheritance**: Instead of just parent session + parent agent, consider a full hierarchy where permissions cascade down through nested subagents.

4. **Async ask model**: Allow the agent to continue working while waiting for a permission, handling the response when it arrives. This would require a non-blocking ask mechanism.

## Questions / Gaps

1. **How is appropriate autonomy level determined for first-time users?** The default allow-all means a new user must actively configure restrictions. Is there guidance toward a secure baseline?

2. **Does the system log permission denials for audit?** There's no evidence of an audit log for permission decisions — only the pending map for active requests.

3. **What happens when multiple sessions have conflicting auto-accept settings for the same directory?** The `isAutoAcceptingDirectory` check at `packages/app/src/context/permission.tsx:146-148` only checks the directory-level key, ignoring per-session settings.

4. **Is there a way to temporarily elevate autonomy for a specific task without permanently changing the ruleset?** No such mechanism found — elevation would require modifying the config.

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `opencode`.