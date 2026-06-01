# Study: Dimension 01 — Review Entrypoints & Platform Integrations

**Source:** `qwen-code-review` (Qwen Code, `@qwen-code/qwen-code` v0.17.0)
**Repository:** `https://github.com/QwenLM/qwen-code`

---

## Overview

Qwen Code is an open-source AI coding agent that lives primarily in the terminal. It supports a wide range of entrypoints — from interactive TUI and headless CLI to GitHub Actions PR review, messaging platform bots, a local HTTP daemon, IDE extensions (VS Code, Zed), an Agent Communication Protocol (ACP) mode, and a TypeScript SDK. The project's package structure (`package.json`:2) shows workspaces for CLI, core, SDK, channels, ACP bridge, web templates, VS Code companion, and a Zed extension.

---

## 1. Supported Entrypoints

### 1.1 Interactive Terminal UI (Primary)

- **Command:** `qwen` (no arguments)
- **Entrypoint:** `packages/cli/src/gemini.tsx:400` (`main()`)
- **Bin:** `packages/cli/package.json:13` (`"qwen": "dist/index.js"`)
- When invoked with no arguments on a TTY, the tool launches a full-screen Ink/React TUI (`gemini.tsx:920-958`) built on Ink v7 + React 19.

### 1.2 Headless / Non-Interactive CLI

- **Command:** `qwen -p "prompt"` or `echo "prompt" | qwen`
- **Entrypoint:** `packages/cli/src/gemini.tsx:1045-1111` (stdin pipe path)
- **Core loop:** `packages/cli/src/nonInteractiveCli.ts:191` (`runNonInteractive`)
- Supports `--output-format text|json|stream-json` and `--input-format text|stream-json`.

### 1.3 GitHub Actions PR Review

- **Workflow:** `.github/workflows/qwen-code-pr-review.yml:1-190`
- Uses `pull_request_target` and `issue_comment` events to trigger reviews.
- Runs the `QwenLM/qwen-code-action@5fd6818d` GitHub Action.
- Supports review on PR open, `@qwen /review` command in comments, and `workflow_dispatch`.
- PR metadata is fetched via `gh` CLI within the Action runner.

### 1.4 HTTP Daemon (`qwen serve`)

- **Command:** `qwen serve --port 4170`
- **Entrypoint:** `packages/cli/src/commands/serve.ts:51-267`
- **Implementation:** `packages/cli/src/serve/`
- HTTP server built on Express, supporting session management, workspace filesystem access, SSE event streaming, and MCP guardrail enforcement.
- Uses `http-bridge` mode (Stage 1) where a single `qwen --acp` child process handles all sessions.

### 1.5 ACP (Agent Communication Protocol)

- **Command:** `qwen --acp`
- **Entrypoint:** `packages/cli/src/acp-integration/acpAgent.ts`
- Used by the Zed extension and the `qwen serve` daemon's http-bridge.
- Implements the `@agentclientprotocol/sdk` protocol for IDE integration.

### 1.6 Messaging Channel Bots

- **Command:** `qwen channel start <type>`
- **Entrypoint:** `packages/cli/src/commands/channel.ts:23-36`
- Supported platforms: Telegram (`packages/channels/telegram/`), WeChat (`packages/channels/weixin/`), DingTalk (`packages/channels/dingtalk/`), Feishu/Lark (`packages/channels/feishu/`).
- **Base abstraction:** `packages/channels/base/src/ChannelBase.ts:17` (`ChannelBase` abstract class)
- Each channel connects to its respective messaging platform, translates incoming messages into ACP prompts, and streams responses back.

### 1.7 MCP Server Management

- **Command:** `qwen mcp add|remove|list|reconnect`
- **Entrypoint:** `packages/cli/src/commands/mcp.ts:14`
- Manages Model Context Protocol server configurations.

### 1.8 IDE Extensions

- **VS Code:** `packages/vscode-ide-companion/` — a VS Code extension (`package.json:2`) that provides a webview-based chat sidebar, diff editor, and runs `qwen` commands.
- **Zed:** `packages/zed-extension/` — a Zed extension using ACP for communication.

### 1.9 TypeScript SDK

- **Package:** `@qwen-code/sdk` (`packages/sdk-typescript/`)
- **Entrypoint:** `packages/sdk-typescript/src/index.ts`
- Provides `query()` for headless prompt execution, `DaemonClient` for connecting to `qwen serve`, and `createSdkMcpServer()` for creating MCP servers that wrap the SDK.

