/**
 * The Play Store app's own plugins (android/app/src/main/java/com/qurannaba/app/
 * Naba*Plugin.java), for the few things Android's WebView can't do the
 * website's way: Google sign-in, voice search.
 */

type CapacitorGlobal = { isNativePlatform?: () => boolean; isPluginAvailable?: (name: string) => boolean }

/**
 * Whether this is the Play Store app and it has the given plugin. An install
 * from before the plugin was added doesn't, and keeps the website's way.
 */
export function hasNativePlugin(name: string): boolean {
  if (typeof window === 'undefined') return false
  const capacitor = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor
  return Boolean(capacitor?.isNativePlatform?.() && capacitor.isPluginAvailable?.(name))
}

const registered = new Map<string, unknown>()

/**
 * The plugin, registered once (Capacitor warns at a second registration).
 * Handed back wrapped: the plugin answers to any method name, `then` too, so a
 * promise resolved with it directly would never settle.
 */
export async function nativePlugin<T>(name: string): Promise<{ plugin: T }> {
  const { registerPlugin } = await import('@capacitor/core')
  if (!registered.has(name)) registered.set(name, registerPlugin<T>(name))
  return { plugin: registered.get(name) as T }
}
