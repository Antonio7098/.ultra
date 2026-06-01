# Dimension 02: PR Diff Ingestion & Normalisation — danger-js

## Source Information

- **Name**: Danger (`danger-js`/Ruby gem `danger`)
- **Repository**: <https://github.com/danger/danger>
- **Language**: Ruby
- **Scope of files reviewed**: `sources/danger-js/lib/danger/**` and `sources/danger-js/spec/**` only
- **Diff-influencing code (entrypoints)**: `lib/danger/scm_source/git_repo.rb:11-25,27-51`, `lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:60-151`, `lib/danger/request_sources/{github,gitlab,bitbucket_server,bitbucket_cloud,vsts,local_only}.rb`

---

## Executive Summary

Danger maintains **two parallel diff representations** that do not talk to each other:

1. A **structured** `Git::Diff` object (delegated to the `schacon/ruby-git` gem) populated by `GitRepo#diff_for_folder` (`lib/danger/scm_source/git_repo.rb:11-25`). The Dangerfile's `git.added_files` / `git.modified_files` / `git.deleted_files` / `git.diff_for_file` API is a thin projection over this object (`lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:60-151`).
2. A **synthesised, text-only unified diff** built lazily by each request source — GitHub (`lib/danger/request_sources/github/github.rb:81-100`), GitLab (`lib/danger/request_sources/gitlab.rb:92-104`), Bitbucket Server (`lib/danger/request_sources/bitbucket_server.rb:63-65`). This second representation exists **only** to compute the platform's required `position` argument for inline comments.

Line mapping is **textual** — Danger walks the unified diff as a `String` line-by-line, counting positions, in `find_position_in_diff` (`lib/danger/request_sources/github/github.rb:455-516`). There is no real diff parser, no per-hunk typed object on the request-source side, and no AST. Bitbucket Server is the lone exception: it consumes a *typed* JSON diff (hunks / segments / lines with `source`/`destination` numbers, see `spec/fixtures/bitbucket_server_api/pr_diff_response.json:1-60` and the consumer at `lib/danger/request_sources/bitbucket_server.rb:200-209`).

**There is no built-in filtering of generated files, lockfiles, vendored files, or binaries** — `lib/` has no occurrence of those concerns outside Ruby's `String#encode("UTF-8", "binary", ...)` mode flag. Whatever the platform API returns is what the position walker sees. The only noise control is the Dangerfile author's `git.modified_files.include?("Gemfile.lock")` check (the docstring example at `lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:33-35`).

**Score: 7/10** — Strong typed local diff object, strong text-based position mapper, production-tested across 5+ code hosts, but no structured diff model on the *output* (comment) side, no built-in noise filtering, no diff size cap, and a default behaviour that posts out-of-range comments and lets the platform 422 them. Heuristic: "Would I trust this to place inline comments on the correct PR lines?" — **Yes** for added/context lines on GitHub/GitLab; **partially** for Bitbucket Cloud / VSTS (no diff lookup) and **partially** for ranged comments on GitHub (only Octokit v8+).

---

## 1. Diff Ingestion Flow

Danger picks one of two diff sources per request source. Both run for the same run; they have no shared schema.

### 1a. Local git (always-on, used by every `GitRepo`-backed host)

`lib/danger/scm_source/git_repo.rb:11-25`:

```ruby
def diff_for_folder(folder, from: "master", to: "HEAD", lookup_top_level: false)
  self.folder = folder
  git_top_level = find_git_top_level_if_needed!(folder, lookup_top_level)

  repo = Git.open(git_top_level)

  ensure_commitish_exists!(from)
  ensure_commitish_exists!(to)

  merge_base = find_merge_base(repo, from, to)
  commits_in_branch_count = commits_in_branch_count(from, to)

  self.diff = repo.diff(merge_base, to)
  self.log = repo.log(commits_in_branch_count).between(from, to)
end
```

The result `self.diff` is a `Git::Diff` object (delegated to the `schacon/ruby-git` library, `lib/danger/scm_source/git_repo.rb:5`). It's stored on `GitRepo` via `attr_accessor :diff, :log, :folder` (`lib/danger/scm_source/git_repo.rb:9`).

The Dangerfile side then exposes the diff as a set of `Danger::FileList` collections (`lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:60-86`):

| Dangerfile accessor | Selection on the typed object | Source line |
|---|---|---|
| `git.added_files` | `@git.diff.select { \|d\| d.type == "new" }.map(&:path)` | `dangerfile_git_plugin.rb:60-62` |
| `git.deleted_files` | `@git.diff.select { \|d\| d.type == "deleted" }.map(&:path)` | `dangerfile_git_plugin.rb:68-70` |
| `git.modified_files` | `@git.diff.select { \|d\| d.type == "modified" }.map(&:path)` | `dangerfile_git_plugin.rb:76-78` |
| `git.renamed_files` | `@git.renamed_files` (a custom shell call, not the typed object) | `dangerfile_git_plugin.rb:84-86` |
| `git.diff` | `@git.diff` — the `Git::Diff` itself | `dangerfile_git_plugin.rb:92-94` |
| `git.lines_of_code` | `@git.diff.lines` | `dangerfile_git_plugin.rb:100-102` |
| `git.insertions` | `@git.diff.insertions` | `dangerfile_git_plugin.rb:116-118` |
| `git.deletions` | `@git.diff.deletions` | `dangerfile_git_plugin.rb:108-110` |
| `git.diff_for_file(path)` | `@git.diff[file]` (returns `nil` if not present) | `dangerfile_git_plugin.rb:132-134` |
| `git.info_for_file(path)` | `stats` + `diff.blob(:src).contents` / `diff.blob(:dst).contents` | `dangerfile_git_plugin.rb:140-151` |
| `git.commits` | `@git.log.to_a` | `dangerfile_git_plugin.rb:124-126` |

`Danger::FileList` (`lib/danger/core_ext/file_list.rb:6-19`) is a thin `Array<String>` subclass whose only addition is `include?(pattern)` using `File.fnmatch(pattern, current, File::FNM_EXTGLOB)`. The same `git` accessor is re-exported on every platform-specific plugin (`lib/danger/danger_core/plugins/dangerfile_github_plugin.rb:55-62`, `dangerfile_gitlab_plugin.rb:49-56`, `dangerfile_bitbucket_server_plugin.rb:39-46`, `dangerfile_bitbucket_cloud_plugin.rb:39-46`, `dangerfile_vsts_plugin.rb:35-42`).

Rename detection is implemented as a *separate* shell call. `GitRepo#renamed_files` (`lib/danger/scm_source/git_repo.rb:27-51`) shells `git diff --find-renames --diff-filter=R`, regex-extracts `rename from X\nrename to Y` pairs, and returns `Array<Hash>` of `{before:, after:}`. It does **not** consult the typed `Git::Diff` object.

### 1b. Remote PR diff (lazy, request-source-specific)

Each request source builds a `String` that looks like a unified diff, but only the platforms that need a diff `position` argument actually do this.