### 1.10 /review Command Helpers

- **Command:** `qwen review fetch-pr|pr-context|load-rules|deterministic|presubmit|cleanup`
- **Entrypoint:** `packages/cli/src/commands/review.ts:19-39`
- These are deterministic subcommands used by the `/review` skill internally, not user-facing review triggers. They handle worktree setup, PR context fetching, rules loading, deterministic linting, presubmit checks, and cleanup.

---

## 2. Authentication Model

### 2.1 LLM Provider Authentication

- API auth is **not a dedicated subcommand** — `qwen auth` was removed (`packages/cli/src/commands/auth.ts:22-23`), replaced by environment variables and `/auth` interactive slash command.
- Supports: OpenAI API key (`OPENAI_API_KEY`), Anthropic, Gemini, Vertex AI, Alibaba Cloud Coding Plan, OpenRouter.
- Providers are configured via `~/.qwen/settings.json` or env vars.

### 2.2 GitHub Authentication

- The PR review workflow uses `secrets.GITHUB_TOKEN` for repo access in GitHub Actions (`.github/workflows/qwen-code-pr-review.yml:53`).
- For local PR review (`qwen review fetch-pr`), authentication is via the `gh` CLI, verified by `gh auth status` (`packages/cli/src/commands/review/lib/gh.ts:61-68`, `ensureAuthenticated`).
- No GitHub App tokens are used — the tool relies entirely on the `gh` CLI being pre-authenticated with appropriate scopes.

### 2.3 HTTP Daemon Authentication

- `qwen serve` supports bearer token auth (`--token`, `QWEN_SERVER_TOKEN` env var, `--require-auth` flag) (`packages/cli/src/commands/serve.ts:69-73,98-108`).
- Loopback (`127.0.0.1`) connections are auth-free by default; `--require-auth` forces token on all interfaces.

### 2.4 Channel Authentication

- Each channel config has a `token` field in `ChannelConfig` (`packages/channels/base/src/types.ts:29`).
- Token is obtained out-of-band from the respective platform (e.g., Telegram Bot Token from BotFather).

### 2.5 SDK Authentication

- The SDK authenticates by spawning a `qwen` subprocess with env vars (implicit credential passing) or by connecting to a daemon that has already authenticated.

---

## 3. Platform-Specific Assumptions

### 3.1 GitHub-Only PR Review

- The PR review workflow is **exclusively GitHub**. There are no GitLab, Bitbucket, Azure DevOps, or Gitea integrations.
- The `qwen review fetch-pr` subcommand uses `gh` CLI and `git` with `pull/<n>/head` refs (`packages/cli/src/commands/review/fetch-pr.ts:101`).
- PR context fetching assumes the `gh` CLI is installed and authenticated.
- The `owner_repo` parameter format is `"owner/repo"` — GitHub convention (`fetch-pr.ts:89-90`).

### 3.2 GitHub Actions Runtime

- The `qwen-code-pr-review.yml` workflow runs on `ubuntu-latest` (`:43`) and requires `contents: read`, `id-token: write`, `pull-requests: write`, `issues: write` permissions (`:44-48`).
- The Action itself (`QwenLM/qwen-code-action`) is a pinned commit — not a GitHub App.
- The model's API key must be added as a repository secret (`secrets.OPENAI_API_KEY`).

### 3.3 Sandbox Container

- The tool assumes Docker or Podman for sandboxed execution, configured via `tools.sandbox` setting.
- The default sandbox image is `ghcr.io/qwenlm/qwen-code:0.17.0` (`package.json:22`).
- The Dockerfile (`Dockerfile:1-73`) embeds `gh`, `git`, `jq`, `ripgrep`, and other CLI tools — assumes a Linux container.

### 3.4 Node.js Environment

- Requires `node >= 22` (`package.json:5`) due to Ink 7 + React 19 requirements.
- ESM modules throughout.

---

## 4. Operational Tradeoffs

### 4.1 Strengths

