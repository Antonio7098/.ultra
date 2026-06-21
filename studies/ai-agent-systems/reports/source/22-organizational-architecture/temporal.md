# Repo Analysis: temporal

## Organizational Architecture Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | temporal |
| Path | `repos/temporal` |
| Language / Stack | Go (module: `go.temporal.io/server`), gRPC, Protobuf, multiple DB backends |
| Analyzed | 2026-05-17 |

## Summary

Temporal's architecture assumes a **platform team + multiple application teams** organizational model with sharp boundaries. The server is designed to be operated by a dedicated infrastructure/platform team, while application teams interact solely through SDKs and worker binaries. Five internal services (Frontend, Internal Frontend, History, Matching, Worker) form the cluster, each with distinct ownership responsibilities. Governance is enforced through a pluggable Authorizer interface with namespace-scoped RBAC roles. The system explicitly distinguishes between platform development (server internals) and application development (workflows/activities), with the API boundary at the gRPC layer consumed by SDKs.

## Rating

**8/10** — Clear separation of concerns with role-appropriate interfaces. Platform team owns cluster infrastructure; app teams self-serve through SDKs. Plugable authorization and namespace isolation provide organizational boundaries, though multi-tenant operational tooling (RBAC UI, quota dashboards) is config-driven rather than productized.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Service boundary definitions | Five named services: frontend, internal-frontend, history, matching, worker | `temporal/server.go:25-31` |
| Default service set | DefaultServices excludes internal-frontend | `temporal/server.go:35-40` |
| Service internal structure: frontend | Modular fx-based DI with handler, admin, operator, HTTP API sub-components | `service/frontend/fx.go:67-135` |
| Service internal structure: history | Shard-based sub-architecture with queue processors, replication, HSM | `service/history/history_engine.go` |
| Service internal structure: matching | Task queue partition management, forwarding tree, fair scheduling | `service/matching/matching_engine.go` |
| Service internal structure: worker | Replicator, scanner, batcher, DLQ, per-namespace workers | `service/worker/fx.go:44-106` |
| Inter-service communication | Separate gRPC client packages per service | `client/frontend/`, `client/history/`, `client/matching/` |
| Cluster membership | Ringpop-based membership protocol for service discovery | `common/membership/ringpop/` |
| Authorization interface | Pluggable Authorizer interface with CallTarget context | `common/authorization/authorizer.go:54-56` |
| RBAC roles | Role bitmask: Worker, Reader, Writer, Admin | `common/authorization/roles.go:8-13` |
| Claims model | System-level and namespace-level role claims | `common/authorization/roles.go:24-37` |
| Default authorizer logic | System roles apply across all namespaces; namespace roles scoped | `common/authorization/default_authorizer.go:35-65` |
| Noop authorizer | Accepts all requests, warn on startup without --allow-no-auth | `cmd/server/main.go:203-209` |
| Internal frontend pattern | Separate service for internal cluster traffic with own claim mapper | `temporal/fx.go:551-556` |
| Namespace isolation | Core multi-tenancy primitive, scopes all workflow operations | `config/development-sqlite.yaml:136-138` |
| Dynamic config | File-based dynamic config with polling, enables runtime reconfiguration | `config/dynamicconfig/` |
| Deployment config template | Production deployment via Go templates; supports Cassandra, MySQL, Postgres, ES | `docker/config_template.yaml` |
| Multi-DB support | Persistence abstraction with Cassandra, SQLite, MySQL, Postgres drivers | `common/persistence/` |
| Docker build targets | Multi-arch Docker images (linux/amd64, linux/arm64) | `docker/docker-bake.hcl:56` |
| CLI service selection | `--service` flag to start individual services | `cmd/server/main.go:136-142` |
| System namespace | `temporal-system` namespace required for internal workflows | `service/worker/service.go:382-399` |
| Schema management | Dedicated CLI tools for DB schema install/upgrade per DB type | `cmd/tools/cassandra/`, `cmd/tools/sql/` |
| TLS configuration | Separate TLS configs for internode, frontend, system worker | `common/config/config.go:144-160` |
| Auth configuration | JWT key provider, claim mapper, authorizer, audience mapper | `common/config/config.go:626-643` |
| Metrics configuration | Prometheus (tally or OpenTelemetry framework) with histogram support | `config/development-sqlite.yaml:59-65` |
| OTEL tracing | Exporters from config, env vars, or custom code; per-service tracer providers | `temporal/fx.go:930-974` |
| Health check | gRPC health service with draining on shutdown | `service/frontend/service.go:502-554` |
| Graceful shutdown | Membership draining, health check failure, request drain sequence | `service/frontend/service.go:503-510` |
| Developer setup | Single-binary start with SQLite in-memory; `make start` | `CONTRIBUTING.md:130-134` |
| Production architecture doc | Describes user-hosted Workers vs Temporal Cluster processes | `docs/architecture/README.md:37-61` |