| Request source | API call | Construction | Code location |
|---|---|---|---|
| **GitHub** | `Octokit::Client#pull_request_files(slug, id, accept: "application/vnd.github.v3.diff")` | Each file's `patch` is wrapped in a synthesised `diff --git a/... b/...\n--- a/...\n+++ b/...` envelope, then all are joined. Comment at `:82-83` admits this is a hack. | `lib/danger/request_sources/github/github.rb:81-100` |
| **GitLab** | `client.merge_request_changes(slug, mr_id)` | Per-change `diff` strings are stitched into `--- a/old_path\n+++ b/new_path\n<diff>` blocks. | `lib/danger/request_sources/gitlab.rb:92-104` |
| **Bitbucket Server** | `BitbucketServerAPI#fetch_pr_diff` → `GET <host>/rest/api/.../pull-requests/{id}/diff?withComments=false` | Returns a *typed* JSON: `{diffs: [{source, destination, hunks: [{sourceLine, sourceSpan, destinationLine, destinationSpan, segments: [{type: "ADDED"\|"CONTEXT"\|"REMOVED", lines: [{source, destination, line, truncated}]}]}]}]}` | `lib/danger/request_sources/bitbucket_server.rb:63-65`; `lib/danger/request_sources/bitbucket_server_api.rb:45-48`; fixture `spec/fixtures/bitbucket_server_api/pr_diff_response.json:1-60` |
| **Bitbucket Cloud** | **None** — no `pr_diff` method; uses `post_comment(..., file:, line:)` directly. | n/a | `lib/danger/request_sources/bitbucket_cloud.rb:145-167` |
| **Azure DevOps (VSTS)** | **None** — uses `post_inline_comment(text, file, line)` directly. | n/a | `lib/danger/request_sources/vsts.rb:184-240`; `lib/danger/request_sources/vsts_api.rb:82` |
| **LocalOnly** | **None** — `update_pull_request!(_hash_needed); end` is a no-op. | n/a | `lib/danger/request_sources/local_only.rb:42-44` |

`LocalOnly` exists for `danger local` / `danger dry_run` runs. `Bitbucket Cloud` and `VSTS` skip the position-lookup step entirely and pass `(file, line)` straight to the comment API; the trade-off is that those platforms can silently reject comments posted to invalid positions.

### 1c. The GitHub patch-header workaround

`lib/danger/request_sources/github/github.rb:81-100`:

```ruby
def pr_diff
  # This is a hack to get the file patch into a format that parse-diff accepts
  # as the GitHub API for listing pull request files is missing file names in the patch.
  prefixed_patch = lambda do |file:|
    <<~PATCH
    diff --git a/#{file['filename']} b/#{file['filename']}
    --- a/#{file['filename']}
    +++ b/#{file['filename']}
    #{file['patch']}
    PATCH
  end

  files = client.pull_request_files(
    ci_source.repo_slug,
    ci_source.pull_request_id,
    accept: "application/vnd.github.v3.diff"
  )

  @pr_diff ||= files.map { |file| prefixed_patch.call(file: file) }.join("\n")
end
```

This wraps the per-file `patch` strings from the GitHub files API in the envelope that the position walker (`find_position_in_diff`) expects. The `patch` field per the fixture at `spec/fixtures/github_api/inline_comments_pr_diff_files.json:12` is e.g. `"@@ -1,5 +1,6 @@\n## Master\n\n* add..."` — bare hunks with no `diff --git` / `---` / `+++` headers. The wrapper is synthesised at runtime; it is the minimum scaffolding to make the regex-based position lookup work.

### 1d. The full pipeline

`lib/danger/danger_core/dangerfile.rb:280-309` (`run`):

1. `setup_for_running(base, head)` → `env.ensure_danger_branches_are_setup` + `env.scm.diff_for_folder(".", from: base, to: head, lookup_top_level: true)` (`dangerfile.rb:275-278`).
2. `parse(Pathname.new(dangerfile_path))` evaluates the user's Ruby `Dangerfile` against the DSL (`dangerfile.rb:180-214`).
3. The Dangerfile calls `git.added_files` / `git.modified_files` etc. against the typed `Git::Diff` object.
4. DSL calls `warn(file:, line:)`, `fail(...)`, `message(...)`, or `markdown(...)` (resolved via `method_missing` at `dangerfile.rb:65-76`) — they produce `Violation` / `Markdown` message objects (`lib/danger/danger_core/messages/{base,violation,markdown}.rb`).
5. `post_results` calls `env.request_source.update_pull_request!(...)` (`dangerfile.rb:251-273`).
6. The request source's `update_pull_request!` splits regular vs. inline violations by `inline?` (`base.rb:58-60`: `file || line`).
7. For inline violations on GitHub: `submit_inline_comments!` → `submit_inline_comments_for_kind!` → `find_position_in_diff(self.pr_diff.lines, m, kind)` (using the *remote* diff text) → `create_inline_comment` → `Octokit::Client#create_pull_request_comment` with `position` (Octokit v7) or absolute `line` (Octokit v8) (`github.rb:412-440`).

The two diff representations live in different files, parsed at different times, and used for different jobs. The local `Git::Diff` is read by the Dangerfile; the synthesised remote diff is read by the request source's position walker.

---

## 2. Internal Diff Representation

### 2a. Typed local object: `Git::Diff` (from the `git` gem)

Danger delegates the heavy lifting to the `git` gem (`schacon/ruby-git`, `lib/danger/scm_source/git_repo.rb:5`: `require "git"`). The `Git::Diff` object is stored on the `GitRepo` instance as `@diff` and the accessor is `attr_accessor :diff, :log, :folder` (`git_repo.rb:9`).

This is **not** a Danger-defined class. It exposes:
- `Git::Diff#each` (iterable over `Git::Diff::DiffFile`)
- `Git::Diff::DiffFile` with `#path`, `#type` (`"new" | "deleted" | "modified"`), `#mode`, `#blob(:src)`, `#blob(:dst)`, plus `#patch`, `#stats`
- aggregate `#lines`, `#insertions`, `#deletions`, `#stats`
- `Git::Diff#[file]` lookup
- `Git::Log` for commit objects

The choice of `git` gem + `Open3` shelling out (see `git_repo.rb:53-61` and the inline `Git::Base#merge_base` extension at `git_repo.rb:195-202`) means Danger inherits the `git` gem's *typed* model on the Dangerfile side, but still hits the shell for rename detection and the `git diff` step itself.

### 2b. Text-only remote object: synthesised unified diff

For inline-comment placement, every request source that supports inline comments builds (or fetches) a `String` that looks like a unified diff:

