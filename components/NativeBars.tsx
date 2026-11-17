'use client'

import { useEffect } from 'react'

interface NabaBars {
  set: (options: { color: string }) => Promise<void>
}

/** A computed CSS colour as #rrggbb, or null when it is not an opaque rgb() colour. */
function opaqueHex(css: string): string | null {
  const match = css.match(/^rgba?\(([^)]+)\)$/)
  if (!match) return null
  const [r, g, b, alpha = '1'] = match[1].split(/[\s,/]+/).filter(Boolean)
  if (Number(alpha) < 0.95) return null
  return '#' + [r, g, b].map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('')
}

/**
 * The colour showing along the top edge of the screen: the nearest background
 * behind the middle of it that runs edge to edge (a see-through header shows the
 * page through it), else the page's own, else the theme colour. Only one that
 * runs edge to edge counts: a white button or a grey card passing under the top
 * edge while scrolling would otherwise flash both bars that colour.
 */
function topColor(): string | null {
  for (let el = document.elementFromPoint(window.innerWidth / 2, 1); el; el = el.parentElement) {
    if (el.getBoundingClientRect().width < window.innerWidth - 1) continue
    const hex = opaqueHex(getComputedStyle(el).backgroundColor)
    if (hex) return hex
  }
  return (
    opaqueHex(getComputedStyle(document.body).backgroundColor) ??
    document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ??
    null
  )
}

/**
 * In the Play Store app, paints the strips behind the status bar and the
 * navigation bar in the colour of the page under them, with icons that stay
 * readable on it (android/…/NabaBarsPlugin.java), so every screen and theme
 * runs edge to edge, the way the installed web app looks. A light check a few
 * times a second follows page changes, theme changes and sheets opening. On
 * the website it does nothing.
 */
export default function NativeBars() {
  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!capacitor?.isNativePlatform?.()) return
    // No glow or stretch past the very top and bottom of a page, which Android draws in a light colour.
    // Only in the app: on the website the same setting would also stop the browser's pull-to-refresh.
    document.documentElement.style.overscrollBehaviorY = 'none'
    document.body.style.overscrollBehaviorY = 'none'
    let cancelled = false
    let timer = 0
    let stop = () => {}
    void import('@capacitor/core').then(({ registerPlugin }) => {
      if (cancelled) return
      const bars = registerPlugin<NabaBars>('NabaBars')
      let painted = ''
      const paint = () => {
        const color = topColor()
        if (!color || color === painted) return
        painted = color
        bars.set({ color }).catch(() => {
          painted = ''
        })
      }
      // Looked at again when something that could change the colour happens: a new screen, the theme,
      // a sheet or panel opening or closing. It used to measure the page three times a second for as
      // long as the app was open, each time making the phone lay the whole page out again (a stutter
      // on heavy screens: the mushaf, Qari's videos, long lists).
      let queued = 0
      const soon = () => {
        if (queued || document.hidden) return
        queued = window.setTimeout(() => {
          queued = 0
          paint()
        }, 120)
      }
      paint()
      const observer = new MutationObserver(soon)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
      observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ['class', 'style'] })
      const main = document.querySelector('main')?.parentElement
      if (main) observer.observe(main, { childList: true })
      window.addEventListener('popstate', soon)
      document.addEventListener('visibilitychange', soon)
      // Anything the above miss (a screen's own background changing), caught within a couple of seconds.
      timer = window.setInterval(soon, 2000)
      stop = () => {
        observer.disconnect()
        window.removeEventListener('popstate', soon)
        document.removeEventListener('visibilitychange', soon)
        window.clearTimeout(queued)
      }
    })
    return () => {
      cancelled = true
      window.clearInterval(timer)
      stop()
    }
  }, [])

  return null
}
