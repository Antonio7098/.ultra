# Repo Analysis: opa

## 21 Extensibility Analysis

### Repo Info

| Field | Value |
|-------|-------|
| Name | opa |
| Path | `repos/opa` |
| Language / Stack | Go |
| Analyzed | 2026-05-17 |

## Summary

OPA provides a layered, well-defined extensibility architecture with four main extension dimensions: (1) a **plugin system** with formal Factory/Plugin interfaces and lifecycle management, (2) a **built-in function registry** (in Go) with both global registration and per-query injection, (3) a **hook system** for intercepting config, cache, and bundle lifecycle events, and (4) **storage/bundle interfaces** (Store, DirectoryLoader, Activator, FileLoader) that allow swapping backends, loaders, and activation strategies. The system scores in the 7-8 range: well-defined interfaces with documentation and real-world usage, but lacking a formal plugin versioning/discovery mechanism and a plugin marketplace.

## Rating

**7/10** — Well-defined extension interfaces (Plugin, Factory, Store, DirectoryLoader, Activator, BuiltinFunc, hooks) with documentation and stable APIs. However, no formal plugin versioning API, no plugin discovery beyond Go `init()` registration, and no lifecycle contract enforcement beyond the three-method Plugin interface.

## Evidence Collected

Every entry MUST include a file path with line numbers. Format: `path/to/file.ts:NN`.