- **GitHub** — synthesised envelope + per-file patch (see §1c).
- **GitLab** — stitched from `change["diff"]` (raw diff fragment from the API), see `gitlab.rb:92-104`.
- **Bitbucket Server** — a *structured* JSON object (the *only* place where Danger has anything resembling a per-hunk typed model). The consumer in `find_position_in_diff?` / `added_lines` at `bitbucket_server.rb:189-209` walks `diffs[].hunks[].segments[]` (each segment has `type: "ADDED" | "CONTEXT" | "REMOVED"`) and extracts `segment[:lines].map { |line| line[:destination] }`. No string parsing, no regex on the diff body.
- **Bitbucket Cloud / VSTS** — no diff lookup at all; comments are posted with raw `(file, line)` and the platform decides.

### 2c. The line/position side: a `Struct`

`lib/danger/request_sources/github/github.rb:17`:

```ruby
DiffLineReference = Struct.new(:file, :line)
```

This is the only purpose-built "diff" data type on the request-source side. It's created on-the-fly inside `start_position_in_diff` (`github.rb:398`) and passed back into `find_position_in_diff` as a fake `message` object so the same position-resolution routine can be reused for ranged comments. It carries no hunk data, no side, no diff position — it's a `(file, line)` pair that gets re-walked against the diff text.

### 2d. The review message type

`lib/danger/danger_core/messages/base.rb:5`:

```ruby
attr_accessor :message, :file, :line, :type, :start_line, :side, :start_side
```

`BaseMessage#inline?` is `file || line` (`base.rb:58-60`), so any review message that has *either* is sent to the inline-comment path. `Markdown` (`lib/danger/danger_core/messages/markdown.rb:9-22`) extends with `start_line`, `side` (`"LEFT" | "RIGHT"`), and `start_side`. `Violation` (`lib/danger/danger_core/messages/violation.rb:10-15`) extends with `sticky` and a typed `type` ∈ `[:error, :warning, :message]`.

### 2e. What is *not* in any model

Searched `lib/` for typed diff data structures:

- No `File` class, no `Hunk` class, no `Line` class, no `Change` class, no `Range` class. None of these exist in the codebase.
- No "added vs context" distinction in any Danger-defined class. `find_position_in_diff` does treat `+` lines specially when `dismiss_out_of_range_messages_for(kind)` is true (`github.rb:489`), but the public DSL does not surface "this was a context line" to the user.
- No old-side line numbers in any user-facing type. The only place old-side line numbers appear is inside GitLab's `find_old_position_in_diff` (`gitlab.rb:470-519`) for the *outgoing* GitLab discussion `position` payload (`old_path` + `old_line` at `gitlab.rb:430-439`). Even there it's computed and discarded after the API call.
- No diff metadata (mode, symlink, binary, submodule). The `git` gem's `DiffFile#mode` exists, but the Dangerfile has no way to ask "was this a binary file?".
- No parent commit / blob reference exposed as a structured object. `Git::Diff::DiffFile#blob(:src)` and `#blob(:dst)` are used in `info_for_file` (`dangerfile_git_plugin.rb:148-149`) for before/after content, but the result is a flat hash — no structured object.

---

## 3. File Filtering Rules

There are **no built-in file filters** in Danger. Searched `lib/` for `binary`, `generated`, `lockfile`, `vendor`, `filter`, `exclude`, `ignore`, `whitelist`, `blacklist` (excluding "ignore" in the sense of `ignored_violations` and "generated" in the sense of `generated_by_danger`):

| Match | File:line | What it actually is |
|---|---|---|
| `binary` (UTF-8 encoding flag) | `lib/danger/ci_source/local_only_git_repo.rb:31`, `local_git_repo.rb:33` | `git.exec(command).encode("UTF-8", "binary", invalid: :replace, undef: :replace, replace: "")` — Ruby's `String#encode` mode, not "binary file filtering". |
| `vendor` | `lib/danger/ci_source/screwdriver.rb:17`, `lib/danger/plugin_support/gems_resolver.rb:19, 49, 61` | Screwdriver CI docstring (`bundle install --path vendor`); gem resolver searching under `vendor/gems/`. Not a file filter. |
| `generated_by_<danger_id>` | `lib/danger/helpers/comment.rb:27`, `lib/danger/request_sources/github/github.rb:162, 275`, etc. | Tag in posted comment bodies so Danger can find its own past comments. Not a file filter. |
| `danger: ignore` | `lib/danger/request_sources/support/get_ignored_violation.rb:4` | Parses `> danger: ignore "<text>"` directives from the PR body to suppress specific violations. Not a file filter. |

Concretely:

- `GitRepo#diff_for_folder` uses the `git` gem's default diff behaviour. It does **not** pass `--diff-filter`, `-M`, `-C`, `--binary`, `--find-renames`, etc. to `git diff` — `Git.open(...).diff(merge_base, to)` is the only diff invocation (`git_repo.rb:23`). The `git` gem passes through `git diff` defaults, which means rename detection at git's default similarity threshold (~50% on git 2.x).
- `renamed_files` does invoke `git diff --find-renames --diff-filter=R` explicitly (`git_repo.rb:27-51`) — and only that. It shells out separately, parses `rename from` / `rename to` with regex, and returns `Array<Hash>`.
- GitHub `pull_request_files` uses the default `application/vnd.github.v3.diff` accept header, which does not include binary patches. **It does not skip binary files by file name, size, or lockfile pattern.** Whatever the `git` gem + the GitHub files API return is what `find_position_in_diff` will see.
- Bitbucket Server's `added_lines` (`bitbucket_server.rb:200-209`) walks `diffs[].hunks[].segments[]` and returns `line[:destination]` for `type == "ADDED"`. No filtering.
- GitLab's `generate_addition_lines` (`gitlab.rb:535-553`) parses `+` lines from each change's `diff`. No filtering.
- **Dangerfile author filtering** is the only filtering: the DSL exposes `git.modified_files.include?("Gemfile.lock")` etc. (see `dangerfile_git_plugin.rb:60-86`), and the docstring example at `dangerfile_git_plugin.rb:33-35` literally uses a `Gemfile.lock` diff to demonstrate a warning — i.e. the maintainers expect Dangerfiles to look at lockfiles, not skip them.

**Implication**: a `node_modules/`, `package-lock.json`, `yarn.lock`, `Gemfile.lock`, generated `*.pbxproj`, large minified bundle, or any other noise file is fully visible to the Dangerfile, will be present in the inline comment's position diff, and can be commented on. The `info_for_file` accessor will happily load its `blob(:dst).contents` into memory and return it to the user (`dangerfile_git_plugin.rb:140-151`) with no size cap.

---

## 4. Line Mapping Strategy

### 4a. The core algorithm: `find_position_in_diff` (GitHub)

`lib/danger/request_sources/github/github.rb:455-516`:

