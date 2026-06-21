# Repo Analysis: temporal

## Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | temporal |
| Path | `repos/temporal` |
| Language / Stack | Go (server monorepo) |
| Analyzed | 2026-05-17 |

## Summary

Temporal's server is built with extensibility as a first-class concern. The architecture provides well-defined interfaces for nearly every subsystem — persistence, visibility, archival, authorization, dynamic configuration, metrics, TLS, gRPC interceptors, search attributes, and membership — all injectable via `ServerOption` functional options (`temporal/server_option.go:24-207`). SQL database backends use a plugin registry pattern (`common/persistence/sql/store.go:18-26`) with init-time registration. The SDK layer supports client interceptors, custom data converters, and per-worker options. Several newer extension points (custom datastore factory, custom archiver factories) are explicitly marked experimental. The system lacks true runtime plugin loading (SQL plugins require recompilation) and some extension interfaces remain undocumented, preventing a score of 10.

## Rating

**9/10** — Well-defined extension interfaces with documentation; plugin architecture with versioned APIs and lifecycle management for SQL databases. Deducted 1 point because (a) SQL plugins require recompilation via Go `init()` rather than runtime loading, (b) several `ServerOption` extension points are explicitly marked experimental and may change, and (c) some extension points lack user-facing documentation.

Fast heuristic: *Can you add a new tool without touching the core agent code?* — Yes, via `WithChainedFrontendGrpcInterceptors`, `WithCustomDataStoreFactory`, `WithAuthorizer`, and the SDK interceptor pattern.
Actually, for a temporal *server*, the more relevant heuristic is: *Can you add a custom persistence backend, visibility store, or authorization strategy without modifying core server code?* — Yes, via `ServerOption` injection.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| SQL Plugin Interface | `Plugin` interface for pluggable SQL databases | `common/persistence/sql/sqlplugin/interfaces.go:31-36` |
| SQL Plugin Registration | Global `RegisterPlugin()` + `init()` pattern | `common/persistence/sql/store.go:18-26` |
| MySQL Plugin Registration | Registers as `"mysql8"` via `init()` | `common/persistence/sql/sqlplugin/mysql/plugin.go:26-29` |
| PostgreSQL Plugin Registration | Registers as `"postgres12"` and `"postgres12_pgx"` via `init()` | `common/persistence/sql/sqlplugin/postgresql/plugin.go:38-47` |
| SQLite Plugin Registration | SQLite plugin implementation | `common/persistence/sql/sqlplugin/sqlite/plugin.go` |
| Plugin Side-Effect Imports | Server main imports all SQL plugins | `cmd/server/main.go:21-23` |
| DataStoreFactory Interface | Pluggable persistence backend factory | `common/persistence/persistence_interface.go:30-51` |
| AbstractDataStoreFactory | Custom datastore support outside core | `common/persistence/client/abstract_data_store_factory.go:16-25` |
| VisibilityStoreFactory | Pluggable visibility store factory | `common/persistence/visibility/factory.go:20-31` |
| Custom Datastore Config | Config struct for custom data stores | `common/config/config.go:452-464` |
| ArchiverProvider Interface | Pluggable history/visibility archivers | `common/archiver/provider/provider.go:29-32` |
| CustomHistoryArchiverFactory | Custom history archiver constructor | `common/archiver/provider/provider.go:54-56` |
| CustomVisibilityArchiverFactory | Custom visibility archiver constructor | `common/archiver/provider/provider.go:61-63` |
| Authorizer Interface | Pluggable authorization logic | `common/authorization/authorizer.go:54-56` |
| ClaimMapper Interface | Pluggable JWT claim mapping | `common/authorization/claim_mapper.go:29-31` |
| Auth Interceptor | gRPC authorization interceptor | `common/authorization/interceptor.go:83-96` |
| DynamicConfig Client Interface | Pluggable dynamic config source | `common/dynamicconfig/client.go:12-32` |
| NotifyingClient Interface | Push-based config change notifications | `common/dynamicconfig/client.go:36-41` |
| gRPC Interceptor Chain | 20+ interceptors composed in frontend service | `service/frontend/fx.go:67-135` |
| Custom gRPC Interceptors | Appended at end of interceptor chain | `service/frontend/fx.go:301-303` |
| WithChainedFrontendGrpcInterceptors | ServerOption for custom interceptors | `temporal/server_option.go:189-199` |
| WithAuthorizer | ServerOption for custom auth | `temporal/server_option.go:96-99` |
| WithDynamicConfigClient | ServerOption for custom config | `temporal/server_option.go:138-141` |
| WithCustomDataStoreFactory | ServerOption for custom persistence (experimental) | `temporal/server_option.go:144-150` |
| WithCustomVisibilityStoreFactory | ServerOption for custom visibility (experimental) | `temporal/server_option.go:152-156` |
| WithCustomHistoryArchiverFactory | ServerOption for custom archiver (experimental) | `temporal/server_option.go:160-164` |
| WithCustomVisibilityArchiverFactory | ServerOption for custom archiver (experimental) | `temporal/server_option.go:168-172` |
| WithClientFactoryProvider | ServerOption for custom SDK factory (experimental) | `temporal/server_option.go:176-180` |
| WithSearchAttributesMapper | ServerOption for custom search attr mapping | `temporal/server_option.go:183-186` |
| WithCustomMetricsHandler | ServerOption for custom metrics | `temporal/server_option.go:203-206` |
| WithTLSConfigFactory | ServerOption for custom TLS | `temporal/server_option.go:103-106` |
| WithPersistenceServiceResolver | ServerOption for custom resolver | `temporal/server_option.go:124-128` |
| Task Lifecycle Hooks | Pluggable task queue partition hooks | `service/matching/hooks/task_lifecycle_hooks.go:31-45` |
| Chasm Library Interface | CHASM component library registration | `chasm/library.go:11-23` |
| HSM Registry | State machine definition registry | `service/history/hsm/registry.go` |
| Namespace Registry + Callbacks | State change callback subscription | `common/namespace/registry.go:20-40` |
| Fault Injection Decorator | Wraps DataStoreFactory with fault injection | `common/persistence/faultinjection/data_store_factory.go` |
| Telemetry Decorator | Wraps DataStoreFactory with OpenTelemetry | `common/persistence/telemetry/data_store_factory.go` |
| SDK Interceptor Usage | Custom interceptor test (Client/Workflow/Activity) | `temporaltest/server_test.go:411-457` |
| Custom DataConverter | Server's composite proto-first data converter | `common/sdk/converter.go:11-17` |
| Test Custom DataConverter | Complete custom DataConverter using gob | `tests/testcore/test_data_converter.go:18-115` |
| SDK Client Options | DataConverter in client construction | `tests/client_data_converter_test.go:83-87` |
| Dynamic Config Feature Flags | ~50+ `Enable*` keys for feature gating | `common/dynamicconfig/constants.go` |
| gRPC Proto Routing Extension | Custom proto annotations for shard routing | `proto/internal/temporal/server/api/routing/v1/extension.proto:1-20` |

