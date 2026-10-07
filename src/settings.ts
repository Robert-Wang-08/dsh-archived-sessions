/**
 * The plugin-owned tombstone namespace: session ids the user chose to
 * remove from the archive list. DSH has no session-delete API, and removing
 * a session from `archivedSessionIds` would resurrect it as a stray row in
 * the sidebar (the product UI shows non-archived, unaccounted sessions).
 * So delete keeps the session archived (hidden from every product surface)
 * and records the id here so this plugin's own list stops showing it.
 * Session data itself is never touched — consistent with the product, which
 * never deletes session logs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

/** The plugin-owned namespace name, reused as the on-disk folder name. */
export const TOMBSTONE_NAMESPACE = 'dsh-archived-sessions'

/** Persisted tombstone document. */
export interface TombstoneState {
  deleted: string[]
}

/** Live synchronous read / durable asynchronous write handle. */
export interface TombstoneScope {
  get(): TombstoneState
  update(patch: Partial<TombstoneState>): Promise<void>
}

/** Absolute path of the plugin-owned tombstone document. */
function storeFile(): string {
  const home =
    process.env.DSH_HOME !== undefined && process.env.DSH_HOME.trim() !== ''
      ? process.env.DSH_HOME
      : path.join(os.homedir(), '.dsh')
  return path.join(home, 'plugins', TOMBSTONE_NAMESPACE, 'tombstones.json')
}

/** Read the document, tolerating a missing or malformed file. */
function read(file: string): TombstoneState {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { deleted?: unknown }
    const deleted = Array.isArray(parsed.deleted)
      ? parsed.deleted.filter((value): value is string => typeof value === 'string')
      : []
    return { deleted }
  } catch {
    return { deleted: [] }
  }
}

/**
 * Register the namespace and return its owner scope.
 *
 * 0.2 removed `@deepseek-ai/dsh-settings`'s per-plugin namespaced store
 * (`ctx.settings.register`), so the tombstone document now lives in a
 * plugin-owned JSON file under `$DSH_HOME/plugins/<namespace>/`.
 * @param _ctx - the plugin context, retained for call-site stability.
 * @returns the owner scope backing the runtime's live tombstone read/write.
 */
export function registerTombstones(_ctx: Context): TombstoneScope {
  const file = storeFile()
  return {
    get: () => read(file),
    async update(patch) {
      const current = read(file)
      const deleted = (patch.deleted ?? current.deleted).filter(
        (value): value is string => typeof value === 'string',
      )
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, `${JSON.stringify({ deleted }, null, 2)}\n`, 'utf8')
    },
  }
}