```ruby
def find_position_in_diff(diff_lines, message, kind)
  range_header_regexp = /@@ -([0-9]+)(,([0-9]+))? \+(?<start>[0-9]+)(,(?<end>[0-9]+))? @@.*/
  file_header_regexp = %r{^diff --git a/.*}
  pattern = "+++ b/#{message.file}\n"
  file_start = diff_lines.index(pattern)
  # Files containing spaces sometimes have a trailing tab
  if file_start.nil?
    pattern = "+++ b/#{message.file}\t\n"
    file_start = diff_lines.index(pattern)
  end
  return nil if file_start.nil?
  position = -1
  file_line = nil
  diff_lines.drop(file_start).each do |line|
    if line.eql?("\\ No newline at end of file\n")
      position += 1
      next
    end
    break if line.match file_header_regexp
    match = line.match range_header_regexp
    if !file_line.nil? && !line.start_with?("-")
      if file_line == message.line
        file_line = nil if dismiss_out_of_range_messages_for(kind) && !line.start_with?("+")
        break
      end
      file_line += 1
    end
    position += 1
    next unless match
    range_start = match[:start].to_i
    if match[:end]
      range_end = match[:end].to_i + range_start
    else
      range_end = range_start
    end
    break if message.line.to_i < range_start
    next unless message.line.to_i >= range_start && message.line.to_i < range_end
    file_line = range_start
  end
  position unless file_line.nil?
end
```

Step-by-step:

1. Find the `+++ b/<file>` line in the diff (with a tab fallback for paths containing spaces, `github.rb:463-466`).
2. Walk forward, line by line.
3. Each line increments the `position` counter (the GitHub PR-comment API's "diff position" — a *zero-based* offset from the start of the file's diff block).
4. When a hunk header `@@ -X,Y +A,B @@` is found, parse `A` (new-file start) and `B` (new-file line count) and check if `message.line` is in `[range_start, range_end)`.
5. If the message's line is in the hunk, set `file_line = range_start` and start tracking: every non-`-` line increments `file_line` until it equals `message.line`.
6. Stop when (a) we hit the message's line, (b) we walk into a new file's diff (`diff --git a/...`), or (c) we go past the line (`break if message.line.to_i < range_start`).
7. Return the `position` (a *diff-relative position*, NOT a file line number). For Octokit v8+, the API wants the absolute `message.line` instead (`github.rb:436-437`).

### 4b. The "No newline at end of file" handling

The `\\ No newline at end of file\n` line still counts toward the `position` counter (`github.rb:475-477`), so any added line that immediately follows a `No newline` annotation gets the right `position`. This is **explicitly tested** at `spec/lib/danger/request_sources/github_spec.rb:791-810`.

### 4c. Out-of-range handling

`find_position_in_diff` returns `nil` if the line is not in the diff. The caller in `submit_inline_comments_for_kind!` then has three branches (`github.rb:337-341`):

- If `position` is `nil` or `start_position == :out_of_range`, the message is **rejected** when `dismiss_out_of_range_messages_for(kind)` is true, otherwise it is kept.
- If the position is found, the message is formatted and posted.

`dismiss_out_of_range_messages` defaults to `false` (`github.rb:33`) and is settable per-kind (`{warning: true, error: false}`) via `github.dismiss_out_of_range_messages(hash)` (`lib/danger/danger_core/plugins/dangerfile_github_plugin.rb:246-254`). The **default behaviour is therefore "post even if out of range"** — the GitHub API may then 422 (rejected as `UnprocessableEntity` in `github.rb:373-380`).

### 4d. GitLab mapping: `find_old_position_in_diff` and `is_out_of_range`

`lib/danger/request_sources/gitlab.rb:470-519`. Different strategy — GitLab discussion `position` needs `{old_path, old_line, new_path, new_line, base_sha, start_sha, head_sha}` (`gitlab.rb:430-439`). The function:

1. Finds the matching `change` by `new_path == message.file` (`gitlab.rb:473`).
2. Rejects if `change.nil?`, `change["diff"].empty?`, or `change["deleted_file"]` (`gitlab.rb:475`).
3. Returns `{old_line: nil}` for new files (`gitlab.rb:483`).
4. Otherwise walks `change["diff"]` line by line, incrementing `current_old_line` / `current_new_line` as it sees `+` / `-` / context lines, and computes the old-side line at the end via `current_old_line - current_new_line + message.line.to_i` (`gitlab.rb:517`).

`is_out_of_range` (`gitlab.rb:521-533`) similarly walks the diff to compute `generate_addition_lines(change["diff"])` and does set-membership on the target line. This is more careful than GitHub's mapper because GitLab's API *requires* an old-side line — there is no concept of an "added-only" inline comment.

### 4e. Bitbucket Server mapping: `added_lines`

`lib/danger/request_sources/bitbucket_server.rb:200-209`:

```ruby
def added_lines(file)
  @added_lines ||= {}
  @added_lines[file] ||= file_diff(file)[:hunks].map do |hunk|
    hunk[:segments].select { |segment| segment[:type] == "ADDED" }.map do |segment|
      segment[:lines].map do |line|
        line[:destination]
      end
    end
  end.flatten
end
```

Uses the *typed* JSON diff (segments, lines, with `source`/`destination` numbers — see `spec/fixtures/bitbucket_server_api/pr_diff_response.json:8-60`). Returns an `Array<Integer>` of all `ADDED` `destination` line numbers per file. The check `find_position_in_diff?` (`bitbucket_server.rb:189-194`) is a set membership test, not a position lookup — Bitbucket Server's Code Insights Annotations API takes a `line` directly, not a diff `position`.

### 4f. Tests around the mapping

| Test | What it pins | File:line |
|---|---|---|
| `find_position_in_diff` returns 2 for a 2-line addition | The basic position-counting algorithm | `spec/lib/danger/request_sources/github_spec.rb:748-789` |
| `find_position_in_diff` returns 3 for a diff with `\ No newline at end of file` | The explicit no-newline adjustment | `spec/lib/danger/request_sources/github_spec.rb:791-810` |
| Octokit v7: `create_pull_request_comment` receives `position=7` for `Rakefile, line=34` | End-to-end position resolution against the Artsy fixture | `spec/lib/danger/request_sources/github_spec.rb:418-433` |
| Octokit v8: `create_pull_request_comment` receives absolute `line=34` for `Rakefile, line=34` | v8 API change: pass absolute line, not diff position | `spec/lib/danger/request_sources/github_spec.rb:460-475` |
| Ranged inline (Octokit v7) | Falls back to `position` (no `start_line`) | `spec/lib/danger/request_sources/github_spec.rb:435-457` |
| `parse_message_from_row` extracts file+line from old-style and new-style table rows | Round-trip from posted comment back to Violation | `spec/lib/danger/request_sources/github_spec.rb:383-399` |
| `is_out_of_range` for new file, modified, deleted, renamed-only | GitLab diff membership | `spec/lib/danger/request_sources/gitlab_spec.rb:512-665` |
| `find_old_position_in_diff` for various change types | GitLab old-side line computation | `spec/lib/danger/request_sources/gitlab_spec.rb:667-888` |
| `find_position_in_diff?` returns true for `Gemfile, 3` (added), false for `file.rb, 1` (absent) | Bitbucket Server line membership | `spec/lib/danger/request_sources/bitbucket_server_spec.rb:97-109` |
| `renamed_files` returns `[{before, after}]` for three renames | `git diff --find-renames --diff-filter=R` parsing | `spec/lib/danger/scm_source/git_repo_spec.rb:229-273` |
| `moved files as expected` (`git mv`) | `git mv` produces a rename from the `git` gem's default behaviour | `spec/lib/danger/scm_source/git_repo_spec.rb:144-168` |