## Answers to Protocol Questions

### 1. What are the primary extension points?

**Server-level (via `ServerOption`):**
- Authorization (`WithAuthorizer`) — `temporal/server_option.go:96`
- Claim mapping (`WithClaimMapper`) — `temporal/server_option.go:110`
- JWT audience (`WithAudienceGetter`) — `temporal/server_option.go:117`
- TLS config (`WithTLSConfigFactory`) — `temporal/server_option.go:103`
- Dynamic config client (`WithDynamicConfigClient`) — `temporal/server_option.go:138`
- Custom data store factory (`WithCustomDataStoreFactory`) — `temporal/server_option.go:146`
- Custom visibility store factory (`WithCustomVisibilityStoreFactory`) — `temporal/server_option.go:152`
- Custom history archiver factory (`WithCustomHistoryArchiverFactory`) — `temporal/server_option.go:160`
- Custom visibility archiver factory (`WithCustomVisibilityArchiverFactory`) — `temporal/server_option.go:168`
- Custom SDK client factory (`WithClientFactoryProvider`) — `temporal/server_option.go:176`
- Search attributes mapper (`WithSearchAttributesMapper`) — `temporal/server_option.go:183`
- Frontend gRPC interceptors (`WithChainedFrontendGrpcInterceptors`) — `temporal/server_option.go:193`
- Custom metrics handler (`WithCustomMetricsHandler`) — `temporal/server_option.go:203`
- Persistence service resolver (`WithPersistenceServiceResolver`) — `temporal/server_option.go:124`

