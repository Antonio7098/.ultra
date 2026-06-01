# Dimension 01: Review Entrypoints & Platform Integrations — gerrit-ai-youtube

## Source Information

- **Name**: Harnessing the power of AI in the Gerrit Code Review process
- **Type**: Conference talk (YouTube transcript) — Gerrit User Summit
- **Source**: <https://www.youtube.com/watch?v=vgp4tHoBlhY>
- **Subject**: Gerrit Code Review AI integration, history, and future roadmap
- **Applicable Dimensions**: 01, 04, 10, 13

---

## Supported Entrypoints

This is a **design talk** describing Gerrit's built-in and planned AI features. No runnable tool is analyzed — the talk describes entrypoints that Gerrit itself provides.

### 1. Built-in AI Prompt Generation (Gerrit 3.13+)

Gerrit 3.13 ships with a built-in prompt generator accessible from the change UI. The user selects a suggestion type (general change review, patch set review, code review, or commit message improvement), copies the generated prompt, pastes it into an LLM of their choice (ChatGPT, Gemini, etc.), and receives suggestions back. The user then manually chooses which suggestions to keep as review comments. This is **not automated** — it requires manual copy-paste.

Referenced in transcript: `gerrit-ai-youtube.md:141-158` — "Gerrit 313 has the ability to generate the prompt ... you can copy and paste that one into your AI and get it back."

### 2. Legacy Plugin Approach (deprecated as of Gerrit 3.13)

Three forked plugins existed prior to 3.13, now all deprecated:
- The original "charg co" plugin (2023) — sent change content to ChatGPT via a hook, posted full output as a comment.
- Amorula Solutions fork — evolved version of the original.
- Sirata's fork ("AI Code Review" + llama support) — added on-premises LLM support.

Referenced: `gerrit-ai-youtube.md:53-89` — "three forks ... none of them are actually a good approach."

### 3. Planned Sidebar AI Assistant

A design proposal (led by SAP) describes a future inline AI sidebar in the Gerrit UI where developers can interact with an LLM in real time — similar to Cursor's AI sidebar. AI would propose fixes; the developer would review and accept or reject each suggestion.

Referenced: `gerrit-ai-youtube.md:296-318` — "create a site on Garrett where you can interact with the LM."

### 4. Gerrit MCP Server (planned, by Google)

Google is building and donating a Gerrit MCP (Model Context Protocol) server to the community. This would allow AI agents to interact with Gerrit programmatically — query changes, propose patches, integrate issue tracker context.

Referenced: `gerrit-ai-youtube.md:319-373` — "Google actually has been working behind the scenes in building something brand new that is called a Gary MCP server."

### 5. No GitHub App, No GitHub Action, No CI Pipeline Trigger

The AI integration is entirely **within the Gerrit UI** — there is no webhook receiver, no CI job, no GitHub/GitLab App that triggers AI reviews automatically. The model is "AI proposes, human decides."

---

## Authentication Model

No AI-specific authentication model is described in the talk. The speaker focuses on the UX and design of the AI feature, not on how Gerrit authenticates with external LLM services.

- Gerrit itself handles standard authentication (not covered in this talk).
- The prompt-copy-paste workflow requires the user to have their own LLM API key or subscription (ChatGPT, Gemini, etc.).
- The planned MCP server would likely use Gerrit's existing auth mechanisms (not specified in the transcript).
- The SAP design proposal mentions making LLMs pluggable and possibly moving prompt generation to the back end.

Referenced: `gerrit-ai-youtube.md:258-292` — "move the logic of generating the prompt on the back end ... making LLM pluggable."

---

## Platform-Specific Assumptions

### Gerrit-Centric Design

The entire talk assumes **Gerrit** as the code review platform. There is no discussion of GitHub, GitLab, Bitbucket, or Azure DevOps integration.

### Human-in-the-Loop Model

The core design principle is that AI should assist rather than replace the reviewer. The approach:
1. User triggers AI suggestion generation from the Gerrit UI.
2. User copies prompt to LLM of their choice.
3. User gets suggestions back manually.
4. User curates suggestions — only selected ones become review comments.

This is fundamentally different from CodeRabbit, Danger, or similar tools that auto-post review comments. The speaker explicitly calls this out: "that is not AI giving review. You give review, AI will tell you some suggestions."