There is no test for **partial diffs (truncation)**, **diff with rename + modify in same file**, **submodule diffs**, **symlink diffs**, **binary file diff entries**, or **`\ No newline` followed by `-` (deletion)**.

---

## 5. Edge Case Handling

| Edge case | Handled? | Evidence |
|---|---|---|
| **New file (added)** | Yes | `dangerfile_git_plugin.rb:60-62` (file type `"new"`); `find_position_in_diff` works on additions by counting `+` lines (`github.rb:487-493`); `find_old_position_in_diff` returns `{old_line: nil}` for new files (`gitlab.rb:483`). |
| **Deleted file** | Yes | `dangerfile_git_plugin.rb:68-70` (file type `"deleted"`); inline comments to a deleted file will have no diff position and be silently kept (default `dismiss_out_of_range_messages = false`) or rejected (when opt-in); GitLab `is_out_of_range` returns true for deleted files (`gitlab.rb:524`). |
| **Renamed file** | Yes — via a *separate* shell call, not the typed object | `GitRepo#renamed_files` shells `git diff --find-renames --diff-filter=R` and regex-extracts `rename from X\nrename to Y` (`git_repo.rb:27-51`); default `git` gem rename similarity threshold (~50%); no `--find-renames` flag on the main `diff_for_folder` path. |
| **Renamed + modified in same file** | Partial | The rename shows up in `renamed_files` but the typed `Git::Diff` treats the file as a regular modified file (test at `git_repo_spec.rb:144-168` shows `git mv` produces `modified_files: ["file"]`, not "renamed"). The user has to use `renamed_files` *and* `modified_files` to detect both. |
| **Multiple hunks per file** | Yes | `find_position_in_diff` re-seeds `file_line` from each `@@` header (`github.rb:512`). |
| **Multiple files** | Yes | `find_position_in_diff` stops at the next `diff --git a/...` line (`github.rb:480`). |
| **Spaces in file paths** | Partial | Trailing tab fallback in `find_position_in_diff` (`github.rb:463-466`); no quote-escaping for paths with `+` or other special characters. |
| **Context lines as comment targets** | Yes | `find_position_in_diff` increments `file_line` for both `+` and ` ` (context) lines (`github.rb:487-493`); with `dismiss_out_of_range_messages` enabled, context lines are filtered out (`github.rb:489`). |
| **`\ No newline at end of file`** | Yes | Explicit branch in `find_position_in_diff` (`github.rb:475-477`); tested at `github_spec.rb:791-810`. |
| **Diff exceeding API limits** | No explicit handling | `@pr_diff` is built by `Array#join` (`github.rb:99`); if the diff is megabytes, `pr_diff` returns the whole thing. The position walker walks all of it. |
| **Generated files** | Not filtered | Searched `lib/` — no occurrence outside of "generated_by_danger" tagging. |
| **Lockfiles (`*.lock`, `Gemfile.lock`, etc.)** | Not filtered | The `git_repo_spec.rb:101-119` and `:122-142` tests create normal text files; no `*.lock` test. The docstring example at `dangerfile_git_plugin.rb:33-35` *uses* a `Gemfile.lock` diff — i.e. the maintainers expect Dangerfiles to look at lockfiles, not skip them. |
| **Vendored files (`node_modules/`, `vendor/`)** | Not filtered | No filter code. |
| **Binary files** | Not filtered | No filter. The `git` gem returns binary files with `patch == nil` (or empty) and the GitHub `application/vnd.github.v3.diff` *excludes* binary content, so `find_position_in_diff` will simply not find the file (returns `nil`, message is silently kept as out-of-range). No explicit test. |
| **Submodules** | No handling | `git diff` will emit `Subproject commit <hash>` lines; `find_position_in_diff` will treat them as the start of a new file diff and stop early. No explicit test. |
| **Symlinks** | No handling | Same as binary — likely silently dropped. |
| **File mode changes** | No handling | `git` gem may include `old mode ... new mode ...` lines; no special case. |
| **Empty diff (PR with no changes)** | Yes | `pr_diff` returns `""`; `find_position_in_diff` returns `nil` for every file; all messages are kept but the GitHub API will 422 them. There is no "skip review" branch. |
| **Comment with `start_line` (ranged comment)** | Yes (Octokit v8+) | `start_position_in_diff` creates a synthetic `DiffLineReference` and re-runs `find_position_in_diff` for the start line (`github.rb:395-400`); `create_inline_comment` uses `client.create_pull_request_comment(..., start_line: ..., side: "RIGHT", start_side: "RIGHT")` (`github.rb:418-428`). Octokit v7 ignores the range (`github.rb:429-440`). |
| **`message.line` on a `-` (deletion) line** | Silently out-of-range | `find_position_in_diff` only tracks `file_line` for non-`-` lines (`github.rb:487-493`), so deletion-line comments are unreachable. |
| **Old-side (`LEFT`) comment** | Yes (Octokit v8+) | `Markdown` accepts `side:` and `start_side:` (`lib/danger/danger_core/messages/markdown.rb:9-22`); default is `"RIGHT"` (`github.rb:426-427`). |
| **Comment with no `file`/`line`** | Caught and routed to the summary comment | `submit_inline_comments_for_kind!` rejects `m.file && m.line` is `false` (`github.rb:335`); `regular_violations_group` and `inline_violations_group` split by `inline?` (`base.rb:58-60`); only inline ones go to inline-comment path. |
| **PR head has been force-pushed** | Out-of-range comments can be created | `delete_old_inline_violations` deletes non-sticky old comments and strikes-through sticky ones (`github.rb:301-320`); the new run will re-create any comments that survived. There is no "the old comment is now stale, do not re-post" logic. |
| **No newline at end of file followed by a deletion** | Position counting works (the `position += 1` for `\\ No newline` happens before the deletion tracking), but the algorithm does not advance `file_line` for `-` lines, so the deletion stays unreachable. | `github.rb:475-493`. |
| **Out-of-range comment when no `dismiss_out_of_range_messages`** | Comment is posted anyway; may 422 | `github.rb:335-341`; `Octokit::UnprocessableEntity` rescue at `github.rb:373-380` logs to stdout and skips the comment. No retry, no fallback. |

---

## 6. Multi-File Reasoning

Multi-file reasoning is supported at the **Dangerfile level**: the user iterates over `git.added_files`, `git.modified_files`, `git.deleted_files`, `git.renamed_files`, and per-file `git.diff_for_file(path)`. There is no in-process multi-file orchestration beyond this — the review engine *is* the user's Ruby code in the Dangerfile.

The data structure that supports it:

