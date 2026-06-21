# Repo Analysis: temporal

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | temporal |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/temporal` |
| Language / Stack | Go |
| Analyzed | 2026-05-17 |

## Summary

Temporal implements a deterministic event-sourcing workflow engine where all workflow decisions are derived from history events. The system provides human intervention through signal-based and update-based mechanisms, but does not use AI for decisions — every decision is deterministic and replayable. Autonomy is bounded by configuration limits (activity counts, payload sizes, timeouts) rather than learned models. The architecture prioritizes determinism and verifiability over autonomous decision-making.

## Rating

6/10 — Configurable autonomy with clear deterministic boundaries, but no dynamic autonomy model per workflow. Human approval is signal-based rather than structured approval gates.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Workflow task state machine | `ApplyWorkflowTaskScheduledEvent`, `ApplyWorkflowTaskStartedEvent` deterministic processing | `service/history/workflow/workflow_task_state_machine.go:62-107, 169-260` |
| Workflow task failure handling | `failWorkflowTask` with retry backoff (min 3 attempts, 5s initial interval) | `service/history/workflow/workflow_task_state_machine.go:1020-1068` |
| Signal-based human input | `listenToSignals` for external signals (ForceCANSignal, SyncVersionSummarySignal) | `service/worker/workerdeployment/workflow.go:99-138` |
| Signal receive pattern | `workflow.GetSignalChannel(ctx, "wait").Receive(ctx, nil)` blocking waits | `tests/versioning_test.go:1818, 2315, 2573, 2718, 2729` |
| Update state machine | `WaitLifecycleStage` for ACCEPTED, COMPLETED stages | `service/history/workflow/update/update.go:142-200` |
| Update state definitions | `stateCreated` -> `stateAdmitted` -> `stateAccepted` -> `stateCompleted` | `service/history/workflow/update/state.go:12-25` |
| Dynamic config limits | `BlobSizeLimitError` (2MB), `HistorySizeLimitError` (50MB), `MutableStateSizeLimitError` (8MB) | `common/dynamicconfig/constants.go:326-427` |
| Pending operation limits | `NumPendingActivitiesLimitError` (2000), `NumPendingChildExecutionsLimitError` (2000) | `common/dynamicconfig/constants.go:346-369` |
| Update validators | `SetUpdateHandlerWithOptions` with Validator functions for `validateCreateWorkerDeployment`, `validateSetCurrent` | `service/worker/workerdeployment/workflow.go:298-377` |
| Command validation | `ValidateCommandSequence` ensures valid command ordering | `service/history/api/respondworkflowtaskcompleted/workflow_task_completed_handler.go:173-177` |
| Activity schedule validation | `ValidateActivityScheduleAttributes` with size limit checks | `service/history/api/respondworkflowtaskcompleted/workflow_task_completed_handler.go:483-494` |
| Replay logger | `IsReplaying` checks for consistency between live and replayed execution | `common/log/replay_logger.go:33-75` |
| Workflow rebuilder | `rebuild` reconstructs workflow state for deterministic replay | `service/history/workflow_rebuilder.go:64-104` |
| CHASM Engine | Deterministic interface with `TransitionOptions.Speculative` flag for non-deterministic updates | `chasm/engine.go:16-89` |
| Command payload validation | Length validations for service/operation names, duration validations for timeouts | `chasm/lib/workflow/nexus_commands.go:100-149` |
| FailWorkflowTaskError | Error type for workflow task failures with `TerminateWorkflow` flag | `chasm/lib/workflow/registry.go:103-131` |
| History event validation | `Validate` checks activity info, timers, child workflows, signal/request cancellations | `service/worker/scanner/executions/mutable_state_validator.go:51-232` |
| Update message validation | `validateRequestMsgPrefix`, `validateAcceptanceMsg`, `validateResponseMsg` | `service/history/workflow/update/validation.go:43-78` |

## Answers to Protocol Questions

1. **Where on the autonomy spectrum does the system sit?**
   Fully deterministic (all decisions coded). Workflows process history events and execute commands based on deterministic state machines. No AI or ML-based decisions.

2. **Is autonomy configurable per workflow or agent?**
   Limited configurability. Dynamic config (`common/dynamicconfig/constants.go:326-427`) provides global limits (activity counts, payload sizes, timeouts) but does not expose per-workflow autonomy levels. Workers have no autonomy configuration.

3. **What decisions are reserved for humans?**
   Humans provide input via signals (external triggers) and updates (typed interactions with lifecycle stages). The system does not have structured approval gates — human decisions are event-based signals the workflow chooses to wait for.

4. **What is the default when AI confidence is low?**
   N/A — no AI decisions. For workflow task failures, the default is retry with backoff (`workflow_task_state_machine.go:1046`) up to `workflowTaskRetryBackoffMinAttempts = 3` before failing the task.

5. **How is appropriate autonomy level determined?**
   Not applicable. Autonomy level is not a configurable concept; the system is fully deterministic by design.

6. **What safeguards exist against autonomous mistakes?**
   - Command validation at `workflow_task_completed_handler.go:173-177`
   - Size limits and pending operation limits at `constants.go:346-369`
   - Deterministic replay verification via `replay_logger.go:33-75`
   - `FailWorkflowTaskError` with `TerminateWorkflow` flag at `registry.go:103-121`

7. **How does the system handle edge cases?**
   - Non-deterministic behavior detected via replay mismatch
   - Workflow rebuild mechanism at `workflow_rebuilder.go:64-104`
   - Sticky worker cleanup and speculative transitions (CHASM Engine)
   - Hard limits prevent unbounded growth (2000 pending activities, 8MB mutable state)

8. **What is the philosophy: "AI-first" or "human-first"?**
   Neither — the philosophy is "determinism-first". The system is event-sourcing based with every decision traceable to history events. Humans provide input but do not approve individual decisions.

## Architectural Decisions

- **Event sourcing**: All workflow state derived from history events; no mutable state outside event log.
- **Deterministic replay**: Every workflow execution can be replayed to verify correctness.
- **State machine-based command processing**: Commands processed through deterministic state transitions (`workflow_task_state_machine.go`).
- **Signal-based human input**: Humans inject decisions via signals, not structured approvals.
- **Dual-path execution**: CHASM (new engine) and HSM handlers share protocol routing at `workflow_task_completed_handler.go:341-362`.

## Notable Patterns

- **Event sourcing with deterministic replay**: Every workflow execution can be reconstructed from history.
- **Sticky execution**: Workers cache workflow state for performance, with sticky timeout cleanup.
- **Update protocol with lifecycle stages**: Typed updates with admission, acceptance, and completion stages.
- **Validation-layered command processing**: Commands validated before processing at multiple layers.
- **Speculative transitions in CHASM**: New engine supports non-deterministic speculative updates with rollback.

## Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| Deterministic only | Cannot leverage learned policies or adaptive behavior; every path must be explicitly coded |
| Signal-based human input | No structured approval flow; human decisions are implicit in signal data |
| Global config limits | Cannot customize limits per workflow type or namespace without restart |
| Replay verification | Guarantees correctness but adds latency and storage overhead |

## Failure Modes / Edge Cases

- **Non-deterministic workflow code**: Causes replay divergence, leading to ` workflowTaskFailedError` at `workflow_task_state_machine.go:1020-1068`
- **Sticky worker crash**: Workflow rebuilds from history, potentially re-executing completed activities (mitigated by `workflowTaskRetryBackoffMinAttempts`)
- **Oversized payloads**: Caught by size limit validation at `constants.go:326-327`, terminates workflow
- **Unbounded pending operations**: Limited by `NumPendingActivitiesLimitError` (2000) at `constants.go:352`
- **Update protocol race conditions**: `stateProvisionallyAdmitted` / `stateProvisionallyAccepted` states handle concurrent protocol messages

## Future Considerations

- Per-workflow autonomy configuration (currently global only)
- Structured approval gates beyond signal-based input
- Adaptive timeout/retry policies based on workflow history
- Visibility into speculative transition candidates for human guidance

## Questions / Gaps

- No evidence of runtime autonomy level adjustment per workflow
- No structured human approval workflow beyond signals
- No mechanism for human to review/delay pending autonomous decisions
- Default retry policy is static (3 attempts, 5s backoff) — not configurable per workflow

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `temporal`.