- **Multi-entrypoint design:** The same core engine powers CLI, TUI, GitHub Actions, messaging bots, IDE integrations, HTTP daemon, and SDK. The review engine is shared.
- **Platform channel abstraction:** `ChannelBase` (`packages/channels/base/src/ChannelBase.ts:17`) cleanly separates platform-specific transport from prompt/review logic. Adding a new messaging platform requires implementing `connect()`, `sendMessage()`, and `disconnect()`.
- **No GitHub App dependency:** The tool avoids the complexity of GitHub App installation, webhook setup, and permission manifests. Instead, it uses the `gh` CLI (for local scenarios) and `GITHUB_TOKEN` (for Actions scenarios) for authentication.
- **Self-hosted by design:** Everything runs locally — no SaaS dependency. The Dockerfile enables containerized deployment.
- **Dual output:** `--json-fd` / `--json-file` allows the TUI to run alongside structured JSON output (`gemini.tsx:265-281`), enabling IDE/CI integration without losing the interactive experience.
- **ACP protocol:** Standardized agent communication enables IDE-agnostic integration (both Zed and VS Code can use it).

### 4.2 Weaknesses

- **No native GitLab/GitHub App support:** The PR review workflow is GitHub Actions-only. There is no webhook server, no GitLab MR integration, and no GitHub App server that could be self-hosted. The tool cannot receive push-based webhook events — it only works when triggered by a workflow dispatch or `pull_request_target` event.
- **PR review is a workflow, not a service:** Because PR review runs as a GitHub Action, it has a 15-minute timeout (`qwen-code-pr-review.yml:42`) and cannot persist state between runs. There is no way to have a persistent review bot that watches a repo.
- **Channel bots require SSH tunnel or public endpoint:** The Telegram, WeChat, DingTalk, and Feishu channels require the platform to reach the running `qwen channel start` process via webhooks or polling. This means the bot process must be exposed to the internet or use long-polling (Telegram supports polling natively via `grammy`).
- **No built-in CI/CD integration beyond GitHub Actions:** No Jenkins, CircleCI, GitLab CI, or other CI system integrations are provided out of the box. Users would need to wrap the CLI (`qwen -p "review this diff"`) in their CI scripts manually.
- **No pull-based update mechanism:** The tool uses `update-notifier` to check for updates, but the user must manually trigger the update.
- **API key management:** The CLI exposes `--openai-api-key` as a command-line argument (`config.ts:761-764`), which is visible to other processes via `/proc/<pid>/cmdline` (noted in `serve.ts:161-169`).

### 4.3 Security Considerations

- The PR workflow grants `pull-requests: write` permissions — the Action can post comments as the workflow bot.
- The GitHub Actions workflow uses `pull_request_target` (`.github/workflows/qwen-code-pr-review.yml:4`), which runs in the context of the base branch with access to secrets. The workflow includes a guard that restricts execution to OWNER, MEMBER, and COLLABORATOR associations (`:22-25`), mitigating fork-based attacks.
- `QwenLM/qwen-code-action` is pinned to a specific commit SHA (`5fd6818d04d64e87d255ee4d5f77995e32fbf4c2`), preventing supply-chain attacks from tag mutability.
- The `qwen serve` daemon warns about `--token` being visible in `/proc/<pid>/cmdline` (`serve.ts:160-169`), pointing operators toward the env var path instead.
- Channel bots support `senderPolicy: 'allowlist' | 'pairing' | 'open'` (`packages/channels/base/src/types.ts:4`) and `GroupGate` for access control.

---

## 5. Patterns Worth Copying

### 5.1 ACP Bridge Abstraction

The ACP Bridge (`packages/acp-bridge/`) provides a clean transport abstraction that decouples the agent from the UI/IDE. The same `AcpBridge` interface (`packages/channels/base/src/AcpBridge.ts`) is used by the CLI, messaging channels, the HTTP daemon, and VS Code. Ultraplan could adopt a similar protocol abstraction to support multiple frontends.

### 5.2 Channel Plugin Architecture

The channel system (`packages/channels/base/src/types.ts:100-120`, `ChannelPlugin` interface) defines a minimal plugin contract: `channelType`, `displayName`, `requiredConfigFields`, and `createChannel()`. This makes adding a new messaging platform straightforward without modifying core code.

### 5.3 Deterministic Review Subcommands

The `qwen review fetch-pr|pr-context|load-rules|deterministic|presubmit|cleanup` pattern (`packages/cli/src/commands/review.ts:19-39`) decomposes the review workflow into testable, single-responsibility CLI commands. Each subcommand produces JSON output that can be consumed by the LLM or piped into the next step. This is a clean pattern for building review pipelines.

### 5.4 Dual Output Mode

The `--json-fd` / `--json-file` dual output mechanism (`gemini.tsx:265-281`) allows running the rich TUI while also streaming structured JSON to a file descriptor for programmatic consumption. This is valuable for integrating a terminal UI with external tooling without sacrificing the interactive experience.

### 5.5 Sandbox Isolation