**Plugin-level (via `init()` registration):**
- SQL database backends (`mysql8`, `postgres12`, `postgres12_pgx`, `sqlite`) — `common/persistence/sql/store.go:18`

**Service-level:**
- 20+ gRPC interceptors in the frontend interceptor chain — `service/frontend/fx.go:67-135`
- Task lifecycle hooks for matching — `service/matching/hooks/task_lifecycle_hooks.go:31-45`
- CHASM Library registration for custom state machines — `chasm/library.go:11-23`
- HSM Registry for hierarchical state machines — `service/history/hsm/registry.go`
- Namespace state change callbacks — `common/namespace/registry.go:20-40`

**SDK-level (via Go SDK dependency):**
- Client interceptors — `temporaltest/server_test.go:411-457`
- Worker registration (`RegisterWorkflow`, `RegisterActivity`, etc.) — `common/testing/mocksdk/worker_mock.go:46-158`
- Custom `DataConverter` — `common/sdk/converter.go:11-17`; `tests/testcore/test_data_converter.go:18-115`

### 2. How are custom tools/providers added?

Custom providers are added through two mechanisms:

**A. `ServerOption` injection (recommended for server embedding):**
The `temporal.NewServer()` function accepts `ServerOption` variadic arguments. Each option sets a field on the internal `serverOptions` struct (`temporal/server_options.go:27-61`). For example:
```go
temporal.NewServer(
    temporal.WithAuthorizer(myAuthorizer),
    temporal.WithCustomDataStoreFactory(myFactory),
)
```

**B. SQL plugin registration (for new database backends):**
Implement `sqlplugin.Plugin` interface (`common/persistence/sql/sqlplugin/interfaces.go:31-36`) and register via `sql.RegisterPlugin()` in an `init()` function. The server main must import the package as a side-effect (`cmd/server/main.go:21-23`).

**C. Decorator wrapping (for augmented existing providers):**
`FaultInjectionDataStoreFactory` wraps any `DataStoreFactory` — `common/persistence/faultinjection/data_store_factory.go`
`TelemetryDataStoreFactory` wraps any `DataStoreFactory` with tracing — `common/persistence/telemetry/data_store_factory.go`

### 3. Are there hooks/middleware for customization?

Yes, extensively:

**gRPC interceptor chains:**
- Frontend service has a chain of 20+ built-in interceptors — `service/frontend/fx.go:280-306`
- Custom interceptors are appended at the end — `service/frontend/fx.go:301-303`
- Stream interceptor custom hook available — `service/frontend/fx.go:312-314`
- `GrpcServerOptionsParams` supports extra interceptors at service level — `service/fx.go:38-53`

**Authorization middleware:**
- gRPC-level authorization interceptor — `common/authorization/interceptor.go:83-96`

**Matching task lifecycle hooks:**
- `TaskHookFactory` / `TaskHook` interfaces for task add events — `service/matching/hooks/task_lifecycle_hooks.go:31-45`

**Namespace state change callbacks:**
- `RegisterStateChangeCallback` on namespace registry — `common/namespace/registry.go:20-40`

### 4. Is extension configuration-driven or code-driven?

**Primarily code-driven.** Most extension points are injected programmatically via `ServerOption` in Go code. Key examples:
- Authorization: `WithAuthorizer(authorizer)` — `temporal/server_option.go:96`
- Custom data stores: `WithCustomDataStoreFactory(factory)` — `temporal/server_option.go:146`
- gRPC interceptors: `WithChainedFrontendGrpcInterceptors(...)` — `temporal/server_option.go:193`