## Answers to Protocol Questions

### 1. What team structure does this architecture assume?

A **platform team + multiple application teams** structure. The Temporal cluster is operated by a dedicated platform/infrastructure team, while application teams write workflow/activity code and run Worker processes. This is evident from:

- Sharp API boundary via gRPC — SDKs are the sole interface for app teams (`docs/architecture/README.md:44-53`).
- Server has five internal services that must be deployed, configured, and monitored together (`temporal/server.go:25-31`).
- Schema management requires dedicated tooling (`cmd/tools/cassandra/`, `cmd/tools/sql/`).
- Multi-DB support implies database administration expertise is assumed on the platform side (`config/development-sqlite.yaml` vs `config/development-cass-es.yaml`).

### 2. Is the system self-serve or platform-managed?

**Both**. The Temporal server itself is platform-managed — infrastructure engineers deploy and operate the cluster. However, the system provides self-serve capabilities for application teams:
- SDKs allow app teams to create namespaces, start workflows, and manage workers without involving the platform team (`docs/architecture/README.md:46-53`).
- Namespaces provide tenant isolation so app teams operate independently (`config/development-sqlite.yaml:136-138`).
- Dynamic config enables runtime tuning without redeployment (`config/dynamicconfig/`).

### 3. How is ownership divided between platform and feature teams?

| Concern | Owner | Evidence |
|---------|-------|----------|
| Cluster lifecycle (deploy, scale, upgrade) | Platform team | `cmd/server/main.go:126-142`, `docker/config_template.yaml` |
| Database schema & operations | Platform team | `Makefile:567-603` (install-schema targets) |
| TLS & network security | Platform team | `common/config/config.go:144-160` |
| Authorization policies | Platform team | `common/authorization/authorizer.go:54-56` |
| Workflow & activity code | App team | `docs/architecture/README.md:44-53` (user-hosted processes) |
| Worker binaries | App team | `docs/architecture/README.md:48-49` |
| Namespace management | App team (via CLI/SDK) or platform | `docs/architecture/README.md:46` |
| Monitoring dashboards | Platform team | `Makefile:711-713` (Grafana dashboards submodule) |

### 4. What operational expertise is required?

**High**. Operating a Temporal cluster requires:
- Distributed systems knowledge (Ringpop membership, sharding, replication) — `common/membership/ringpop/`
- Database administration (Cassandra, PostgreSQL, MySQL, or SQLite schema management) — `schema/` directory
- Networking / TLS configuration (internode, frontend, system worker) — `common/config/config.go:144-160`
- Metrics and observability setup (Prometheus, Grafana, OTEL) — `config/development-sqlite.yaml:59-65`, `temporal/fx.go:930-974`
- Container orchestration (Docker, Kubernetes for production) — `docker/docker-bake.hcl`
- Go toolchain and build systems for custom deployments — `Makefile`

The `CONTRIBUTING.md` and `develop/` directory help local development but production deployment is non-trivial.

### 5. How is governance enforced organizationally?