The `Dockerfile` and `start_sandbox()` mechanism demonstrate a clear pattern for sandboxing the agent at both build and runtime. The taint-checking mode (`packages/core/`) provides an additional layer of security for tool execution.

---

## 6. Questions Answered

### 6.1 What are the supported ways to trigger a review?

- **GitHub Actions:** Automatic on PR open, or on-demand via `@qwen /review` comment or `workflow_dispatch`.
- **Local CLI:** `qwen review fetch-pr` and related subcommands for local PR review setup.
- **Interactive (/review skill):** Within a `qwen` session, the `/review` slash command runs the review pipeline.

### 6.2 Is the tool designed primarily as a hosted service, self-hosted service, CI job, or local CLI?

**Primarily a self-hosted local CLI tool** that also functions as a CI job (GitHub Action), a local HTTP daemon, a messaging bot, and an IDE companion. It is **not** a hosted SaaS — there is no cloud-hosted version.

### 6.3 How does it authenticate with the code hosting platform?

- **GitHub Actions:** Uses `secrets.GITHUB_TOKEN` provided by the Actions runtime (`.github/workflows/qwen-code-pr-review.yml:53`).
- **Local (gh CLI):** Uses pre-authenticated `gh` CLI verified by `gh auth status` (`packages/cli/src/commands/review/lib/gh.ts:61-68`).
- There is **no GitHub App authentication** anywhere in the codebase.

### 6.4 What repository permissions does it require?

- **GitHub Action permissions:** `contents: read`, `id-token: write`, `pull-requests: write`, `issues: write` (`.github/workflows/qwen-code-pr-review.yml:44-48`).
- **Local `gh` CLI:** Requires whatever scopes the user configured in `gh auth login` (typically `repo` scope for private repos).

### 6.5 How hard would it be to install this in a private repo?

**Easy (< 30 minutes).** Steps:
1. Add the workflow `.github/workflows/qwen-code-pr-review.yml` to the repo.
2. Add an OpenAI API key as `OPENAI_API_KEY` repository secret.
3. Optionally configure `OPENAI_BASE_URL` and `OPENAI_MODEL` secrets.
4. The workflow restricts review to OWNER/MEMBER/COLLABORATOR by default.

### 6.6 Does the integration model create security or operational risks?

- `pull_request_target` runs in the base branch's context with secret access, but the workflow guards against non-collaborator triggers. The risk is mitigated but not eliminated.
- API keys visible in process listings when using `--openai-api-key` flag. The warning in `serve.ts:160-169` acknowledges this.
- Channel bots expose the agent to untrusted user input from messaging platforms. The `SenderGate` and `GroupGate` access controls (`ChannelBase.ts:53-64`) mitigate this at the application level.

### 6.7 Which integration model would be easiest to adapt for Ultraplan?

1. **GitHub Action workflow** — most straightforward. Copy the `qwen-code-pr-review.yml` pattern, swap the action reference. Requires minimal setup and fits naturally into PR workflows.
2. **Channel plugin model** — the `ChannelBase` abstraction is clean and requires only implementing `connect()`, `sendMessage()`, and `disconnect()` to support a new platform.
3. **CLI subcommand pattern** — `qwen review fetch-pr|deterministic|presubmit` shows how to decompose a review into testable, composable CLI commands that produce JSON output for LLM consumption.

---

## 7. Rating

**Score: 7/10**

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Workflow fit | 8 | The GitHub Action fits PR review naturally. The review produces structured feedback matching common review formats. |
| Installation complexity | 7 | GitHub Action install is simple (copy workflow, add API key secret). Local CLI install requires Node.js 22 and npm. |
| Permission minimisation | 7 | GitHub Action requests only `contents: read`, `pull-requests: write`, `issues: write`. No GitHub App which would require broader org-level permissions. |
| Portability | 6 | Review engine is portable (the same core runs everywhere), but PR integration is **GitHub-only**. No GitLab, Bitbucket, or self-hosted Git support. |
| Self-hostability | 9 | Fully self-hostable — no SaaS dependency. Runnable via npm, Docker, Homebrew, or standalone installer. |
| Multi-entrypoint | 8 | Exceptional breadth: TUI, CLI, HTTP daemon, ACP, messaging bots, GitHub Action, VS Code, Zed, SDK. |

The deduction from 8-9 to 7 is driven by the **lack of platform diversity for PR review** (GitHub only) and the **absence of a persistent webhook-based or GitHub App-based review model** that would allow running a review service continuously rather than per-event.