**Configuration-driven for some built-in options:**
- Auth config string selects `"noop"` or `"default"` authorizer — `common/authorization/authorizer.go:64-73`
- Archival config uses YAML config for filestore/gcloud/S3 — `common/config/config.go:499-527`
- Dynamic config file-based client is the default — `common/dynamicconfig/client.go:9-10`
- `CustomDatastoreConfig` in YAML picks the custom factory — `common/config/config.go:452-464`

**Hybrid:**
- SQL plugins are code-driven (`init()` registration) but selected via config (the plugin name in persistence config)
- Visibility stores use both config (`SQL`, `Elasticsearch`, `CustomDataStoreConfig` fields) and code (`customVisibilityStoreFactory`) — `common/persistence/visibility/factory.go:259-299`

### 5. How stable are extension interfaces?

Most `ServerOption` extension points appear stable (present across versions, well-documented). However, several are **explicitly marked experimental**:

| Extension Point | Stability Marker | File:Line |
|----------------|-----------------|-----------|
| `WithCustomDataStoreFactory` | "NOTE: this option is experimental and may be changed or removed" | `temporal/server_option.go:145` |
| `WithCustomHistoryArchiverFactory` | "NOTE: this option is experimental" | `temporal/server_option.go:159` |
| `WithCustomVisibilityArchiverFactory` | "NOTE: this option is experimental" | `temporal/server_option.go:167` |
| `WithClientFactoryProvider` | "NOTE: this option is experimental and may be changed or removed" | `temporal/server_option.go:175` |

The SQL plugin interface (`sqlplugin.Plugin`) is implicitly stable — it is used by 3 production backends (MySQL, PostgreSQL, SQLite) with multiple driver variants.

The authorization interfaces (`Authorizer`, `ClaimMapper`) are starred in the public docs (`@@@SNIPSTART` comments in `common/authorization/authorizer.go:21` and `common/authorization/authorizer.go:52`), suggesting they are considered stable public APIs.

### 6. How are breaking changes managed?

No explicit breaking change policy or versioning protocol was found in the codebase. The stability markers ("experimental") on certain `ServerOption` APIs serve as a hedge — indicating those interfaces may break. Key observations:

- Dynamic config keys in `common/dynamicconfig/constants.go` use a naming convention (e.g., `Enable*`) suggesting they are treated as internal and can be renamed/removed.
- gRPC interceptors are appended to the chain end (`service/frontend/fx.go:301-303`), meaning internal reordering could affect behavior of custom interceptors (the TODO comment `"// TODO: Deprecate WithChainedFrontendGrpcInterceptors and provide a inner custom interceptor"` at line 301 acknowledges this fragility).
- The `@@@SNIPSTART`/`@@@SNIPEND` markers around `Authorizer` and `CallTarget` suggest these interfaces are part of a documented public surface and would receive migration support.

No evidence of formal deprecation notices, migration guides, or API versioning for extension points was found.

### 7. What is intentionally NOT extensible?

- **Core history service shard management and replication logic** — the history engine's internal state machine transition logic is intentionally opaque; custom shard assignment or replication strategies would require forking.
- **Internal gRPC service routing** — the matching, history, and worker services use hardcoded inter-service clients defined in `client/`; the routing topology is fixed.
- **Workflow execution runtime** — the workflow sandbox, replay logic, and decision task processing are not extensible beyond the SDK interceptor pattern.
- **Task queue matching algorithm** — the matching engine (`service/matching/matching_engine_interfaces.go:10-52`) has a fixed algorithm; pluggable matching strategies are not supported.
- **SQL table schema / CRUD operations** — while SQL backends are pluggable, the table schemas and CRUD operations are fixed by `TableCRUD` interface (`common/persistence/sql/sqlplugin/interfaces.go:39-77`).
- **Cross-DC replication** — the replication logic in `service/history/replication/` is not designed for custom replication strategies.

### 8. How discoverable are extension points?

**Uneven discoverability:**

