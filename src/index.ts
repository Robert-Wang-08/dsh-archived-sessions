/**
 * dsh-archived-sessions host plugin: reads archived sessions through the
 * official DSH services (`workspaceRegistry` for the archive set,
 * `sessionQuery` for titles/surfaces, `sessionPersistence.readRaw` as the
 * corrupt-log fallback) and exposes them to the browser via the `archived`
 * Typert Remote namespace. Delete records a durable tombstone in the plugin's
 * own Config (`deleted`, persisted through its profile entry); session data is
 * never modified. The client half ships in the same package (`./client`); the
 * web server serves it under /plugins/dsh-archived-sessions/client.js.
 *
 * Desktop + web compatible: only official DSH contracts are used, no
 * desktop-only services are injected.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
import { ArchivedSessionsRuntime } from './runtime.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import {
  readTombstones,
  tombstoneWriter,
  configureNoAutoPage,
  type TombstoneConfig,
} from './settings.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = '@jiangdaoli/dsh-archived-sessions'

/** Services required before load: the Typert registry. */
export const inject = ['typert']

/**
 * The plugin's Config schema. Re-exported so the Loader derives the settings
 * form (the volatile `deleted` field) from this entry.
 */
export { Config } from './settings.ts'

/**
 * Mount the archived service and its strict Typert manifest.
 * @param ctx - host cordis context.
 * @param config - the entry's parsed config; `deleted` is a live reference.
 */
export function apply(ctx: Context, config: TombstoneConfig): void {
  const readDeleted = () => readTombstones(config)
  const persistDeleted = tombstoneWriter(ctx)
  new ArchivedSessionsRuntime(ctx, readDeleted, persistDeleted)
  // The plugin ships its own settings page; never auto-generate a second one.
  configureNoAutoPage(ctx)
  // Strict endpoint registration: the gateway resolves archived/* from this
  // manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => {
      void dispose()
    }
  }, 'dsh-archived-sessions: typert manifest')
}
