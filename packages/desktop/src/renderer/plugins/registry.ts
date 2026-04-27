import type { OoxmlPlugin, PluginContext } from './types'

const registered: OoxmlPlugin[] = []
const seenIds = new Set<string>()

export function registerPlugin(plugin: OoxmlPlugin): void {
  if (seenIds.has(plugin.id)) return
  seenIds.add(plugin.id)
  registered.push(plugin)
}

export function getAllPlugins(): readonly OoxmlPlugin[] {
  return registered
}

export function getActivePlugins(
  ctx: PluginContext,
  enabled: Record<string, boolean>
): OoxmlPlugin[] {
  return registered.filter((plugin) => {
    if (enabled[plugin.id] === false) return false
    try {
      return plugin.appliesTo(ctx)
    } catch {
      return false
    }
  })
}