- **Well-documented:** `ServerOption` functions have doc comments (`temporal/server_option.go:33-207`). The authorization interfaces have `@@@SNIPSTART` markers suggesting public docs integration (`common/authorization/authorizer.go:21,52`).
- **Poorly documented:** The SQL plugin system has no user-facing documentation beyond the Go interface and registration function. The CHASM Library interface (`chasm/library.go:11-23`) and HSM Registry (`service/history/hsm/registry.go`) have no documentation about how to implement or register extensions.
- **Discoverable via code:** All `ServerOption` functions are in a single file (`temporal/server_option.go`), making them easy to find. The `fx.Provide` calls in `service/frontend/fx.go:67-135` document the interceptor chain explicitly.
- **Not discoverable as a system:** There is no single document or config section listing all extension points. A developer must discover them by reading source code.

## Architectural Decisions

1. **Functional Options Pattern for Server Extension** (`temporal/server_option.go:24-31`): The `ServerOption` interface uses the functional options pattern, allowing backward-compatible addition of new extension points without changing the `NewServer` signature. This is the canonical Go pattern and is consistently applied across all 15+ extension points.

2. **Plugin Registration via Go `init()`** (`common/persistence/sql/store.go:18-26`, `cmd/server/main.go:21-23`): SQL backends register via `init()` functions with a global map. This is a compile-time plugin system — new backends require code changes, recompilation, and side-effect imports. The decision favors type safety and simplicity over dynamic loading.

3. **Decorator-Based Layering** (`common/persistence/faultinjection/data_store_factory.go`, `common/persistence/telemetry/data_store_factory.go`): Instead of weaving concerns into core interfaces, persistence stores are wrapped with decorators at construction time (telemetry, rate limiting, fault injection). This keeps core implementations clean while enabling cross-cutting concerns.

4. **FX Dependency Injection for Internal Wiring** (`service/frontend/fx.go:67-135`): The server uses Uber's `fx` for internal dependency injection. All interceptors, providers, and handlers are composed declaratively. This makes the internal composition explicit but also means extending internal wiring requires understanding the `fx` graph.

5. **gRPC Interceptor Chain with Fixed Internal Order** (`service/frontend/fx.go:280-306`): Internal interceptors are applied in a fixed order. Custom interceptors are appended at the end. This is a deliberate simplicity tradeoff — custom interceptors see post-processed requests and cannot interpose between auth and business logic interceptors. The TODO at line 301 acknowledges this limitation.

6. **Stable Public Interfaces via Snippet Markers** (`common/authorization/authorizer.go:21,52`): The `@@@SNIPSTART`/`@@@SNIPEND` markers indicate interfaces that are considered public API for documentation generation, signaling stability intent.

## Notable Patterns

1. **Concrete `Unimplemented*` base types**: The CHASM `Library` interface provides `UnimplementedLibrary` (`chasm/library.go:25-52`) with zero-value defaults, allowing implementors to override only what they need. This is a Go idiom for backward-compatible interface evolution.

2. **Scheme-based archiver selection**: Archivers are selected by URI scheme in a fallback pattern — custom factory first, then built-in (`filestore`, `gcloud`, `s3store`) — `common/archiver/provider/provider.go:131-171`.

3. **Dual visibility store**: The visibility system supports primary + secondary stores with a selector for read/write routing (`common/persistence/visibility/factory.go:111-126`), enabling gradual migration.

4. **Global singleton registration vs DI**: SQL plugins use a global `init()` registration pattern while server extensions use DI via `ServerOption`. This creates two different extension paradigms in the same codebase.

5. **Dynamic config constraints**: The config system supports multi-dimensional constraint matching (namespace, task queue, shard ID) — `common/dynamicconfig/client.go:66-96` — enabling fine-grained per-deployment overrides without code changes.

6. **Conditionally nil hooks**: `TaskHookFactory.Create()` may return nil (`service/matching/hooks/task_lifecycle_hooks.go:35`), allowing selective hooking into specific task queue partitions.

## Tradeoffs

1. **Type safety vs. dynamic loading**: Go `init()` registration provides compile-time safety but prevents runtime plugin loading (no shared library / `.so` support). You cannot add a new SQL backend without recompiling.

2. **Code-driven vs. config-driven extension**: Code-driven extension (`ServerOption`) gives full expressiveness but requires embedding the server in custom Go code. Configuration-driven extension (YAML) is simpler for operators but limited in expressiveness.

