import { expect, test } from '@playwright/test'

/**
 * E2E：选中态 chip 的文字对比度按真实计算样式量，不看 token 表。
 *
 * `.gcs-chip.sel` 曾用主色 rgb(33 114 202) 画字、底色 `--GCS-bg-active`
 * rgb(230 244 255)：实测 4.34:1，12px 正文要 4.5 —— 差一点点，仍在不合格一侧。
 * 改用 primary-hover 后 ≥4.5。这里读 computed color / background-color 现算，
 * 换任何一侧颜色都会红。
 */

const RATIO_JS = `(() => {
  const el = document.querySelector('.scenario-chip.sel')
  if (!el) return -1
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
    return { r: 255, g: 255, b: 255, a: 1 }
  }
  const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  const lum = (c) => 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b)
  const fg = parse(getComputedStyle(el).color)
  const bg = bgOf(el)
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
})()`

test('预测情景 chip 选中态文字对比度 ≥4.5:1', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/forecast')
  const chip = page.locator('.scenario-chip.sel')
  await expect(chip).toBeVisible()
  const ratio = (await page.evaluate(RATIO_JS)) as number
  expect(ratio).toBeGreaterThanOrEqual(4.5)
})