| Area | Evidence | File:Line |
|------|----------|-----------|
| Plugin interface | `Plugin` defines `Start(ctx)`, `Stop(ctx)`, `Reconfigure(ctx, config)` | `v1/plugins/plugins.go:106-110` |
| Factory interface | `Factory` defines `Validate(manager, config) (any, error)` and `New(manager, config) Plugin` | `v1/plugins/plugins.go:89-92` |
| Global plugin registry | `registeredPlugins map[string]plugins.Factory` populated by `RegisterPlugin()` | `v1/runtime/runtime.go:69-70, 93-97` |
| Built-in plugin registration | `init()` registers `file_logger` factory | `v1/runtime/runtime.go:1138-1142` |
| Plugin lifecycle (Manager.Start) | Iterates plugins calling `Start()` | `v1/plugins/plugins.go:892-896` |
| Plugin lifecycle (Manager.Stop) | Iterates plugins calling `Stop()` with graceful shutdown | `v1/plugins/plugins.go:945-947` |
| Plugin registration with Manager | `Manager.Register(name, plugin)` appends to internal list | `v1/plugins/plugins.go:702-714` |
| Plugin status and listeners | State enum (`NOT_READY`, `OK`, `ERROR`, `WARN`), status loop goroutine, listener pattern | `v1/plugins/plugins.go:127-146, 1066-1073, 1384-1422` |
| Plugin discovery flow | `discovery.getPluginSet()` processes config, calls `Validate()` + `New()`, forwards custom factories | `v1/plugins/discovery/discovery.go:606-704, 740-750` |
| Discovery bundle processing | `processBundle()` evaluates discovery Rego, applies local overrides, reconfigures manager | `v1/plugins/discovery/discovery.go:466-539` |
| Manager reconfiguration | `Manager.Reconfigure()` updates services, keys, caches, fires triggers | `v1/plugins/plugins.go:980-1032` |
| Extra HTTP routes | `Manager.ExtraRoute(path, name, handler)` adds routes | `v1/plugins/plugins.go:788-796` |
| Extra HTTP middlewares | `Manager.ExtraMiddleware(mw...)` inserts middleware chain | `v1/plugins/plugins.go:803-805` |
| Extra authorizer routes | `Manager.ExtraAuthorizerRoute(validator)` registers body-parsing URL validators | `v1/plugins/plugins.go:813-815` |
| Compiler triggers | `Manager.RegisterCompilerTrigger(f)` fires on compiler changes | `v1/plugins/plugins.go:826-830` |
| External rule sources | `Manager.RegisterExternalSource(ref, source)` for remote rule fetching | `v1/plugins/plugins.go:848-859` |
| Hook system interface | `Hooks` is a `map[Hook]struct{}` with `Each()` iteration | `v1/hooks/hooks.go:32-63` |
| ConfigHook | `OnConfig(ctx, *config.Config)` to rewrite base config | `v1/hooks/hooks.go:70-72` |
| ConfigDiscoveryHook | `OnConfigDiscovery(ctx, *config.Config)` to rewrite discovery config | `v1/hooks/hooks.go:76-78` |
| InterQueryCacheHook | `OnInterQueryCache(ctx, cache)` to access server cache | `v1/hooks/hooks.go:83-85` |
| BundlePreActivateHook | `OnBundlePreActivate(ctx, name, manifest)` to inspect bundle manifest before activation | `v1/hooks/hooks.go:96-98` |
| Triggerable interface | Optional `Trigger(ctx) error` for manual plugin triggering | `v1/plugins/plugins.go:113-115` |
| LoggerPlugin interface | Extends Plugin with `Logger() slog.Handler` | `v1/plugins/plugins.go:118-123` |
| Store interface | `Store` embeds `Trigger`, `Policy`; defines `Read`, `Write`, `Commit`, `Truncate` | `v1/storage/interface.go:19-44` |
| Trigger interface | `Register(ctx, Transaction, TriggerConfig) TriggerHandle` with `OnCommit` callback | `v1/storage/interface.go:234-236` |
| Policy interface | `ListPolicies`, `GetPolicy`, `UpsertPolicy`, `DeletePolicy` | `v1/storage/interface.go:151-156` |
| Store Closer interface | Optional `Close(ctx) error` for graceful shutdown | `v1/storage/interface.go:61-63` |
| Custom store via Params | `runtime.Params.StoreBuilder` for injecting custom storage | `v1/runtime/runtime.go:256` |
| Custom storage backends | `runtime.RegisterStorageBackend(builder)` global registry | `v1/runtime/runtime.go:102-106` |
| In-memory store impl | In-memory store with trigger support and bulk truncate | `v1/storage/inmem/inmem.go:101-117` |
| Bundle DirectoryLoader interface | `NextFile()`, `WithFilter()`, `WithPathFormat()`, `WithSizeLimitBytes()` | `v1/bundle/file.go:123-131` |
| Bundle FS Loader | `NewFSLoader(fsys)` loads bundles from any `io/fs.FS` | `v1/bundle/filefs.go:31` |
| Custom bundle reader | `NewCustomReader(loader)` takes any `DirectoryLoader` | `v1/bundle/bundle.go:508-516` |
| Bundle Activator interface | `Activate(*ActivateOpts) error` for custom activation strategy | `v1/bundle/store.go:350-352` |
| Bundle activator registry | `RegisterActivator(id, activator)` global map | `v1/bundle/store.go:1263-1271` |
| BundleExtStore | Global `BundleExtStore func() storage.Store` and `RegisterStoreFunc()` | `v1/bundle/bundle.go:449, 465-470` |
| FileLoader interface | `WithFS(fs.FS)`, `WithReader(io.Reader)`, `WithFilter(Filter)`, `WithBundleLazyLoadingMode()` | `v1/loader/loader.go:92-110` |
| Custom file extension handler | `RegisterExtension(name, handler)` registers handler for file extensions | `v1/loader/extension/extension.go:23-31` |
| Loader filter | `LoadFilter func(abspath, info, depth) bool` with `GlobExcludeName` factory | `v1/loader/filter/filter.go:83-88` |
| Built-in function declaration type | `Builtin` struct with Name, Description, Categories, Decl, Infix, Relation, Deprecated, Nondeterministic | `v1/ast/builtins.go:3594-3609` |
| AST builtin registry | `ast.RegisterBuiltin(b)` adds to `Builtins` slice and `BuiltinMap` | `v1/ast/builtins.go:22-40` |
| Built-in implementation type | `BuiltinFunc func(bctx BuiltinContext, operands []*ast.Term, iter func(*ast.Term) error) error` | `v1/topdown/builtins.go:68` |
| Topdown builtin registry | `topdown.RegisterBuiltinFunc(name, f)` populates private `builtinFunctions` map | `v1/topdown/builtins.go:91-93, 127` |
| Per-query custom builtins | `Query.WithBuiltins(map[string]*Builtin)` for injecting custom builtins per query | `v1/topdown/query.go:216-221` |
| Builtin lookup at eval | `eval.builtinFunc(name)` checks AST map, then global registry, then per-query map | `v1/topdown/eval.go:211-226` |
| Builtin error wrapper | `builtinErrorWrapper` ensures error wrapping with location info | `v1/topdown/builtins.go:129-137` |
| BuiltinContext | Full eval context: seed, time, cache, tracers, round tripper, request metadata | `v1/topdown/builtins.go:37-61` |
| Rego package for embedding | `rego.New()` with `WithBuiltins()`, `WithStore()`, `WithHooks()` etc. | `v1/rego/rego.go:74-82` |
| SDK embedding | `sdk.New(ctx, opts)` with `Options.Plugins` map, `ManagerOpts`, `Hooks` | `v1/sdk/opa.go:43-55, 66-131` |
| SDK decision options | `DecisionOptions` with `Now`, `Path`, `Input`, `NDBCache`, `StrictBuiltinErrors`, `Tracer`, `Metrics` | `v1/sdk/opa.go:359-370` |
| SDK partial result mapping | `PartialQueryMapper` interface for custom partial eval result mapping | `v1/sdk/opa.go:499-504` |
| Capabilities for versioned builtins | `capabilities/` directory with JSON files per version (v0.17.0 through v1.16.2) | `capabilities/v1.16.2.json` (et al.) |
| Config plugins section | `Plugins map[string]json.RawMessage` for custom plugin config | `v1/config/config.go:93` |
| Decision log masking | Configurable mask decision path at `system/log/mask`, evaluated in Rego | `v1/plugins/logs/plugin.go:1048-1100` |
| Decision log dropping | Configurable drop decision path at `system/log/drop`, evaluated in Rego | `v1/plugins/logs/plugin.go:1102-1141` |
| Plugin bundle loader interface | `Loader` interface with `Start`, `Stop`, `Trigger`, `SetCache`, `ClearCache` | `v1/plugins/bundle/plugin.go:50-56` |
| Deprecation shim layer | `plugins/` re-exports from `v1/plugins/` for backward compat | `plugins/plugins.go:73, 87, 141` |
| Server WithHooks | `server.WithHooks(hooks.Hooks)` injects hooks into server initialization | `v1/server/server.go:430-434` |
| Server WithRouter | `server.WithRouter(mux)` injects custom `*http.ServeMux` | `v1/server/server.go:408-413` |
| Decision Logger callback | `server.WithDecisionLoggerWithErr(f func(ctx, *Info) error)` | `v1/server/server.go:391-394` |
| Server handler middleware chain | `ExtraMiddlewares` from plugin manager applied per-request | `v1/server/server.go:947-956` |

