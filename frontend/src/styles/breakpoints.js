// The ONLY responsive breakpoints in the app. Use these names and widths
// everywhere — in the matching media queries in responsive.css, and via
// useViewport() when a layout decision genuinely needs JavaScript.
//
//   phone   < 640 px     participants joining and answering
//   tablet  640–1023 px  participants, a facilitator on an iPad
//   laptop  1024–1599 px facilitator laptop (1280–1512 common)
//   large   ≥ 1600 px    projector / external monitor (1920×1080)
//
// Keep responsive.css media queries in sync with these numbers.
import { useEffect, useState } from 'react'

export const BP = {
  phoneMax: 639,
  tabletMin: 640,
  tabletMax: 1023,
  laptopMin: 1024,
  laptopMax: 1599,
  largeMin: 1600,
}

// Matching media-query strings (for matchMedia / documentation).
export const MEDIA = {
  phone: `(max-width: ${BP.phoneMax}px)`,
  tabletUp: `(min-width: ${BP.tabletMin}px)`,
  laptopUp: `(min-width: ${BP.laptopMin}px)`,
  largeUp: `(min-width: ${BP.largeMin}px)`,
}

// Live viewport width + named flags. Only for the few places that must branch in
// JS; prefer the CSS classes in responsive.css for pure layout.
export function useViewport() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? BP.laptopMin : window.innerWidth))
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return {
    width,
    isPhone: width <= BP.phoneMax,
    isTablet: width >= BP.tabletMin && width <= BP.tabletMax,
    isLaptop: width >= BP.laptopMin && width <= BP.laptopMax,
    isLarge: width >= BP.largeMin,
    atLeast: n => width >= n,
    below: n => width < n,
  }
}
