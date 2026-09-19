import * as React from "react"

const FALLBACK_LOCALE = "en-US"

/**
 * The visitor's locale, resolved only after mount. `navigator.language`
 * isn't available during SSR, and the server/client can otherwise disagree
 * on the runtime's default locale - both fail hydration - so the first
 * render always matches the server's fixed fallback and swaps to the real
 * locale once mounted.
 */
export function useLocale(): string {
  const [locale, setLocale] = React.useState(FALLBACK_LOCALE)

  React.useEffect(() => {
    setLocale(navigator.language)
  }, [])

  return locale
}
