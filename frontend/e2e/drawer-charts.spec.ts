/**
 * 抽屉模式图表回归（2026-11-01）。
 *
 * 判据：<960px 进入业务页 → 打开业务面板 → 图表容器与 canvas 均非 0 高。
 * 治的失效：2026-10-31 手工动态测试发现 4 个页面在抽屉内图表塌缩为 0，
 * 而当时前端 1,098 条单测全绿——单测断言 DOM 存在，不测渲染后的几何尺寸。
 * 后端一律 404 兜底：只验证布局链路，不依赖库/后端（与 smoke.spec 同口径）。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, type Page, test } from '@playwright/test'

/**
 * 选址雷达图只在有结果时渲染（`v-if="peak"`），404 兜底下不会挂载图表容器；
 * 用一份真实后端响应（resolution=0.9，12 个格子）驱动它，才能验证几何高度。
 */
const SITE_MAP_FIXTURE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures/site-map.json'),
  'utf8'
)

async function stubBackend404(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const { pathname } = new URL(route.request().url())
    if (!pathname.startsWith('/nest-api/') && !pathname.startsWith('/api/')) {
      return route.fallback()
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 404001, error: 'E2E：后端未接', data: null }),
    })
  })
}

const CASES = [
  { path: '/site-suitability', chart: '.suit-radar-chart' },
  { path: '/diversion-analysis', chart: '.transfer-chart' },
  { path: '/forecast', chart: '.line-chart' },
  { path: '/flood-analysis', chart: '.chart-container' },
]

for (const item of CASES) {
  test(`抽屉模式图表不塌缩：${item.path}`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    await stubBackend404(page)
    if (item.path === '/site-suitability') {
      await page.route('**/site-suitability/map**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: SITE_MAP_FIXTURE })
      )
    }
    await page.goto(item.path)

    await page.getByRole('button', { name: '菜单' }).click()

    const chart = page.locator(item.chart)
    await expect(chart).toBeVisible()
    const box = await chart.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThan(100)

    const canvas = page.locator(`${item.chart} canvas`)
    if ((await canvas.count()) > 0) {
      const canvasBox = await canvas.first().boundingBox()
      expect(canvasBox?.height ?? 0).toBeGreaterThan(100)
    }
  })
}
