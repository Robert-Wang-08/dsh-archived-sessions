/**
 * The plugin-owned tombstone section: session ids the user chose to remove
 * from the archive list. DSH has no session-delete API, and removing a
 * session from `archivedSessionIds` would resurrect it as a stray row in the
 * sidebar (the product UI shows non-archived, unaccounted sessions). So delete
 * keeps the session archived (hidden from every product surface) and records
 * the id here so this plugin's own list stops showing it. Session data itself
 * is never touched — consistent with the product, which never deletes session
 * logs.
 *
 * DSH 0.2 replaced the standalone settings-namespace API
 * (`ctx.settings.register(ns, schema, { applies: 'live' })` returning a
 * `SettingsScope`) with Config-derived forms: a plugin declares its editable
 * values on its own `Config` schema, reads them through the live reference
 * handed to `apply`, and persists edits to its profile entry with
 * `settings.update(entryId, patch)`. Only `.volatile()` fields are
 * form-editable, and a volatile-only write commits live without remounting the
 * plugin. The entry id is the plugin's Loader row id (`dsh-archived-sessions`,
 * declared in `cordis.patch.yml`).
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Volatile tombstone field, exposed as the plugin's Cordis Config. */
export const TombstoneSchema: z<{ deleted: string[] }> = z.object({
  deleted: z.array(z.string()).default([]).volatile(),
})

/** The plugin's Cordis Config schema (only the tombstone section). */
export const Config: z<{ deleted: string[] }> = TombstoneSchema

/** Live config reference handed to `apply` for the volatile `deleted` field. */
export interface TombstoneConfig {
  deleted: { get(): readonly string[] | undefined }
}

/** Minimal face of the 0.2 `SettingsForms` service used for the durable write. */
interface SettingsFormsLike {
  configure(presentation: { auto?: boolean }, owner?: unknown): () => void
  update(ns: string, patch: object, expectedRevision?: number): Promise<void>
}

/** The Loader entry carrying this plugin's config (absent outside a profile). */
interface LoaderFiberLike {
  entry?: { options?: { id?: string } }
}

/** Profile entry id of this plugin; absent when mounted without Loader. */
export function pluginEntryId(ctx: Context): string | undefined {
  const fiber = ctx.fiber as unknown as LoaderFiberLike | undefined
  return fiber?.entry?.options?.id
}

/** Read the current tombstone ids from the live volatile reference. */
export function readTombstones(config: TombstoneConfig): ReadonlySet<string> {
  const value = config.deleted.get()
  return new Set(Array.isArray(value) ? value : [])
}

/** Build the durable writer that persists the tombstone set to the plugin entry. */
export function tombstoneWriter(ctx: Context): (ids: readonly string[]) => Promise<void> {
  return async (ids) => {
    const settings = ctx.get('settings') as SettingsFormsLike | undefined
    const entry = pluginEntryId(ctx)
    if (settings === undefined || entry === undefined) {
      throw new Error('settings service or profile entry unavailable')
    }
    await settings.update(entry, { deleted: [...ids] })
  }
}

/** Keep the plugin's own settings page authoritative (disable schema auto-page). */
export function configureNoAutoPage(ctx: Context): void {
  ctx.inject(['settings'], (child) => {
    const settings = child.get('settings') as SettingsFormsLike | undefined
    if (settings === undefined) return
    child.effect(() => settings.configure({ auto: false }, ctx.fiber))
  })
}