Via a **pluggable authorization chain**:
1. **ClaimMapper** extracts identity + roles from JWT tokens or mTLS certificates (`common/authorization/claim_mapper.go`)
2. **Authorizer** makes allow/deny decisions per API call based on claims and target (`common/authorization/authorizer.go:54-56`)
3. **Roles** are namespace-scoped: Worker, Reader, Writer, Admin (`common/authorization/roles.go:8-13`)
4. **System-level roles** apply across all namespaces; namespace roles are scoped (`common/authorization/default_authorizer.go:35-65`)
5. **Internal Frontend** provides a separate path for intra-cluster traffic with its own claim mapper (`temporal/fx.go:551-556`)
6. **Audience mapper** validates JWT audience claims (`common/authorization/audience_mapper.go`)
7. **NoopAuthorizer** with explicit opt-in (`--allow-no-auth`) prevents accidental insecure deployments (`cmd/server/main.go:203-209`)

### 6. What is the assumed scale of the team?

The architecture accommodates **small to very large teams**:
- Single developer can run `make start` with SQLite in-memory for local dev (`CONTRIBUTING.md:130-134`)
- Small teams can deploy a single-server instance with SQLite file persistence (`config/development-sqlite-file.yaml`)
- Large organizations run multi-node clusters with Cassandra, sharded history, and dedicated internal-frontend
- The membership system (Ringpop) supports dynamic cluster membership for scaling (`common/membership/ringpop/`)
- Static history shard count means capacity planning is required upfront (`common/config/config.go:264-266`)

### 7. Does the architecture distinguish app dev vs platform dev?

**Yes, explicitly**. The distinction is fundamental to Temporal's design:
- App devs write Workflows & Activities using SDKs; they never touch server code
- Platform devs maintain the server, database schemas, and deployment infrastructure
- The architecture doc draws a clear line between "user-hosted processes" (SDK Workers) and "Temporal Cluster" (`docs/architecture/README.md:39-61`)
- System Workflows (replicator, scanner, scheduler) are internal and run by the Worker service, not by app Workers (`service/worker/service.go:244-289`)
- The `InternalFrontendService` is a separate service for platform-internal traffic, invisible to app teams (`temporal/fx.go:551-556`)

## Architectural Decisions

| Decision | Rationale | Evidence |
|----------|-----------|----------|
| Five distinct services | Separation of concerns: frontend (API gateway), history (state machine), matching (task queue), worker (background jobs), internal-frontend (cluster-internal API) | `temporal/server.go:25-31` |
| Ringpop membership | Consistent hash ring for service discovery + shard ownership; enables horizontal scaling | `common/membership/ringpop/` |
| Pluggable authorization | Allows organizations to integrate existing IAM systems (JWT, mTLS, custom) | `common/authorization/authorizer.go:54-56` |
| Namespace as tenancy unit | All workflow operations are scoped to a namespace; enables multi-team isolation | `service/frontend/fx.go:203-213` |
| Separate internal frontend (optional) | Allows platform to expose different auth surface for cluster-internal vs external traffic | `temporal/fx.go:551-556` |
| Dynamic config | Runtime configuration changes without cluster restart; enables gradual rollout | `config/dynamicconfig/` |
| Multiple persistence backends | Supports orgs with existing DB infrastructure; avoids vendor lock-in | `common/persistence/` |
| Event sourcing + sharded history | Enables durable execution at scale; tradeoff is static shard count | `docs/architecture/history-service.md:77-88` |
| System workflows on Worker service | Internal cluster tasks use the same Temporal primitives as user workflows | `service/worker/service.go:244-289` |

## Notable Patterns

1. **Microservices with shared infrastructure**: Each service uses fx DI, shares persistence, membership, and metrics infrastructure through `ServiceProviderParamsCommon` (`temporal/fx.go:347-377`).

2. **Layered authorization**: External → Frontend (JWT/ClaimMapper) → Internal Frontend (mTLS/InternalClaimMapper) → Inter-service (Ringpop membership). Multiple defensive layers (`temporal/fx.go:176-311`).

