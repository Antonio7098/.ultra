# Repo Analysis: opa

## Philosophy of Autonomy Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | opa |
| Path | `/home/antonioborgerees/coding/ai-agent-examples/repos/opa` |
| Language / Stack | Go (Policy Engine) |
| Analyzed | 2026-05-17 |

## Summary

OPA (Open Policy Agent) is a purely deterministic policy engine with no AI/ML components. The "autonomy" in OPA refers to the degree to which policy evaluation can operate independently without human intervention. OPA takes a fundamentally **human-first, policy-as-code approach**: humans write policies in Rego, and OPA executes them deterministically. There is no configurable autonomy per workflow—behavior is defined entirely by human-authored policies.

## Rating

**4/10** — Basic autonomy levels but no configuration

OPA has a clear, well-defined execution model (deterministic evaluation), but it does not offer configurable autonomy levels. The engine isFixed at "fully deterministic." This rating reflects that OPA has a coherent philosophy (human-first, policy-as-code) but lacks the per-workflow configurability, verification layers, and graceful degradation that would earn a higher score (7-10).

**Fast heuristic**: "Does the system trust the agent more than it should?" — No. OPA does not use AI agents at all. The engine is trusted to faithfully execute human-authored policy code, nothing more.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Deterministic evaluation | No AI/ML targeting in eval struct | `topdown/eval.go:76-131` |
| Deterministic evaluation | Seed-based PRNG for reproducibility | `topdown/builtins.go:71-88` |
| Deterministic evaluation | Nondeterministic flag only for specific builtins | `ast/builtins.go:3608` |
| Human-first philosophy | Keywords define language boundary (no AI-style keywords) | `ast/policy.go:99-142` |
| Human-first philosophy | Default deny principle | `config/config.go:401-403` |
| Human decision boundary | Policy writing (rego code) is human-owned | `ast/policy.go:19-77` |
| Machine decision boundary | Policy evaluation is machine-owned | `topdown/eval.go` |
| Safeguards | Strict builtin error mode | `topdown/query.go:268-270` |
| Safeguards | Unsafe builtins check in compiler | `ast/compile.go:254` |
| Safeguards | Capabilities system for feature control | `ast/capabilities.go:82-101` |
| Safeguards | Signed bundle verification | `bundle/` |
| Edge case handling | Default rule values provide fallback | `ast/policy.go` |
| Edge case handling | Undefined propagation returns nil | `topdown/eval.go:1037-1039` |
| Edge case handling | Deterministic sorting in partial evaluation | `ast/compile.go:959` |
| Verification | Compiler stages (safety, types, recursion checks) | `ast/compile.go:222-259` |
| Verification | Full trace events for debugging | `topdown/trace.go:28-71` |
| Verification | Decision logging for audit | `server/server.go:1797-1798` |

## Answers to Protocol Questions

### 1. Where on the autonomy spectrum does the system sit?

**Fully deterministic (deterministic pole)**

OPA does not use AI, machine learning, or probabilistic reasoning. Evaluation is pure formal logic (Rego/Prolog-style resolution). The `seed` field in `topdown/eval.go:76-131` is for reproducibility, not AI randomness. Evidence: `topdown/builtins.go:71-88` shows the Rand() built-in uses a seeded PRNG, ensuring deterministic behavior across runs.

### 2. Is autonomy configurable per workflow or agent?

**No**

Configuration is at the OPA instance level, not the workflow level. `config/config.go:84-105` shows a single global `Config` struct. `runtime/runtime.go:108-295` shows a single `Params` struct for the runtime. There is no per-workflow or per-agent autonomy configuration. `rego/rego.go:93-131` shows `EvalContext` options are evaluation-time tweaks (time, seed, input), not autonomy mode switches.

### 3. What decisions are reserved for humans?

**Policy writing and deployment**

Humans own:
- Writing Rego policy code (`rego/` directory)
- Policy deployment (bundle configuration)
- Configuration of the OPA runtime instance
- Defining default decisions (`config/config.go:401-403`)

OPA owns:
- Policy evaluation (deterministic execution)
- Data retrieval and input processing
- Compiler verification

Evidence: `ast/policy.go:19-77` shows `DefaultRootDocument` and `InputRootDocument` as the data/input model; humans provide the data and policies, OPA evaluates.

### 4. What is the default when AI confidence is low?

**Not applicable**

OPA has no AI component, so confidence metrics are irrelevant. The engine does not reason about uncertainty—it produces defined results or undefined (nil). When a query has no matching rules, OPA returns `nil` (`topdown/eval.go:1037-1039`), not a probabilistic answer.

### 5. How is appropriate autonomy level determined?

**Explicit policy configuration**

There is no dynamic autonomy level determination. The appropriate behavior is entirely determined by the human-authored policies. OPA provides:
- `defaultDecision` path (`config/config.go:401`)
- `defaultAuthorizationDecision` path
- Default deny when no policy matches

OPA does not "decide" an autonomy level—it simply executes the loaded policy code.

### 6. What safeguards exist against autonomous mistakes?

**Policy-centric safeguards (not AI-centric)**

OPA's safeguards are centered on the human-authored policy model:
- Strict builtin error mode (`topdown/query.go:268-270`)
- Unsafe builtins check (`ast/compile.go:254`)
- Compiler stages for safety, types, recursion (`ast/compile.go:222-259`)
- Capabilities system to restrict builtins (`ast/capabilities.go:82-101`)
- Signed bundle verification (`bundle/`)

