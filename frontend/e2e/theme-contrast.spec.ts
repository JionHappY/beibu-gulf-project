import { expect, test } from '@playwright/test'

/**
 * E2E：亮/暗两套主题下面板内文字都要过 AA（4.5:1，大字 3:1）。
 *
 * 亮色侧此前的 token 修正只覆盖到「已知那几处」——选中态 chip 就是漏网的一处
 * （4.34:1）。这里把判据从「逐个 token 断言」换成「按页面真实计算样式扫面板」：
 * 换任何一侧的颜色、或新加一处低对比文字，都会红。
 *
 * 扫描范围限定在 `.GCS-panel` 内：地图上的白色标注压在底图上，颜色对比由
 * 底图决定，不是 DOM 可判的。
 */

const SCAN = `(() => {
  const parse = (s) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(s)
    if (!m) return null
    const p = m[1].split(',').map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const bgOf = (node) => {
    let n = node
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.5) return c
      n = n.parentElement
    }
    const root = parse(getComputedStyle(document.documentElement).backgroundColor)
    return root && root.a > 0.5 ? root : { r: 255, g: 255, b: 255, a: 1 }
  }
  const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  const lum = (c) => 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b)
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

  const bad = []
  for (const panel of document.querySelectorAll('.GCS-panel')) {
    for (const el of panel.querySelectorAll('*')) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').trim()
      if (!text) continue
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue
      // WCAG 1.4.3 豁免失效控件：分页首/末页的 « ‹ 就是这种（灰字 + disabled）
      if (el.closest('button:disabled, [aria-disabled="true"], .is-disabled')) continue
      const fg = parse(cs.color)
      if (!fg) continue
      const fs = parseFloat(cs.fontSize)
      const bold = parseInt(cs.fontWeight, 10) >= 700
      const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5
      const cr = ratio(fg, bgOf(el))
      if (cr + 0.01 < need) bad.push(text.slice(0, 20) + ' @ ' + cr.toFixed(2))
    }
  }
  return { violations: bad, theme: document.documentElement.dataset.theme }
})()`

const ROUTES = ['/forecast', '/route-analysis', '/site-suitability']

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} 主题：面板内文字对比度全部 ≥AA`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('gcs-theme', t), theme)
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const route of ROUTES) {
      await page.goto(route)
      await page.waitForTimeout(1500)
      const res = (await page.evaluate(SCAN)) as { violations: string[]; theme: string }
      expect(res.theme).toBe(theme)
      expect(res.violations, `${theme} ${route}`).toEqual([])
    }
  })
}