- `Danger::FileList` is an `Array<String>` (`lib/danger/core_ext/file_list.rb:6-19`) — supports `each`, `select`, `map`, `+`, and an `include?(pattern)` with `File.fnmatch` extglob.
- `git.added_files + git.modified_files` is the canonical "files changed in this PR" set, used in the docstring example at `dangerfile_git_plugin.rb:13-15`.
- `git.diff_for_file("Gemfile.lock")` returns the typed `Git::Diff::DiffFile` for a single file, with `patch`, `blob(:src).contents`, `blob(:dst).contents` (`dangerfile_git_plugin.rb:132-134`).
- The typed `Git::Diff` is also directly accessible via `git.diff` for advanced users (`dangerfile_git_plugin.rb:92-94`).

There is no per-file chunking, no per-file context window, no parallel processing. The Dangerfile is evaluated as a single Ruby script that sees the full set of `FileList` objects.

For the **review output**, multi-file is the norm: `update_pull_request!` groups messages by `:warnings / :errors / :messages / :markdowns` (`github.rb:173-185`), each sorted by `(file, line)` (`github.rb:594-611`), and the summary table groups all violations of the same kind into one comment. Optional aggregation into per-line `MessageGroup`s is available via `MessageAggregator` (`lib/danger/danger_core/message_aggregator.rb:23-48`) when `DANGER_MESSAGE_AGGREGATION` is set, used by `update_pr_by_line!` (e.g. Bitbucket Cloud's `bitbucket_cloud.rb:102-143`).

---

## 7. Reusability for Ultraplan

| Component | Reusable? | Why | File:line |
|---|---|---|---|
| `GitRepo#diff_for_folder` | **Yes** | Pure local-git diff fetch with merge-base, commit existence checks, shallow-clone recovery. Decoupled from any platform. | `lib/danger/scm_source/git_repo.rb:11-25` |
| `GitRepo#renamed_files` | **Yes** | Reusable regex-based rename detection. | `lib/danger/scm_source/git_repo.rb:27-51` |
| `GitRepo#find_merge_base` + incremental fetch | **Yes** | Reusable; handles shallow clones with exponential depth increase. | `lib/danger/scm_source/git_repo.rb:127-159` |
| `DangerfileGitPlugin` (`git.added_files`, etc.) | **Yes** | Thin projection on top of `Git::Diff`. Reusable as a "diff" namespace in Ultraplan's review engine. | `lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:60-86` |
| `Danger::FileList` | **Yes** | `Array<String>` + `include?(pattern)` with extglob. Tiny. | `lib/danger/core_ext/file_list.rb:6-19` |
| `GitHub#pr_diff` patch-header hack | **No (but instructive)** | Works around a specific GitHub API quirk; Ultraplan should re-derive this with a proper diff model. | `lib/danger/request_sources/github/github.rb:81-100` |
| `GitHub#find_position_in_diff` | **Yes (algorithmic core)** | The `position` counter / `file_line` walker is the heart of the inline-comment placement and is independent of Danger. Reusable as a reference implementation, though Ultraplan should consider a proper parser. | `lib/danger/request_sources/github/github.rb:455-516` |
| `GitLab#find_old_position_in_diff` | **Yes** | Reusable old-side line computation; needed for GitLab-style discussion APIs. | `lib/danger/request_sources/gitlab.rb:470-519` |
| `Bitbucket Server` typed JSON diff | **Yes** | Worth porting the typed-shape idea; Ultraplan could re-shape GitHub/GitLab diffs into a per-hunk/per-segment structure. | `lib/danger/request_sources/bitbucket_server.rb:189-209`; `spec/fixtures/bitbucket_server_api/pr_diff_response.json:1-60` |
| `Violation` / `Markdown` / `BaseMessage` | **Partially** | `file`, `line`, `start_line`, `side`, `start_side` are exactly the fields Ultraplan needs (`messages/base.rb:5`, `markdown.rb:9-22`). `==`, `<=>`, `compare_by_file_and_line` are reusable for de-duplication and sorting. | `lib/danger/danger_core/messages/{base,violation,markdown}.rb` |
| `MessageGroup` + `MessageAggregator` | **Yes** | Groups messages by `(file, line)` for the summary comment. Decoupled from diff source. | `lib/danger/danger_core/message_group.rb`; `lib/danger/danger_core/message_aggregator.rb:23-48` |
| `submit_inline_comments!` (GitHub) | **Reference only** | Tightly coupled to Octokit and Dangerfile evaluation order. Reuse the algorithm, rewrite the IO. | `lib/danger/request_sources/github/github.rb:273-320` |
| File filtering | **No** | None exists. Ultraplan would have to add it. | n/a |
| Binary / lockfile / generated handling | **No** | None exists. Ultraplan would have to add it. | n/a |
| Truncation | **No** | No character/byte cap. Ultraplan should add per-file and per-PR caps with a defined truncation strategy. | n/a |

**Verdict**: Danger's diff layer is split into two halves — a *structured* half (the `git` gem) and a *textual* half (the request-source position walker). The structured half is reusable as-is. The textual half is reusable as a reference algorithm but should be replaced with a proper parsed diff model in Ultraplan. The biggest gap is the absence of any normalisation step (filtering, truncation, binary/lockfile handling) — Ultraplan has to design that from scratch.

---

## 8. Failure Modes & Tradeoffs

1. **Position counter resets on every file.** `find_position_in_diff` is called once per `(file, line)` pair. For a 50-file PR with 10 inline comments, this is 10 full diff walks. No caching. For a 500-file PR it becomes the bottleneck.

2. **`pr_diff` is rebuilt on every call to `submit_inline_comments!`.** The `@pr_diff ||=` cache (`github.rb:99`) survives across a single `update_pull_request!` call, but every call to `submit_inline_comments!` re-does `self.pr_diff.lines` (`github.rb:283`). The first call materialises the diff, subsequent calls in the same run hit the cache.

3. **No diff size cap.** `pull_request_files` for a 100k-line diff returns 100k lines, `pr_diff` builds the whole string, and the position walker walks all of it. There is no `if pr_diff.size > MAX: ...` guard. Ultraplan would want a per-file and per-PR cap.

4. **No binary detection.** A `git diff` of a binary file emits `Binary files a/foo.png and b/foo.png differ`. `find_position_in_diff` will not match a `+++ b/foo.png` line in the diff (because the GitHub API strips binary entries from `application/vnd.github.v3.diff`), so comments to binary files are silently kept and 422ed by the GitHub API. No explicit handling, no warning to the user.

5. **No lockfile / vendored / generated filtering.** As noted in §3. This is the biggest "noise" failure mode for a code-review agent that wants to focus on real changes.

6. **Rename detection on the local side depends on `git` gem defaults.** `Git.open.diff(merge_base, to)` uses the `git` gem's defaults, which match `git diff`'s defaults. Renames below the similarity threshold become add+delete pairs. The `renamed_files` accessor does an extra shell call with explicit `--find-renames --diff-filter=R`, but `git.modified_files` / `git.added_files` / `git.deleted_files` reflect the un-flagged diff.

7. **`renamed_files` ignores the typed `Git::Diff`.** It shells out to `git diff` separately, parses the output, and returns its own array. The result is **not joined to** the `Git::Diff` — a file can appear in both `renamed_files` (as a rename) and in `modified_files` (as a regular modification), because `git mv` produces a rename in the `git diff` output but the `git` gem still treats the file as modified.

8. **Default behaviour posts out-of-range comments.** `dismiss_out_of_range_messages` defaults to `false` (`github.rb:33`, `gitlab.rb:27`). A comment to a line that no longer exists in the diff will be sent to the GitHub API, which will 422 it, which Danger logs to stdout and drops (`github.rb:373-380`). No retry, no recovery.

9. **Position drift after force-push.** When a PR is force-pushed, the `commit_id` in the existing Danger comment changes. Danger detects "still in force" by matching `position` and `path` (`github.rb:402-410`), but `position` is a function of the *current* PR's diff — which may have shifted. Result: Danger may delete the old comment and re-create at the new position, which is the correct behaviour but means **inline comments can move between runs** if the diff shifts. There is no stable-anchor logic.

10. **`DangerfileGitPlugin` reads `info_for_file` blobs into memory with no size cap.** `git.info_for_file(path)` calls `diff.blob(:dst).contents` (`dangerfile_git_plugin.rb:149`). A 100 MB generated file would be loaded into a Ruby string and returned to the user. This is a memory hazard.

11. **Two diff sources, two sources of truth.** `git.added_files` (from the local `git` gem) and `find_position_in_diff(self.pr_diff.lines, ...)` (from the remote GitHub API) can disagree. GitHub sometimes returns patches for files that are not in the local `git diff` (e.g. when a force-push moves commits around) and vice-versa. The error message at `lib/danger/scm_source/git_repo.rb:115-117` warns about this explicitly. There is no reconciliation.

12. **Comment ID for the summary comment can become invalid.** When Danger deletes a comment and re-posts, the previous inline comments are tied to the previous summary comment's `danger_id`-tagged body. If the parsing of that body (`lib/danger/helpers/comments_parsing_helper.rb:30-45`) ever fails to match the table, the `previous_violations` map is empty and Danger treats every comment as new — causing a flood of `create_pull_request_comment` calls.

13. **`info_for_file` includes deleted files' old content as `nil`.** `dangerfile_git_plugin.rb:148-149` returns `before: nil` for added and deleted files. Users have to check for `nil` before reading.

14. **No truncation, no chunking, no summarisation.** A single Dangerfile sees the full diff (via `git.added_files.map { |f| git.diff_for_file(f) }`) and the full PR metadata. There is no concept of "this PR is too large; switch to a sampled review". Ultraplan would have to build this.

15. **`start_position_in_diff` returns `:out_of_range` for the start of a ranged comment if it cannot be found.** The check is at `github.rb:341`: `next dismiss_out_of_range_messages_for(kind) if position.nil? || start_position == :out_of_range`. Ranged comments are therefore the most fragile.

16. **Per-kind `dismiss_out_of_range_messages` opt-in is not documented in the README.** The class doc at `lib/danger/danger_core/plugins/dangerfile_github_plugin.rb:239-254` shows the hash form `{warning: true, error: false}`, but the default behaviour (keep all) is counter-intuitive for a code-review agent.

17. **The `Octokit::MAJOR` branching in `create_inline_comment` (`github.rb:415-440`) is a maintenance hazard.** It exists to handle the Octokit v7 → v8 API change (v8 wants `line` instead of `position`). Ultraplan should pick a client API and not branch on it at runtime.

18. **No structured diff model on the *output* side.** When Danger posts a summary comment, it formats violations into HTML tables (`lib/danger/comment_generators/*.md.erb`) — there is no structured object that says "this is a list of files, each with a list of violations, each with a `(file, line, body, side, sticky)` tuple". Ultraplan would want one.

---

## 9. Summary Table — Analysis Axes

| Axis | Rating | Evidence |
|---|---|---|
| **Diff structure** (raw text vs typed model) | **Mixed** — typed for Dangerfile (via `git` gem), raw text for request sources (via synthesised/diff text from API) | `git_repo.rb:23` (`repo.diff(merge_base, to)`); `github.rb:81-100` (text); `bitbucket_server.rb:189-209` (typed JSON). |
| **Line mapping accuracy** | **High for added/context lines on GitHub and GitLab; absent on Bitbucket Cloud / VSTS.** Tested at `github_spec.rb:748-810`; 9+ years of production use across 5 hosts. | `github.rb:455-516`; `gitlab.rb:470-519`; `bitbucket_server.rb:200-209`. |
| **Noise filtering** (binaries, lockfiles, vendor, generated) | **None** — Danger is a policy-free DSL; the user must filter in their Dangerfile. | Searched `lib/` — no filter code. |
| **Edge-case handling** (rename, delete, binary, generated) | **Partial** — renames via separate shell call, deletes via file type, new files via file type, binaries silently absent, lockfiles/generated/vendored untouched. | `git_repo.rb:27-51`; `dangerfile_git_plugin.rb:60-86`. |
| **Reusability for Ultraplan** | **High** for `git_repo.rb` + `dangerfile_git_plugin.rb` + the position algorithms; **Low** for everything else (no normalisation layer, no filter layer). | See §7. |
| **Multi-file reasoning** | **Supported at the Dangerfile level** — user iterates over `git.added_files` etc. No built-in multi-file orchestration. | `dangerfile_git_plugin.rb:60-86`; `message_aggregator.rb:23-48`. |

---

## 10. Answers to Dimension Questions

1. **Does the tool use raw diffs or structured diff objects?** — **Both, in parallel.** The Dangerfile-facing side uses a typed `Git::Diff` from the `schacon/ruby-git` gem (`lib/danger/scm_source/git_repo.rb:23`, `lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:60-151`). The request-source side, used only to compute inline-comment positions, uses a synthesised unified-diff `String` (GitHub at `lib/danger/request_sources/github/github.rb:81-100`, GitLab at `lib/danger/request_sources/gitlab.rb:92-104`) — *except* Bitbucket Server, which uses a typed JSON object (`lib/danger/request_sources/bitbucket_server.rb:189-209` + `spec/fixtures/bitbucket_server_api/pr_diff_response.json`).

2. **How are changed files represented internally?** — Three layers:
   - `Git::Diff` + `Git::Diff::DiffFile` (third-party, from `schacon/ruby-git`) — the only typed model; has `path`, `type ∈ {"new","deleted","modified"}`, `mode`, `blob(:src/:dst)`, `patch`, `stats` (`lib/danger/scm_source/git_repo.rb:9`).
   - `Danger::FileList<String>` — an `Array<String>` subclass with `include?(pattern)` via `File.fnmatch(..., FNM_EXTGLOB)` (`lib/danger/core_ext/file_list.rb:6-19`).
   - A synthesised unified-diff `String` of `(file, position)`-addressed hunks for the inline-comment walker.

3. **How are line numbers mapped back to PR comments?** — By line-by-line walking of a unified-diff `String` (`lib/danger/request_sources/github/github.rb:455-516`):
   - **GitHub**: `find_position_in_diff(diff_lines, message, kind)` counts hunk-relative `position` while tracking the new-file `file_line`. Returns the `position` (for Octokit v7) or the caller passes `message.line` directly (Octokit v8, `github.rb:436-437`).
   - **GitLab**: `find_old_position_in_diff(changes, message)` (`lib/danger/request_sources/gitlab.rb:470-519`) walks `change["diff"]` incrementing `current_old_line` / `current_new_line` to compute both `new_line` and `old_line` for the discussion `position` payload. Ranged comments are not supported.
   - **Bitbucket Server**: `find_position_in_diff?(file, line)` (`lib/danger/request_sources/bitbucket_server.rb:189-194`) is a set-membership test against `added_lines(file)` — extracted from the typed JSON diff's `segments[].lines[].destination` numbers.
   - **Bitbucket Cloud / VSTS**: no diff lookup — `(file, line)` goes straight to the platform.
   - **LocalOnly**: no posting at all (`lib/danger/request_sources/local_only.rb:42-44`).

4. **Does it ignore generated files, lockfiles, vendored files, or binaries?** — **No.** Searched `lib/` — no occurrence outside Ruby's `String#encode("UTF-8", "binary", ...)` mode flag. The Dangerfile is expected to filter with `git.modified_files.include?("Gemfile.lock")` etc. (the docstring example at `lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:33-35` literally uses a `Gemfile.lock` diff). Binary files become silently-dropped comments via the API's 422.

5. **How does it handle renamed, deleted, and moved files?** —
   - **Renamed**: `GitRepo#renamed_files` (`lib/danger/scm_source/git_repo.rb:27-51`) shells `git diff --find-renames --diff-filter=R` and regex-extracts `rename from X\nrename to Y` pairs into `Array<Hash>` `{before:, after:}`. The typed `Git::Diff` does *not* include rename info unless the `git` gem detects them; rename+modify in the same file is not reconciled.
   - **Deleted**: `git.deleted_files` returns `Danger::FileList` of paths where `d.type == "deleted"` (`lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:68-70`). GitLab's `is_out_of_range` returns true for deleted files (`lib/danger/request_sources/gitlab.rb:524`).
   - **Moved**: identical to renames.

6. **Can the diff representation support multi-file reasoning?** — **Yes at the Dangerfile level.** The user iterates `git.added_files + git.modified_files` and calls `git.diff_for_file(path)`. There is no in-process multi-file orchestration (no per-file chunking, no per-file context window); multi-file reasoning is whatever the user writes in Ruby. The output side is naturally multi-file: messages are grouped by `(file, line)` for the summary table (`lib/danger/danger_core/message_aggregator.rb:23-48`).

7. **How easy would it be to reuse this diff model in Ultraplan?** — **Partially.** The local-git half (`GitRepo#diff_for_folder`, `renamed_files`, the `DangerfileGitPlugin` projection) is a clean, reusable layer. The request-source position algorithm (`find_position_in_diff`, `find_old_position_in_diff`) is also reusable as a reference but should be replaced with a proper parsed diff model. The message types (`BaseMessage`/`Violation`/`Markdown`) carry exactly the fields Ultraplan needs (`file`, `line`, `start_line`, `side`, `start_side`, `sticky`). The biggest *gap* is the absence of any normalisation layer — filtering (binaries, lockfiles, vendored, generated), truncation, and per-PR/per-file caps have to be designed from scratch. The two parallel diff sources (local `git` gem vs remote platform API) is a second gap; Ultraplan should pick one canonical source and either skip the other or reconcile it explicitly.

---

## 11. Final Score: 7/10

| Reason | Detail |
|---|---|
| **In favour (+)** | Typed `Git::Diff` object on the local side; production-tested `find_position_in_diff` text walker on the request-source side; multi-host support (GitHub, GitLab, Bitbucket Server, Bitbucket Cloud, VSTS); explicit `Octokit::MAJOR` handling; `dismiss_out_of_range_messages` per-kind opt-in; `git.info_for_file` exposes before/after blob content; rename detection is first-class; merge-base handling with shallow-clone recovery; `MessageGroup` aggregation for the summary comment; `Markdown` carries `side`/`start_side`/`start_line` for ranged comments. | `lib/danger/scm_source/git_repo.rb:11-25,27-51,127-159`; `lib/danger/request_sources/github/github.rb:81-100,273-440,455-516`; `lib/danger/request_sources/gitlab.rb:92-104,470-519`; `lib/danger/request_sources/bitbucket_server.rb:63-65,189-209`; `lib/danger/danger_core/message_group.rb:14-25`; `lib/danger/danger_core/message_aggregator.rb:23-48`; `lib/danger/danger_core/messages/markdown.rb:9-22`. |
| **Against (−)** | No filtering of binaries, lockfiles, vendored, or generated files; no diff size cap; two parallel diff sources (local `git` gem vs remote platform API) that can disagree; rename + modify in the same file is not reconciled; default behaviour keeps out-of-range comments and trusts the platform to 422 them; no per-file or per-PR chunking; `info_for_file` returns `nil` for added/deleted files with no help text; position counter is O(n) per comment with no cache; Bitbucket Cloud and VSTS skip the position-lookup step entirely; no typed diff model on the *output* side. | No filter code in `lib/`; `lib/danger/request_sources/github/github.rb:33` (default `dismiss_out_of_range_messages = false`); `lib/danger/request_sources/github/github.rb:373-380` (422 → log + skip); `lib/danger/danger_core/plugins/dangerfile_git_plugin.rb:148-149` (`before/after: nil`); `lib/danger/request_sources/github/github.rb:455-516` (no cache); `lib/danger/request_sources/bitbucket_cloud.rb:145-167`, `lib/danger/request_sources/vsts.rb:184-240` (no diff lookup). |

**Heuristic check**: "Would I trust this system to place inline comments on the correct PR lines?" — **Yes** for added/context lines on GitHub and GitLab, where the algorithm is explicitly tested (`spec/lib/danger/request_sources/github_spec.rb:748-810`, `spec/lib/danger/request_sources/gitlab_spec.rb:512-888`) and 9+ years of production use has hardened the corner cases (`\ No newline`, multiple hunks per file, multiple files, spaces in paths). **Partially** for ranged inline comments (Octokit v8+ only), for Bitbucket Cloud / VSTS (no diff lookup), and for submodules / symlinks / mode changes (silent drops).

Danger is a **trustworthy, production-proven diff-position mapper**, but it is not a *structured diff model* — it leans on the `git` gem on one side and a regex walker on the other. For Ultraplan, the local-git half and the position-algorithm are the highest-value lifts; the missing piece is the **normalisation layer** (filtering, truncation, structured chunking) that Danger never built because its "review engine" is the user's Ruby code rather than an LLM.