3. **Transactional outbox pattern**: History Service uses internal task queues (Transfer, Timer) to ensure consistency between workflow state and Matching Service tasks (`docs/architecture/history-service.md:318-322`).

4. **Graceful shutdown with membership draining**: Services fail health checks first, then wait for discovery propagation, then drain requests (`service/frontend/service.go:502-554`).

5. **Per-namespace worker management**: The Worker service spawns per-namespace SDK workers for internal tasks (scheduler, batcher, etc.), with rate-limited startup (`service/worker/fx.go:205-216`).

6. **Runtime reconfigurability via dynamic config**: ~200+ tunable parameters without restart, plus subscription for live updates (`config/dynamicconfig/`).

## Tradeoffs

| Tradeoff | Detail |
|----------|--------|
| Static history shard count vs elasticity | Shard count is fixed at cluster init; can't scale history storage without data migration | `common/config/config.go:264-266` |
| Rich configuration vs operational simplicity | Complex config surface (TLS, persistence, auth, metrics, archival) increases ops burden | `docker/config_template.yaml:1-362` |
| Multiple persistence backends vs maintenance | Supporting Cassandra, MySQL, Postgres, SQLite + Elasticsearch increases test matrix and bug surface | `common/persistence/` |
| Pluggable auth vs productized RBAC | No built-in RBAC UI; orgs must build or integrate their own claim mapper + authorizer | `common/authorization/` |
| fx DI complexity vs modularity | Uber fx provides clean DI but adds indirection; service initialization is hard to trace | `temporal/fx.go:132-153` |
| Ringpop dependency vs simpler membership | Ringpop adds operational complexity (gossip, failure detection) but enables dynamic topology | `common/membership/ringpop/` |
| Monorepo vs multi-repo | Single repo for all server components simplifies cross-service changes but creates large CI surface | Root directory structure |

## Failure Modes / Edge Cases

1. **Shard ownership loss**: History shards can be lost during network partitions; RangeID fencing prevents corruption (`docs/architecture/history-service.md:86`).

2. **Noop authorizer in production**: Running without `--allow-no-auth` warning means zero auth — critical misconfiguration (`cmd/server/main.go:203-209`).

3. **Static shard count mismatch**: If `NumHistoryShards` changes after cluster init, persisted metadata overrides config silently (`temporal/fx.go:839-847`).

4. **Cross-cluster replication complexity**: Multi-cluster setup assumes mature operational capability; namespace replication queue failure can stall global workflows.

5. **Memory pressure from per-namespace workers**: Worker service spawns per-namespace SDK workers; at high namespace counts this can exhaust resources (`service/worker/fx.go:205-216`).

6. **Docker config template exposure**: Production deployment config template in `docker/config_template.yaml` exposes all env vars — misconfiguration can leave systems with no auth, wrong TLS, or default passwords.

## Future Considerations

1. Dynamic history shard rebalancing (currently requires manual intervention or re-init).
2. Built-in RBAC UI/API for namespace-level role management (currently must be built on Authorizer interface).
3. Simplified single-binary production deployment path (currently requires DB schema tooling and multi-service orchestration).
4. Namespace-level operational dashboards for app teams (currently platform-owned via Grafana).
5. Multi-cluster failover automation (currently requires manual `tctl admin` commands per `temporal/fx.go:669-674`).

## Questions / Gaps

1. **No evidence found** of a built-in admin UI for namespace-level RBAC assignment — orgs must implement their own ClaimMapper/Authorizer integration.
2. **No evidence found** of per-namespace rate limit enforcement at the platform level — it's config-driven and per-instance, not centrally managed.
3. **No evidence found** of built-in cost allocation/showback — multi-team deployments rely on external tooling for usage attribution.
4. The CLI tooling (`cmd/tools/`) is admin-oriented; no self-serve tooling for app team onboarding is included in this repo.

---

Generated by `study-areas/22-organizational-architecture.md` against `temporal`.
