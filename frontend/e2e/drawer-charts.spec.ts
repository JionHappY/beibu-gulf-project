/**
 * 图表几何回归（2026-11-01，zcode 原 900px 单视口版扩到三档）。
 *
 * 判据：<960px 打开业务抽屉后 / ≥960px 直接在面板里，图表容器与 canvas 均非 0 高。
 * 治的失效：2026-10-31 手工动态测试发现 4 个页面在抽屉内图表塌缩为 0，
 * 而当时前端 1,098 条单测全绿——单测断言 DOM 存在，不测渲染后的几何尺寸。
 * 2026-11-01 复查发现原版只钉了 900px 一档，而窄屏首页概览不可达恰恰只在 390px 复现；
 * 三档（390 手机 / 900 平板抽屉 / 1440 桌面）各钉一遍，覆盖两种面板承载方式。
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

const CASES: Array<{ path: string; chart: string; minWidth?: number }> = [
  // 首页概览图曾因 Home 分支只注入图层控制而在窄屏完全不可达；补 #left 后纳入回归。
  // 2026-11-02 起 <640 的首页控制台让位给五个分析入口（HomeAnalysisGrid）+ 图层控制，
  // 概览图只在 ≥640 渲染 ⇒ 该档不参与本用例（不是坏掉，是承载面变了）
  { path: '/', chart: '.line-chart', minWidth: 640 },
  { path: '/site-suitability', chart: '.suit-radar-chart' },
  { path: '/diversion-analysis', chart: '.transfer-chart' },
  { path: '/forecast', chart: '.line-chart' },
  { path: '/flood-analysis', chart: '.chart-container' },
]

/** 960px 是抽屉模式断点（layoutTier），三档各钉一侧与断点上方的桌面承载 */
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 900, height: 800 },
  { width: 1440, height: 900 },
]

for (const vp of VIEWPORTS) {
  for (const item of CASES) {
    if (item.minWidth && vp.width < item.minWidth) continue
    test(`${vp.width}px 图表不塌缩：${item.path}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await stubBackend404(page)
      if (item.path === '/site-suitability') {
        await page.route('**/site-suitability/map**', (route) =>
          route.fulfill({ status: 200, contentType: 'application/json', body: SITE_MAP_FIXTURE })
        )
      }
      await page.goto(item.path)

      // 三档各自的承载面（2026-11-02 随控制台骨架更新）：
      //   <640 控制台直接承载图表，没有抽屉也没有菜单键；
      //   640–959 仍是抽屉档，要先点菜单；
      //   ≥960 面板直接挂在布局上。
      if (vp.width >= 640 && vp.width < 960) {
        await page.getByRole('button', { name: '菜单' }).click()
      }

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
}
