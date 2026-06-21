# Repo Analysis: openhands

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | openhands |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/openhands` |
| Language / Stack | Python (SDK), React (Frontend) |
| Analyzed | 2026-05-17 |

## Summary

OpenHands implements a **hybrid autonomy model** with configurable confirmation policies. The system default is `NeverConfirm` (fully autonomous), but users can enable `confirm_risky` or `always_confirm` modes. The autonomy is adjustable per-conversation via `confirmation_mode` and per-subagent via `permission_mode`. The system trusts the agent significantly — HIGH risk actions still execute unless confirmation mode is explicitly enabled.

## Rating

**6/10** — Basic autonomy levels with limited configurability. The system lacks per-workflow autonomy configuration at the agent level (only conversation-level and subagent-level exist), and the default behavior is fully autonomous without safeguards. The trust model leans "AI-first" by default.

## Evidence Collected

| Area | Evidence | File:Line |
|------|----------|-----------|
| Confirmation Policies | `AlwaysConfirm`, `NeverConfirm`, `ConfirmRisky` with configurable threshold | `openhands/sdk/security/confirmation_policy.py:27-61` |
| Security Risk Levels | `SecurityRisk` enum with LOW, MEDIUM, HIGH, UNKNOWN and comparator logic | `openhands/sdk/security/risk.py:13-100` |
| Default Confirmation Policy | `NeverConfirm()` as system default | `openhands/sdk/conversation/state.py:121` |
| Confirmation Check Logic | `_requires_user_confirmation()` checks risk against policy | `openhands/sdk/agent/agent.py:605-646` |
| Conversation Settings | `confirmation_mode: bool` default `false` | `openhands/sdk/settings/model.py:521-523` |
| Subagent Permission Mode | `permission_mode: str` with 'always_confirm', 'never_confirm', 'confirm_risky' | `openhands/sdk/subagent/schema.py:34-38,183-188` |
| Security Analyzer | `LLMSecurityAnalyzer`, `PatternSecurityAnalyzer`, `PolicyRailSecurityAnalyzer` | `openhands/sdk/security/llm_analyzer.py:10-29` |
| Hook System | `PreToolUse`, `UserPromptSubmit` hooks can block actions | `openhands/sdk/hooks/types.py:9-40` |
| WAITING_FOR_CONFIRMATION State | Execution pauses when confirmation required | `openhands/sdk/conversation/state.py:52-54` |
| Confirmation Policy Building | `_build_confirmation_policy()` converts settings to policy | `openhands/sdk/settings/model.py:567-578` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Semi-autonomous to Fully autonomous** — default is `NeverConfirm` which means the agent executes all actions without user confirmation. The system is AI-first by default.

Evidence: `openhands/sdk/conversation/state.py:121` — `confirmation_policy: ConfirmationPolicyBase = NeverConfirm()` is the default.

### 2. Is autonomy configurable per workflow or agent?

**Yes, per conversation and per subagent** — not per individual workflow/task.

- **Conversation level**: `ConversationSettings.confirmation_mode` (bool) and `security_analyzer` settings
- **Subagent level**: `AgentDefinition.permission_mode` with three modes: 'always_confirm', 'never_confirm', 'confirm_risky'

Evidence: `openhands/sdk/settings/model.py:521-523` for conversation, `openhands/sdk/subagent/schema.py:183-188` for subagents.

### 3. What decisions are reserved for humans?

**HIGH risk actions require confirmation if confirmation mode is enabled** — but by default (NeverConfirm), even HIGH risk actions execute without user input.

The system does NOT reserve specific decision types for humans. Instead, it offers configurable confirmation based on risk levels.

Evidence: `openhands/sdk/security/confirmation_policy.py:43-61` — `ConfirmRisky` only confirms if `risk.is_riskier(self.threshold)` returns True.

### 4. What is the default when AI confidence is low?

**No explicit confidence metric exists** — the system uses security risk levels (LOW, MEDIUM, HIGH, UNKNOWN) rather than AI confidence scores.

When `security_analyzer` is not configured and `confirmation_mode` is `false`, UNKNOWN risk actions execute without confirmation (`openhands/sdk/security/analyzer.py:75-77`).

### 5. How is appropriate autonomy level determined?

**Through confirmation policy configuration** — either:
1. `NeverConfirm()` — no confirmation, full autonomy
2. `ConfirmRisky(threshold=SecurityRisk.HIGH)` — confirm only HIGH risk actions (default when confirmation enabled)
3. `AlwaysConfirm()` — confirm all actions

The policy is set at conversation creation time via `ConversationSettings._build_confirmation_policy()` (`openhands/sdk/settings/model.py:567-578`).

### 6. What safeguards exist against autonomous mistakes?

**Multi-layered security architecture**:

1. **LLMSecurityAnalyzer** (`openhands/sdk/security/llm_analyzer.py:10-29`) — LLM-provided risk assessment
2. **PatternSecurityAnalyzer** (`openhands/sdk/security/defense_in_depth/pattern.py:140-244`) — Regex-based detection of dangerous patterns (rm -rf, curl|bash, eval, etc.)
3. **PolicyRailSecurityAnalyzer** (`openhands/sdk/security/defense_in_depth/policy_rails.py:148-185`) — Deterministic rules for composed threats (fetch-to-exec, raw-disk-op, catastrophic-delete)
4. **Hook System** (`openhands/sdk/hooks/types.py:9-40`) — PreToolUse hooks can block actions via `blocked_actions` dict

However, these are **opt-in** by default. The system defaults to `NeverConfirm()`.

### 7. How does the system handle edge cases?

- **Single FinishAction or ThinkAction** never requires confirmation (`openhands/sdk/agent/agent.py:617-621`)
- **Empty action lists** bypass confirmation (`openhands/sdk/agent/agent.py:623-625`)
- **Hook-blocked actions** emit `UserRejectObservation` and skip execution (`openhands/sdk/agent/agent.py:188-204`)
- **LLM malformed responses** trigger corrective feedback (`openhands/sdk/agent/response_dispatch.py:283-308`)

### 8. What is the philosophy: "AI-first" or "human-first"?

**AI-first by default** — the system defaults to `NeverConfirm()` with no security analyzer. Humans must explicitly opt-in to confirmation mode and security analyzers.

The explicit design choice in `_build_confirmation_policy()` (`openhands/sdk/settings/model.py:574-578`):
```python
if not self.confirmation_mode:
    return NeverConfirm()