These are formal methods, not confidence thresholds or fallback AI. The safeguards assume human policy authors may make mistakes, not that the engine might misbehave autonomously.

### 7. How does the system handle edge cases?

**Formal undefined/logic approach**

- Default rule values provide fallback when no rule matches (`ast/policy.go`)
- Undefined results propagate as `nil` (`topdown/eval.go:1037-1039`)
- Deterministic sorting ensures consistent partial evaluation (`ast/compile.go:959`)
- Boolean and structured responses in authorizer (`server/authorizer/authorizer.go:140-150`)
- Nondeterministic builtins are explicitly marked (`ast/builtins.go:3608`)

No AI-style heuristics or confidence intervals—edge cases are handled through formal logic (defaults, undefined propagation, sorting).

### 8. What is the philosophy: "AI-first" or "human-first"?

**Strictly human-first, policy-as-code**

OPA's philosophy is "explicit is better than implicit." All policy logic must be written by humans in Rego. Evidence:
- `ast/policy.go:99-142` — Keywords like `not`, `package`, `default`, `if`; no keywords like "maybe" or "probably"
- `topdown/trace.go:28-71` — Trace operations are `Enter`, `Exit`, `Fail`, `Eval`, `Redo`; no "UncertainOp" or "ConfidenceOp"
- `runtime/runtime.go:894` — PRNG is seeded for deterministic behavior, not randomness

## Architectural Decisions

1. **Deterministic by design**: OPA prioritizes reproducibility over AI-style flexibility. Same input + same policy = same output.

2. **Policy-as-code**: All decision logic is human-authored Rego code. OPA is an execution engine, not a reasoning engine.

3. **Formal verification**: The compiler runs multiple stages (safety checks, type checks, recursion checks) to verify policy correctness before execution (`ast/compile.go:222-259`).

4. **Capability-based security**: The capabilities system restricts which builtins can be used, limiting what policies can do (`ast/capabilities.go:82-101`).

5. **No runtime AI**: There is no mechanism for OPA to "decide" to use AI or fallback to AI when uncertain—the engine simply executes policy code.

## Notable Patterns

1. **Seeded randomness**: Random numbers use a seed for reproducibility (`topdown/builtins.go:71-88`)

2. **Compiler stages**: Policy compilation is a pipeline of verification stages (`ast/compile.go:222-259`)

3. **Default deny**: Default authorization decision is `/system/authz/allow` set to deny unless a policy explicitly allows (`config/config.go:401-403`)

4. **Strict mode**: Builtin errors can be treated as fatal via `WithStrictBuiltinErrors` (`topdown/query.go:268-270`)

5. **Nondeterministic builtins marked**: Only specific builtins (e.g., `Rand`, `Now`) are marked nondeterministic, all others are deterministic (`ast/builtins.go:3608`)

## Tradeoffs

1. **Transparency vs Flexibility**: OPA's deterministic model is fully transparent and auditable, but cannot handle situations where "best effort" or probabilistic reasoning is needed.

2. **Human burden vs Safety**: All policy logic must be explicitly authored by humans, which is safe but places burden on policy authors to anticipate all cases.

3. **Formal verification vs Expressiveness**: The compiler's strict checks prevent many bugs but may reject complex policies that would be valid in a less strict system.

4. **No graceful degradation**: When policies are missing or undefined, OPA returns deny-by-default (`server/authorizer/authorizer.go:140-150`), which is safe but not adaptive.

## Failure Modes / Edge Cases

1. **Missing policy**: Returns deny-by-default when no rule matches (`server/authorizer/authorizer.go:140-150`)

2. **Unsafe builtins**: Blocked by default; `httpsend` is the only unsafe builtin allowed by default (`server/server.go:106`)

3. **Non-recursive policies**: Compiler checks for recursion and prevents infinite loops (`ast/compile.go:222-259`)

4. **Type errors**: Treated as fatal in strict mode; returns `TypeErr` code otherwise (`topdown/builtins.go:182-200`)

5. **Undefined results**: Propagates as `nil` through evaluation; no "unknown" state

6. **Bundle verification failure**: Signed bundles must be verified; skip is opt-in (`bundle/`)

## Future Considerations

1. **Per-workflow policy sets**: The capability system could be extended to support per-workflow policy namespaces with different autonomy constraints.

2. **Formal uncertainty handling**: A "maybe" or "unknown" result type could support scenarios where policy cannot fully decide.

3. **Partial evaluation with AI**: Partial evaluation could be enhanced with AI-based guidance for unknown variables.

4. **Dynamic policy loading**: Hot-reload of policies without restart is available but could be extended for runtime policy adaptation.

## Questions / Gaps

1. **No per-workflow autonomy**: OPA lacks any mechanism to configure different autonomy levels for different workflows—useful for cases where some decisions should be more constrained than others.

2. **No uncertainty propagation**: Unlike AI systems that can return "I don't know," OPA returns deny-by-default, which may be too restrictive for some domains.

3. **No AI integration point**: OPA has no extension mechanism for AI-based decision support within policy evaluation.

4. **Limited to policy execution**: OPA is not designed to reason about policy correctness beyond syntactic and basic safety checks—no semantic verification of policy intent.

5. **No confidence scoring**: Policies cannot express "I'm not sure, fallback to human" because OPA has no concept of confidence.

---

Generated by `study-areas/23-philosophy-of-autonomy.md` against `opa`.