## Answers to Protocol Questions

**1. What are the primary extension points?**
- **Plugin system** — 3-method `Plugin` interface + 2-method `Factory`, lifecycle managed by `Manager` (`v1/plugins/plugins.go:89-92, 106-110`). Plugins register globally via `runtime.RegisterPlugin()` (`v1/runtime/runtime.go:93-97`) or per-SDK via `sdk.Options.Plugins`.
- **Built-in functions** — Declare via `ast.RegisterBuiltin()` (`v1/ast/builtins.go:22-40`), implement via `topdown.RegisterBuiltinFunc()` (`v1/topdown/builtins.go:91-93`), or inject per-query via `WithBuiltins()` (`v1/topdown/query.go:216-221`).
- **Storage backends** — `Store` interface + `Trigger` + `Policy` (`v1/storage/interface.go:19-44, 151-156, 234-236`). Register globally via `runtime.RegisterStorageBackend()` (`v1/runtime/runtime.go:102-106`) or per-runtime via `Params.StoreBuilder` (`v1/runtime/runtime.go:256`).
- **Bundle loading** — `DirectoryLoader` interface (`v1/bundle/file.go:123-131`), `Activator` interface (`v1/bundle/store.go:350-352`), `BundleExtStore` global (`v1/bundle/bundle.go:449`), `RegisterExtension()` for custom file types (`v1/loader/extension/extension.go:23-31`).
- **Hooks** — `ConfigHook`, `ConfigDiscoveryHook`, `InterQueryCacheHook`, `InterQueryValueCacheHook`, `BundlePreActivateHook` (`v1/hooks/hooks.go:70-98`).
- **Server** — Custom router injection (`v1/server/server.go:408-413`), extra HTTP routes and middlewares from plugins (`v1/plugins/plugins.go:788-805`), custom metrics (`v1/server/server.go:162-165`), custom decision logger (`v1/server/server.go:391-394`).

**2. How are custom tools/providers added?**
- Custom plugins are added by implementing `Factory` and `Plugin` interfaces, then calling `runtime.RegisterPlugin(name, factory)` in an `init()` function. Configuration goes under `plugins.<name>` in OPA config (`v1/config/config.go:93`). The discovery plugin processes custom factories via `getCustomPlugins()` (`v1/plugins/discovery/discovery.go:740-750`).
- Custom built-in functions are added by creating an `ast.Builtin` declaration, registering it with `ast.RegisterBuiltin()`, implementing a `BuiltinFunc`, and registering it with `topdown.RegisterBuiltinFunc()`. For per-query scoping, `topdown.Query.WithBuiltins()` (`v1/topdown/query.go:216-221`) allows injection without global registration.