if (self.security_analyzer or "").lower() == "llm":
    return ConfirmRisky()
return AlwaysConfirm()
```

## Architectural Decisions

| Decision | Rationale | Evidence |
|----------|-----------|----------|
| Default to NeverConfirm | User experience priority —，不想打断流程 | `openhands/sdk/conversation/state.py:121` |
| Risk-based confirmation thresholds | Separates risk assessment from confirmation policy | `openhands/sdk/security/confirmation_policy.py:43-61` |
| Subagent permission inheritance | Parent policy can be overridden by subagent | `openhands/sdk/subagent/schema.py:211-237` |
| Security analyzer pluggability | Multiple analyzers can be composed in ensemble | `openhands/sdk/security/ensemble.py` |
| Hook-based action blocking | Deterministic control via external scripts | `openhands/sdk/hooks/config.py:129-152` |

## Notable Patterns

1. **Confirmation Policy Discriminated Union** (`openhands/sdk/security/confirmation_policy.py:9-26`) — Uses Pydantic `DiscriminatedUnionMixin` for type-safe policy selection

2. **Risk-based Action Validation** (`openhands/sdk/agent/agent.py:828-833`) — Security risk is extracted from action arguments, not computed independently

3. **Pending Action Queue** (`openhands/sdk/agent/agent.py:483-492`) — Actions wait for confirmation before execution; `get_unmatched_actions()` identifies pending actions

4. **State Machine Execution** (`openhands/sdk/conversation/state.py:46-77`) — `ConversationExecutionStatus` enum controls flow: IDLE → RUNNING → WAITING_FOR_CONFIRMATION → FINISHED

5. **Multi-analyzer Ensemble** — Pattern + PolicyRail analyzers can be composed for defense-in-depth

## Tradeoffs

| Tradeoff | Description |
|----------|-------------|
| Security vs. UX | Default `NeverConfirm` optimizes for speed; enables security via explicit configuration |
| Simplicity vs. Control | Confirmation modes (always/never/confirm_risky) are coarse-grained; no fine-grained per-action-type control |
| Flexibility vs. Safety | `NeverConfirm` default trusts agent completely; assumes LLM-provided security_risk is trustworthy |
| Hook complexity | Hook system provides deterministic control but requires external script management |

## Failure Modes / Edge Cases

1. **No security analyzer default** — Without explicit configuration, `LLMSecurityAnalyzer` is not used, and UNKNOWN risk defaults to execution with `NeverConfirm`

2. **Subagent permission inheritance** — When `permission_mode` is `None`, subagent inherits parent policy — may lead to unexpected behavior if parent policy is misconfigured

3. **Hook blocking without fallback** — If PreToolUse hook blocks an action, no automatic retry mechanism exists; action is replaced with `UserRejectObservation`

4. **Risk level trust** — `LLMSecurityAnalyzer` trusts the LLM to provide accurate `security_risk` values; no validation of risk level correctness

5. **Confirmation mode deprecation** — `VerificationSettings.confirmation_mode` is deprecated in favor of `ConversationSettings.confirmation_mode` (`openhands/sdk/settings/model.py:233-276`) — migration required

## Future Considerations

1. **Per-workflow autonomy configuration** — Currently only conversation-level and subagent-level; no per-task/per-workflow autonomy settings

2. **AI confidence integration** — No confidence score mechanism beyond security risk levels

3. **Human escalation triggers** — No automatic escalation to human based on repeated failures or certain risk thresholds

4. **Confirmation timeout** — No timeout mechanism if user fails to respond to confirmation prompt

5. **Audit trail** — Security analyzer decisions and confirmation events could benefit from stronger audit logging

## Questions / Gaps

1. **No evidence found** for automatic retry on HIGH risk actions when confirmation is declined — what happens after user rejects?

2. **No evidence found** for grace period or soft confirmation before blocking — system either confirms or doesn't

3. **Limited evidence** of default security analyzer in OpenHands server (vs. SDK) — analysis focused on SDK

4. **No evidence found** for user notification when security analyzer detects risky action but policy is `NeverConfirm`

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `openhands`.