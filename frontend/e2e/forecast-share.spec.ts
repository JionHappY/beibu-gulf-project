/**
 * 预测页分流份额行（G2）的几何与内容回归。
 *
 * 治的失效：份额行作为普通流内块加进柱图面板时，面板内容比固定高度高 23px，
 * `overflow:hidden` 把行尾切掉——单测与截图都不易发现，只有量 scrollHeight 才看得见。
 * 现做法是面板留 26px 底部留白、份额行绝对定位落在留白里，图表按 content box 自然变矮。
 *
 * 判据：柱图 canvas 仍有高度（不是被压成 0）、面板无纵向裁切、份额行文案含「钦州」。
 * 后端一律 404 兜底：本用例只验布局与解析，不依赖库/后端。
 */
import { expect, test } from '@playwright/test'

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]

for (const vp of VIEWPORTS) {
  test(`${vp.width}px 预测份额行不裁切且柱图不塌缩`, async ({ page }) => {
    await page.setViewportSize(vp)
    // 份额行只在拿到 breakdown 时渲染；其余接口一律 404（本用例只验布局与解析）。
    // 注意顺序：Playwright 后注册的路由先匹配，所以分支写在同一处理器里，不靠注册顺序。
    await page.route('**/*', (route) => {
      const { pathname } = new URL(route.request().url())
      if (pathname.includes('/diversion/breakdown')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 200,
            data: {
              year: 2026,
              transfer: { year: 2026, coal: 400, grain: 800, ironOre: 300, sandCement: 0 },
              byPort: {
                qinzhou: { coal: 200, grain: 400, ironOre: 150, total: 750 },
                fangchenggang: { coal: 160, grain: 330, ironOre: 110, total: 600 },
                beihai: { coal: 40, grain: 70, ironOre: 40, total: 150 },
              },
              sankeyFlows: [],
            },
          }),
        })
      }
      if (!pathname.startsWith('/nest-api/') && !pathname.startsWith('/api/')) {
        return route.fallback()
      }
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404001, error: 'E2E：后端未接', data: null }),
      })
    })
    await page.goto('/forecast')

    const share = page.locator('[data-testid="diversion-share"]')
    await expect(share).toBeVisible()
    await expect(share).toContainText('钦州')

    // 面板无纵向裁切（>4px 即曾被切）
    const over = await page.evaluate(() => {
      const panel = document.querySelector('.bar-panel') as HTMLElement
      return panel.scrollHeight - panel.clientHeight
    })
    expect(over).toBeLessThanOrEqual(4)

    // 柱图仍有高度（flex 压缩方案会把 ECharts 容器算成 0，本判据能抓住）
    const canvasBox = await page.locator('.bar-panel .bar-chart canvas').first().boundingBox()
    expect(canvasBox?.height ?? 0).toBeGreaterThan(100)
  })
}