**3. Are there hooks/middleware for customization?**
- Yes. Five typed hook interfaces exist (`v1/hooks/hooks.go:70-98`): `ConfigHook` (rewrite base config), `ConfigDiscoveryHook` (rewrite discovery config), `InterQueryCacheHook` / `InterQueryValueCacheHook` (share caches), and `BundlePreActivateHook` (inspect bundle manifest before activation).
- Plugins can register extra HTTP middlewares via `Manager.ExtraMiddleware()` (`v1/plugins/plugins.go:803-805`), added to the per-request handler chain at `v1/server/server.go:947`.
- Compiler triggers via `Manager.RegisterCompilerTrigger()` (`v1/plugins/plugins.go:826-830`) fire callbacks on compiler changes.

**4. Is extension configuration-driven or code-driven?**
- Both. **Configuration-driven**: Plugins are enabled/disabled by their presence in the `plugins` config section (`v1/config/config.go:93`). Decision log masking/dropping is policy-driven at `system/log/mask` and `system/log/drop` (`v1/plugins/logs/plugin.go:1048-1141`). Discovery bundles dynamically reconfigure OPA from downloaded Rego-evaluated config (`v1/plugins/discovery/discovery.go:466-539`).
- **Code-driven**: Plugins are registered in Go `init()` functions (`v1/runtime/runtime.go:1138-1142`). Built-in functions are registered in `init()` across `v1/topdown/*.go` (e.g., `v1/topdown/http.go:267`). Custom storage backends are code-registered (`v1/runtime/runtime.go:102-106`). However, plugin factory registration in `init()` is the standard pattern, making it effectively code-driven with config-driven instantiation.

**5. How stable are extension interfaces?**
- The `Plugin` and `Factory` interfaces have remained stable across versions — unchanged signature across the v1 migration (the `plugins/` layer became a shim re-exporting from `v1/plugins/`).
- The `BuiltinFunc` signature has been stable since its introduction.
- The `Store` interface has evolved with new optional interfaces (`MakeDirer`, `NonEmptyer`, `Closer`) but the core remains backward-compatible.
- The `v1/` package migration (where all core packages moved from root to `v1/`) was a significant refactor, but backward compatibility was preserved via thin shim packages at the old paths (`plugins/plugins.go:73, 87, 141`; `storage/interface.go:11-89`).

**6. How are breaking changes managed?**
- **Capabilities system**: The `capabilities/` directory contains versioned JSON files (`capabilities/v1.16.2.json` etc.) that declare available builtins, features, and wasm ABIs per version. This allows OPA to check backward compatibility when loading bundles compiled with older versions.
- **Deprecation shims**: The `v0`/`v1` split uses shim packages at the old paths that re-export from the new paths.
- **Config deprecation**: The `Bundle` (singular) config field is deprecated in favor of `Bundles` (plural), with backward-compat handling in `config.go`.
- **No formal plugin versioning**: Plugin interfaces have no version field. Breaking changes to plugin contracts are communicated via changelog and release notes only.

**7. What is intentionally NOT extensible?**
- **The Rego language parser and compiler**: While builtins are extensible, the language syntax, grammar, and compiler passes are not. The `ast.Compiler` is internal; users cannot add new syntax constructs.
- **The evaluator core**: The topdown evaluation loop is fixed. Concurrency model, query planning, and indexing are not user-extensible.
- **Authentication/authorization schemes**: Only token-based (Bearer), TLS-based (client cert), and OAuth2 JWT bearer grant are built in. Custom auth schemes require wrapping OPA at the network level.
- **The bundle download subsystem**: The bundle plugin's `Loader` interface (`v1/plugins/bundle/plugin.go:50-56`) is not exported for external implementations — only `download.New()` and `download.NewOCI()` are used internally. File-based loading from `file://` URIs is supported but custom protocol handlers cannot be registered.
- **Wasm compilation**: The wasm compilation pipeline (`compile/`, `internal/compiler/wasm/`) is not currently designed for external extension. Custom target outputs are not supported.

