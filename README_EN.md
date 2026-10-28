# dsh-archived-sessions

> View, **restore** and delete archived sessions in DSH (DeepSeek Harness): browse the archive list in Settings, read full transcripts in a chat-style dialog (turns / reasoning / tool executions / Markdown tables), and restore archived sessions **back to the active sidebar list** with one click. Works on desktop and web.

Once a session is archived in DSH it disappears from every surface with no official way back. This plugin adds an «Archived Sessions» page to Settings that brings the archive list back, and supports **un-archiving (restore)**.

## Screenshots

<!-- Drop screenshots into docs/screenshots/ and reference them below with `![alt](docs/screenshots/file.png)` -->
![Archived sessions list](docs/screenshots/archived-list.png)
![Transcript viewer (with Restore button)](docs/screenshots/archived-viewer.png)

## Features

- **Archive list**: title, owning workspace, message count and last activity at a glance; refresh supported. **Since v0.3.0**: paginated at 10 per page, with instant **title / workspace** search filters.
- **Transcript viewer**: click a session to open a read-only chat dialog (rendered above the settings panel; closing returns to the list).
  - Grouped by **turn** — each turn collapses the "working steps" (reasoning, tool calls, command executions) so the final answer stands out;
  - Markdown rendering: headings, ordered/unordered lists, blockquotes, links, code blocks (auto-pretty JSON), **tables** (horizontally scrollable);
  - Tool executions render as terminal cards: tool name, status dot (ok/error), `$` command line, expandable output;
  - System-injected messages (runtime context snapshots, skill catalogs…) are folded separately, never mixed with user messages.
- **Restore archived sessions** (v0.2.0+): two-step confirmation; un-archives the session so it returns to the active sidebar list at its original position.
  - Two entry points: the «Restore» button on each archive-list row; since **v0.2.3** also a «Restore» button in the transcript viewer's footer.
  - DSH ships `archiveSession` but no un-archive API, so the plugin writes through the workspace registry's own storage domain (`storageDomain.get('workspace').global`), removing the session id from `archivedSessionIds` — the same durable write chain the product's archive action uses. The change is live immediately, survives restart, and clears this plugin's tombstone for the session.
- **Delete archive records**: two-step confirmation; removes the entry from the archive list. DSH has no session-delete API, so this is implemented as a tombstone — the session stays archived (hidden from every product surface) and the data files remain on disk (matching the product's own behavior).

## Install

`dsh plugin` requires `--profile` (the runtime you are installing into):

```bash
# This fork: replace vX.Y.Z with the tag pinned by dsh-config-pack
dsh plugin --profile desktop add github:Robert-Wang-08/dsh-archived-sessions#vX.Y.Z
dsh plugin --profile web add github:Robert-Wang-08/dsh-archived-sessions#vX.Y.Z
```

(`desktop` is the profile the DSH Desktop app runs, `web` corresponds to `dsh web`; use your own profile name if you run a custom one.) After install + restart: **Settings → Archived Sessions**.

> This fork does not publish to npm. The `@jiangdaoli/dsh-archived-sessions` scope belongs to upstream. `dsh-config-pack` installs the `github:...#vX.Y.Z` spec above; `prepare` runs `pnpm build` during that install and produces `lib/`. Tag and manual CI only install and build.

## How it works

- **Host half** (`src/index.ts` → `runtime.ts`): reads through official DSH services — `workspaceRegistry` (archive set), `sessionQuery` (titles / surface projection), `sessionPersistence.readRaw` (lenient fallback for corrupt logs). Exposes `archived/list`, `archived/surface`, `archived/delete`, `archived/restore` via Typert Remote.
  - Delete only writes to the plugin's own settings namespace (tombstone);
  - Restore writes through `storageDomain` into the workspace domain (removes from `archivedSessionIds`); session data itself is never touched.
- **Client half** (`src/client/index.ts`): mounts the Remote namespace and registers the `settings.section` entry (id `archived-sessions`). The viewer renders inside the settings panel, so it is naturally on top.
- **Compatibility**: official DSH contracts only — no desktop-only services are injected; desktop / web / CLI all work.

## Development

```bash
pnpm install
pnpm build      # esbuild single-file host + client artifacts into lib/
pnpm typecheck
```

Release process (local acceptance gate, CHANGELOG and Release-note steps): see [RELEASING.md](RELEASING.md).

## Notes & limitations

- Delete only removes the archive record; session data stays on disk (DSH never deletes session data).
- Corrupt logs (seq gaps) are marked and opened with the readable portion.
- Restore (un-archive) writes the workspace domain's `archivedSessionIds` — the single durable home of that data, shared with the product's archive action; session data is not touched.
- **Continue the conversation**: once restored, the session is back in the active sidebar list — open it and keep chatting (same session, same log, pick up right where it left off).

## Changelog

Per-version changes: [CHANGELOG.md](CHANGELOG.md); GitHub Releases carry the release notes as well.

## License

MIT