Referenced: `gerrit-ai-youtube.md:187-201` — "the approach is not to do the server talking to the AI but involving the communication with the developer."

### Robot Comments Deprecated

Gerrit 3.13 deprecates robot comments entirely. Any plugin that auto-generates comments receives a "Robot comments not supported" error in the UI.

Referenced: `gerrit-ai-youtube.md:134-138`, `gerrit-ai-youtube.md:187-192`.

### Front-End vs Back-End Tradeoff

Google chose client-side AI prompt generation to avoid abuse of LLM APIs (cost control). The talk acknowledges this tradeoff — keeping AI on the front end prevents the Gerrit server from incurring LLM costs but creates a poorer user experience (manual copy-paste).

Referenced: `gerrit-ai-youtube.md:280-292` — "Google decided on the front end because in that way you you can avoid the let's say abuse lms can be very expensive."

### MCP Server as a New Entrypoint

The Gerrit MCP server represents a new type of entrypoint — AI agents can interact with Gerrit programmatically. This goes beyond the UI-centric approach and enables automated workflows.

---

## Operational Tradeoffs

### Strengths

1. **No noise in review history**: Because AI suggestions are curated by the human, irrelevant suggestions never appear as comments. This prevents metadata bloat (the speaker notes a customer case of "one million comments on a change").

2. **LLM vendor agnostic**: The built-in prompt mechanism works with any LLM — ChatGPT, Gemini, local llama, etc. The user provides their own LLM.

3. **Self-hosted, no SaaS dependency**: Gerrit is self-hosted, and the AI feature requires no external service beyond the user's chosen LLM.

4. **Community-driven design**: SAP's design proposal is open for community feedback, which increases the chances of a well-architected solution.

5. **No auto-generated spam**: The "human in the loop" model prevents the AI from flooding reviews with low-quality suggestions.

### Weaknesses

1. **Manual copy-paste workflow**: The current UX is extremely awkward: "go to a change, you see the link, you click the link, it opens another window, you copy, then you go to your chat GPT, Gemini, whatever code, you paste it there, you wait five minutes, they will give you the suggestion."

2. **No automated review trigger**: Unlike CodeRabbit or Danger, there's no way to trigger AI review automatically when a new patch set is pushed. Everything requires manual initiation.

3. **No CI/GitHub Action/Webhook entrypoint**: The tool cannot be embedded into CI pipelines or triggered from external systems.

4. **Context problem acknowledged**: The speaker explicitly states that earlier AI plugins "don't have the context" of the change, leading to "syntactical and not mostly useful" output.

5. **No inline comment placement**: The current copy-paste workflow does not produce inline, line-specific comments. The user must manually create review comments.

6. **Incomplete implementation at time of talk**: The prompt generation was approved but not yet merged; the LLM pluggability is still in design; the MCP server is a Google project not yet demonstrated.

### Security Considerations

- The front-end AI approach avoids server-side LLM API keys entirely — the user manages their own keys.
- Robot comment deprecation prevents plugin-based spam/abuse.
- The planned back-end prompt generation could introduce API key management concerns.
- "Human washing" risk raised in Q&A: users may blindly accept AI suggestions without review.

Referenced: `gerrit-ai-youtube.md:389-418` — "can we coin the term human washing?"

---

## Patterns Worth Copying for Ultraplan

1. **Human-in-the-loop by default**: AI suggests, human curates and accepts. This avoids the noise problem that plagues fully automatic review bots.

2. **LLM-agnostic design**: The prompt generation approach works with any LLM. Ultraplan could define a prompt interface that is provider-agnostic.

3. **Server-prompted, client-executed**: The server generates the structured prompt (with full change context), but the API call happens on the client side. This keeps LLM costs off the server.

4. **Pluggable LLM backend**: The design proposal for making LLMs pluggable (swap ChatGPT for Gemini for local llama) is a good pattern.

5. **MCP Server pattern**: Providing a standardized protocol interface for AI agents to interact with the code review system enables rich agent-based workflows beyond simple commenting.

6. **Deprecating noisy patterns**: The decisive deprecation of robot comments shows willingness to break backward compatibility for UX quality. Ultraplan should consider similar hard boundaries.

7. **Sidebar interaction model**: The planned Cursor-like sidebar for real-time AI code suggestions within the Gerrit UI is an interesting UX pattern.