**8. How discoverable are extension points?**
- Plugin system is well-documented in the Go package comments at `v1/plugins/plugins.go` and `v1/runtime/runtime.go:89-97`. However, there is no plugin marketplace or centralized registry beyond the Go `init()` pattern.
- Built-in function registration is documented at `v1/ast/builtins.go:22-40` and `v1/topdown/builtins.go:91-93`, with examples in 100+ `v1/topdown/*.go` files.
- The hook system is documented at `v1/hooks/hooks.go:32-98` but lacks usage examples beyond core usage.
- The capabilities/ directory provides machine-readable version metadata but no human-readable guide to what extensions are available.
- Extension points are largely discovered through reading source code and package comments rather than a single "extension guide."

## Architectural Decisions

| Decision | Rationale | Evidence |
|----------|-----------|----------|
| Three-method Plugin interface (Start/Stop/Reconfigure) | Minimal surface; plugins handle their own sub-lifecycles | `v1/plugins/plugins.go:106-110` |
| Factory pattern separates validation from instantiation | Config validation happens before any plugin state is created | `v1/plugins/plugins.go:89-92` |
| Global plugin registry via Go `init()` | Simple, no external discovery service needed | `v1/runtime/runtime.go:69-70, 93-97` |
| Hooks as interface-based set | Type-safe, extensible without modifying core | `v1/hooks/hooks.go:32-63` |
| Discovery plugin drives dynamic reconfiguration | Centralized reconfiguration from remote bundles | `v1/plugins/discovery/discovery.go:466-539` |
| Store as interface with optional sub-interfaces | Backends implement only what they support (e.g., `MakeDirer`, `Closer`) | `v1/storage/interface.go:19-63` |
| Builtin registry split across ast (decl) and topdown (impl) | Declaration can be consumed without pulling in implementation deps | `v1/ast/builtins.go:22-40`, `v1/topdown/builtins.go:91-93` |
| Per-query builtins override global registry | Allows sandboxed/restricted Rego execution for multi-tenant | `v1/topdown/eval.go:211-226` |
| v1/ package as canonical implementation | Clean separation for major version migration while maintaining backward compat | `plugins/plugins.go:73` (type alias) |
| Decision log masking/dropping via Rego policies | Users write policies to control logging, not code | `v1/plugins/logs/plugin.go:1048-1100` |
| SDK wraps manager + plugins + config | Single `sdk.New()` call for embedding complete OPA | `v1/sdk/opa.go:66-131` |

## Notable Patterns

**Interface-based plugin lifecycle**: Every plugin goes through `Validate → New → Register → Start → Stop` with `Reconfigure` called in-place for config changes. The `Manager` tracks all plugins and handles concurrent lifecycle transitions via mutex (`v1/plugins/plugins.go`).

**Two-registry builtin system**: Built-in functions separate declaration (`ast.Builtin` in `v1/ast/builtins.go`) from implementation (`BuiltinFunc` in `v1/topdown/builtins.go`). The ast registry is purely descriptive (name, type signature, category); the topdown registry provides the evaluatable function. This allows tools like `opa check` to validate builtin usage without loading implementations.

**Hook set, not chain**: `hooks.Hooks` is a `map[Hook]struct{}`, not a chain. Each hook type may have multiple implementations, but they are iterated unordered (`v1/hooks/hooks.go:55-59`). This is a fan-out pattern, not a middleware pipeline.

**Discovery as meta-plugin**: The `discovery` plugin bootstraps from base config, then dynamically downloads bundles that redefine all plugins. This is a form of "self-reconfiguring" architecture (`v1/plugins/discovery/discovery.go:466-539`).

**Shim layer for v1 migration**: Root packages (e.g., `plugins/`, `storage/`, `topdown/`) became thin re-exports of `v1/*` packages. This pattern preserves all existing import paths while allowing the canonical implementation to live in `v1/`.

**Decision logger decoupled into Rego policy**: Rather than fixed masking rules, the decision log plugin evaluates Rego policies at `system/log/mask` and `system/log/drop` (`v1/plugins/logs/plugin.go:1048-1100, 1102-1141`). This is an "extensibility via Rego itself" pattern.

## Tradeoffs

