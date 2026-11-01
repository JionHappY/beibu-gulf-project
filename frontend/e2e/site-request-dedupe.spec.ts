import { expect, test } from '@playwright/test'

/**
 * E2E：选址页首屏只发一次 /site-suitability/map。
 *
 * 页面首刷是「renderer ready → doUpdate → 拉 defaults → 写回权重」，写回会再触发一次
 * 300ms 防抖的 doUpdate。首刷请求（AHP 栅格）通常还没回来，于是第二次 cache miss，
 * 参数逐字相同地再发一遍：进一次页面打两次重接口。
 *
 * 这里用桩把「请求慢」这个前提做出来（延迟 800ms 返回），再数请求次数：
 * 去重逻辑在途丢弃 ⇒ 1 次；去掉去重 ⇒ 2 次（红样即此）。
 */

const WEIGHTS = { inundation: 0.43, terrain: 0.085, land: 0.205, access: 0.11, demand: 0.17 }

const DEFAULTS = {
  weights: WEIGHTS,
  thresholds: {
    inundLowM: 0.5,
    inundHighM: 2,
    slopeBestDeg: 2,
    slopeWorstDeg: 15,
    portScaleM: 5000,
    roadScaleM: 3000,
  },
  minLandFrac: 0.5,
  resolution: 0.02,
  source: 'e2e',
}

const MAP = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [108.62, 21.72] },
      properties: { id: 1, score: 0.9 },
    },
  ],
  metadata: {
    count: 1,
    weights: WEIGHTS,
    weightsSource: 'e2e',
    kdeP99: 1,
    minLandFrac: 0.5,
  },
}

test('选址首屏只请求一次地图（权重回写不触发第二次）', async ({ page }) => {
  let mapCalls = 0
  let defaultsCalls = 0

  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/nest-api/site-suitability/defaults') {
      defaultsCalls += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: DEFAULTS }),
      })
    }
    if (pathname === '/nest-api/site-suitability/map') {
      mapCalls += 1
      // 慢响应：让防抖后的第二次 doUpdate 落在首刷在途窗口内（真实栅格请求就是这个量级）
      await new Promise((r) => setTimeout(r, 800))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: MAP }),
      })
    }
    if (pathname.startsWith('/nest-api/') || pathname.startsWith('/api/')) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404001, error: 'E2E', data: null }),
      })
    }
    return route.fallback()
  })

  await page.goto('/site-suitability')
  await page.waitForTimeout(2500)

  expect(defaultsCalls).toBe(1)
  expect(mapCalls).toBe(1)
})