---

## Answers to Study Questions

### Q1: Supported ways to trigger a review

- **Manual UI trigger** (Gerrit 3.13+) — user navigates to a change, clicks to generate a prompt, copies, pastes to LLM, gets suggestions back, manually creates comments.
- **Legacy plugin hooks** (deprecated) — the three forked plugins triggered via Gerrit hooks, sending change content to LLMs.
- **Future MCP server** (planned) — would allow AI agents to trigger reviews programmatically.
- **No automated trigger** — no webhook, no CI pipeline event, no scheduled review.

### Q2: Primary design model

Primarily a **self-hosted server feature** (built into Gerrit core). Not a hosted service, not a CI job, not a standalone CLI. The AI feature is a UI enhancement to the existing self-hosted Gerrit code review server.

### Q3: Authentication with code hosting platform

No specific AI-related auth model is described. The user authenticates to Gerrit via its existing mechanisms. LLM access is managed by the user independently (API keys, subscriptions). The planned back-end prompt generation would require Gerrit to authenticate to LLM services — details not yet designed.

### Q4: Repository permissions required

Not specified in the talk. Since the AI feature is built into Gerrit, it uses the existing Gerrit permission model. No additional permissions beyond standard Gerrit access are mentioned.

### Q5: Installation difficulty in private repo

**Very easy** — for Gerrit 3.13+, no installation is required. The AI prompt generation is built into the server. For older Gerrit versions, users would need to install one of the three deprecated plugins (now broken due to robot comment deprecation). No plugin installation is needed for the 3.13+ feature.

### Q6: Security or operational risks

- **Human washing risk**: Users may blindly accept AI suggestions, bypassing genuine review (`gerrit-ai-youtube.md:389-418`).
- **Context limitation**: Without full codebase context, AI may produce incorrect or misleading suggestions.
- **Noise if unchecked**: The speaker notes a case of "one million comments on a change" from automated AI review — the human-in-the-loop model prevents this.
- **LLM cost uncertainty**: If prompt generation moves server-side, LLM API costs become an operational concern (`gerrit-ai-youtube.md:280-292`).
- **No automated security scanning**: The design does not integrate vulnerability detection or automated security review.

### Q7: Easiest integration model to adapt for Ultraplan

The **human-in-the-loop prompt generation model** is the most relevant pattern. Specifically:

- The server generates a structured prompt with full change context.
- The user independently invokes the LLM (avoiding server-side API keys and costs).
- The user curates results before they become review comments.

This model avoids the two hardest problems in automated review:
1. **False positive noise** — since humans curate, low-quality suggestions never reach the review.
2. **API cost and key management** — since the user brings their own LLM, the server incurs no cost.

For Ultraplan, a hybrid approach could work: optionally automate the LLM call server-side (for convenience) while keeping the human-curation step, and provide a CI/webhook entrypoint that triggers the initial prompt generation automatically.

---

## Rating

**Score: 4/10**

| Axis | Score | Rationale |
|---|---|---|
| Workflow fit | 3 | The current copy-paste workflow is extremely awkward. No automatic trigger. A future sidebar design may improve this significantly. |
| Installation complexity | 8 | Zero installation for Gerrit 3.13+ — built into core. Plugin installation for older versions is deprecated. |
| Permission minimization | 7 | No additional permissions required beyond standard Gerrit access. User manages own LLM keys independently. |
| Portability | 2 | Entirely Gerrit-specific. No support for GitHub, GitLab, Bitbucket, or Azure DevOps. |
| Self-hostability | 9 | Fully self-hosted. No SaaS dependency for the server. User provides own LLM. |

**Rationale**: The Gerrit AI feature is thoroughly Gerrit-specific, with no support for other code review platforms. The current UX (copy-paste to LLM) is the weakest entrypoint design of any tool in this study. The planned sidebar and MCP server may improve this significantly, but neither was implemented at the time of the talk. The deprecation of robot comments and the human-in-the-loop philosophy are principled design choices that prevent noise, but the current implementation offers no automation at all. The MCP server is the most promising pattern for programmatic access, but it is still in development.

**Fast heuristic**: "Could I add this review agent to a private GitHub repo in under an hour?" — **No**, because this feature is built into Gerrit and has no GitHub integration. It would require running a Gerrit server and manually using the copy-paste workflow.
