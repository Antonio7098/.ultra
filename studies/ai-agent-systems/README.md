# ai-agent-systems

Comparative study of mature AI agent systems across architectural ecosystems. Each source repo is studied independently per dimension, then synthesized into combined reports. Focus is on agent infrastructure: execution loops, tools, state, safety, observability, governance, evaluation, and coordination.

## Sources Studied

| Source | Description |
|--------|-------------|
| aider | AI pair programming in the terminal |
| autogen | Multi-agent conversation framework |
| guardrails | Guardrails AI — runtime guardrails for LLM apps |
| langfuse | Open source observability and evaluation for LLM apps |
| langgraph | LangChain's graph-based agent orchestration framework |
| mastra | TypeScript agent framework |
| nemo-guardrails | NVIDIA NeMo Guardrails |
| opa | Open Policy Agent — policy engine |
| openai-agents-python | OpenAI Agents SDK for Python |
| opencode | Agentic coding CLI with structured governance |
| openhands | AI developer agent platform |
| temporal | Durable execution platform / workflow engine |

## Study Dimensions

| # | Dimension | Description |
|---|-----------|-------------|
| 01 | Execution Semantics | Step-based, event-driven, graph, recursive loops |
| 02 | State Model | Immutable vs mutable state, checkpoints, durable execution |
| 03 | Agent Loop Design | State machines, recursive loops, graph execution |
| 04 | Tool System | Registration, discovery, schemas, permissions |
| 05 | Memory Model | Scratchpads, episodic memory, RAG, checkpointing |
| 06 | Planning Architecture | Explicit vs implicit planning, planner/executor separation |
| 07 | Tool Execution Model | Sync/async, parallelism, streaming, cancellation |
| 08 | Capability Security | Permissions, sandboxing, runtime approval |
| 09 | Governance Surface | Policy engines, approval chains, audit trails |
| 10 | Traceability Model | Trace trees, spans, causal chains |
| 11 | Context Engineering | Sliding windows, RAG, compression, summarization |
| 12 | Prompt Lifecycle | Versioning, templating, evaluation, rollback |
| 13 | Failure Philosophy | Retries, compensation, rollback, degradation |
| 14 | Human Supervision | Approval gates, intervention, collaborative execution |
| 15 | Multi-Agent Coordination | Blackboard, hierarchy, voting, delegation |
| 16 | Artifact Model | Generated artifacts, versioning, outputs |
| 17 | Runtime Isolation | Process, container, VM, network isolation |
| 18 | Evaluation Architecture | Online/offline evals, regression, trajectory eval |
| 19 | Open Standards Strategy | MCP, A2A, OpenTelemetry, OpenAPI |
| 20 | Runtime Economics | Token budgeting, caching, batching, model selection |
| 21 | Extensibility | Plugin systems, tool registration, schema evolution |
| 22 | Organizational Architecture | Team boundaries, ownership, operating model |
| 23 | Philosophy of Autonomy | Constrained, exploratory, or deterministic execution |

## Usage

```bash
# List sources and dimensions
ultra study ai-agent-systems list

# Run all dimension × source analyses
ultra study ai-agent-systems run-all --parallel 3

# Stateful batch runner with retry/backoff
ultra study ai-agent-systems run-loop --batch-size 2

# Show run-loop status
ultra study ai-agent-systems status
```

## Report Structure

```
reports/source/<NN>-<dimension-name>/
  <source-name>.md    # Per-source analysis

reports/final/<NN>-<dimension-name>.md  # Synthesized combined report
```