| Tradeoff | Detail |
|----------|--------|
| Global init() registration vs DI | All built-in plugins and builtins register via `init()` — simple but makes testing harder (no DI framework) and prevents runtime removal of unwanted plugins |
| Plugin interface minimalism vs lifecycle guarantees | The 3-method interface is simple, but there is no `PreStart`, `PostStop`, or health-check method — plugins must manage that internally |
| Discovery reconfigures everything vs partial updates | Discovery replaces the entire plugin set on each bundle — simple but wasteful for single-plugin config changes |
| Global builtin registry vs sandboxing | Builtins are globally registered — per-query overrides exist but are opt-in, so multi-tenant isolation requires careful API usage |
| No plugin dependency graph | Plugins cannot express dependencies on other plugins — the Manager does not enforce startup ordering beyond iteration order |
| Rego as extension language vs Go | Masking/dropping/authorization use Rego policies rather than Go plugins — powerful but slower and limited to what Rego can express |
| Capabilities JSON requires manual updates | The capabilities list must be manually updated when builtins are added or removed — no code generation from the registry |

## Failure Modes / Edge Cases

**Plugin startup ordering**: If Plugin A depends on Plugin B, the Manager does not guarantee B starts before A. The `Manager.Start()` iterates `m.plugins` in registration order (`v1/plugins/plugins.go:892-896`), which is append-order from `Register()` calls. This can cause race conditions for interdependent plugins.

**Orphaned plugins on reconfiguration**: When `getPluginSet()` in discovery detects a plugin should be removed, there is no explicit `Stop()` call for the removed plugin (`v1/plugins/discovery/discovery.go:606-704`). The old plugin may continue running if not properly garbage collected.

**Reconfigure called before Start**: `Reconfigure()` may be called before `Start()` if a plugin is registered late during discovery processing. The Plugin interface does not guarantee a state machine, so implementations must handle this defensively.

**Custom builtin name collisions**: `ast.RegisterBuiltin()` and `topdown.RegisterBuiltinFunc()` use flat string names. If two custom builtins register the same name, the last one wins silently — no error is returned.

**No plugin unregistration**: Once registered via `Manager.Register()`, there is no `Unregister()` method. Plugins can only be stopped, not removed from the manager's plugin list.

**Custom extension handler conflicts**: `loader/extension.RegisterExtension()` uses a simple `map[string]Handler` (`v1/loader/extension/extension.go:23-31`). If two handlers register for the same extension, the second silently overwrites the first.

**In-memory store state on restart**: The default storage is in-memory (`v1/storage/inmem/inmem.go:101-117`). If disk storage is not configured, all state is lost on restart. The disk storage implementation is only available if explicitly configured.

## Future Considerations

- **Plugin dependency declarations**: Adding `DependsOn []string` to either Factory or a separate manifest would allow the Manager to compute startup order and detect cycles.
- **Plugin versioning in capabilities**: Adding plugin API version info to the `capabilities/*.json` files would enable version compatibility checks at bundle activation time.
- **Plugin unregistration**: Adding `Manager.Unregister(name)` would allow dynamic plugin removal during discovery reconfiguration.
- **Custom bundle protocol handlers**: Exposing the `Loader` interface (`v1/plugins/bundle/plugin.go:50-56`) for external implementations would allow loading bundles from arbitrary sources (S3, GCS, databases).
- **Code generation for capabilities**: Automatically generating the `capabilities/*.json` files from the builtin registry would prevent stale capability metadata.
- **Authorization plugin interface**: Currently authorization is embedded in the server (`v1/server/authorizer/authorizer.go`). Exposing an `Authorizer` plugin interface would allow custom authz schemes.
- **Custom evaluator targets**: Adding a `Target` plugin interface would allow users to compile Rego to non-Wasm targets (SQL, custom IR, etc.).
- **Well-known extension point documentation**: A single `EXTENSIONS.md` or Go package that enumerates all extension points would dramatically improve discoverability over the current source-code-only approach.

## Questions / Gaps

- No evidence found for a formal plugin versioning or compatibility API. The capabilities system only covers builtin functions and wasm features, not the Plugin/Factory interfaces.
- No evidence found for a plugin marketplace or automated discovery mechanism. Plugins must be compiled into the OPA binary via Go imports.
- No evidence found for extension point documentation beyond package-level Go comments. The OPA docs site (`docs/`) has usage docs but no single "how to extend OPA" page was found in the explored paths.
- No evidence found for how the bundle plugin's `Loader` interface could be implemented outside the `plugins/bundle` package — the interface is unexported in terms of usage pattern, though structurally exported.
- Unclear what happens when discovery plugin delivers a config that references a plugin not registered with the Manager — evidence in `getPluginSet()` (`v1/plugins/discovery/discovery.go:619-623`) shows it returns an error, but the error handling path in `processBundle()` (`v1/plugins/discovery/discovery.go:466-539`) wasn't fully traced.

---

Generated by `study-areas/21-extensibility.md` against `opa`.