3. **Interceptor ordering**: Appending custom interceptors after internal ones simplifies composition but limits the ability to intercept before authorization or rate limiting. The TODO in `service/frontend/fx.go:301` acknowledges this.

4. **Experimental APIs**: Marking APIs as experimental enables faster iteration but creates uncertainty for integrators who need stability guarantees. Four `ServerOption` APIs are experimental (`temporal/server_option.go:145,159,167,175`).

5. **Global plugin state**: The SQL plugin `RegisterPlugin` uses a global `sync.Map`-like variable (`common/persistence/sql/store.go:18`). This precludes running multiple server instances with different plugin sets in the same process, though this is rarely needed.

6. **FX framework coupling**: Internal wiring via `fx` provides clean composition but adds a dependency that makes it harder for external contributors to understand the service lifecycle.

## Failure Modes / Edge Cases

1. **Custom DataStoreFactory returns nil**: The persistence layer does not handle nil `DataStoreFactory` gracefully — `common/persistence/client/fx.go:181` would panic or produce a nil-pointer dereference.

2. **Plugin name collision**: `RegisterPlugin` panics on duplicate registration (`common/persistence/sql/store.go:22-24`). This is acceptable for compile-time safety but could cause issues in complex dependency graphs.

3. **Custom archiver returns wrong scheme**: The `ArchiverProvider` caches archivers per scheme (`common/archiver/provider/provider.go:177-183`), so a misconfigured custom factory returning an archiver for the wrong scheme would cause hard-to-debug caching issues.

4. **Interceptor panic propagation**: If a custom gRPC interceptor panics, it could bypass the internal error masking interceptor (`common/rpc/interceptor/mask_internal_error.go`), potentially leaking internal error details.

5. **Dynamic config client performance**: The `Client.GetValue()` documentation warns it's "called very often" (`common/dynamicconfig/client.go:23-25`). A poorly implemented custom client that performs synchronous I/O could severely impact server performance.

6. **Missing custom factory**: If `customVisibilityStoreFactory` is nil but config specifies `CustomDataStoreConfig`, the server logs a fatal error (`common/persistence/visibility/factory.go:285-287`). This is a hard crash rather than a graceful degradation.

## Future Considerations

1. **Runtime plugin loading**: Adding support for Go plugins (`plugin` package) or sidecar-based SQL backend loading would close the gap to score 10.

2. **Extension point documentation**: A single `EXTENSIONS.md` documenting all extension points with examples would dramatically improve discoverability.

3. **Stabilizing experimental APIs**: The 4 experimental `ServerOption` APIs (`WithCustomDataStoreFactory`, archiver factories, `WithClientFactoryProvider`) should be graduated or replaced with stable equivalents.

4. **Inner custom interceptor support**: The TODO at `service/frontend/fx.go:301` ("Deprecate WithChainedFrontendGrpcInterceptors and provide a inner custom interceptor") would let custom interceptors sit between auth and business logic — a valuable addition.

5. **Breaking change policy**: A formal API versioning or deprecation policy for extension interfaces would improve confidence for adopters.

6. **Custom matching strategies**: Making the matching engine's task assignment algorithm extensible would enable advanced use cases like affinity-based scheduling.

## Questions / Gaps

1. **No evidence found** of a formal breaking change policy or deprecation process for extension interfaces beyond the experimental markers.

2. **No evidence found** of user-facing documentation explaining how to implement a custom `DataStoreFactory`, custom archiver, or custom visibility store — these are only discoverable via source code.

3. **No evidence found** of end-to-end tests for the custom datastore or custom archiver extension points, making it unclear if these interfaces are exercised outside of the built-in implementations.

4. **No evidence found** of SDK-level `PayloadCodec` usage in this repo (the interface exists in `go.temporal.io/sdk/converter` but is not referenced in server code).

5. **No evidence found** of extension point versioning or compatibility guarantees — the experimental markers hint at future changes but provide no timeline or migration path.

6. **No evidence found** of a registry or discovery mechanism for extension points — they must be discovered by reading `temporal/server_option.go` and service `fx.go` files.

---

Generated by `study-areas/21-extensibility.md` against `temporal`.
