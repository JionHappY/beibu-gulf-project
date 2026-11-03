import { expect, test } from '@playwright/test'

/**
 * E2E：候选格名单必须自曝「总共多少格、取的是前多少」。
 *
 * 名单只列按得分排序的前 60 格（CANDIDATE_LIMIT），而格网实测 8,548 格；
 * 面板不写这句说明时，翻完 15 页会让人以为整个格网只有 60 个候选。
 * 同时钉住「说明行不吃掉列表高度」——说明行是列表的兄弟节点，列表 100% 高会溢出面板。
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
  maxLandFrac: 0.99,
  resolution: 0.02,
  source: 'e2e',
}

const MAP = {
  type: 'FeatureCollection',
  features: [0.9, 0.8, 0.7].map((score, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [108.6 + i * 0.01, 21.7] },
    properties: { id: 100 + i, score },
  })),
  metadata: {
    count: 3,
    weights: WEIGHTS,
    weightsSource: 'e2e',
    kdeP99: 1,
    minLandFrac: 0.5,
    maxLandFrac: 0.99,
    maxPortDistanceKm: 50,
  },
}

test('候选名单自曝总数与截断，且说明行不挤掉列表', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/nest-api/site-suitability/defaults') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: DEFAULTS }),
      })
    }
    if (pathname === '/nest-api/site-suitability/map') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: MAP }),
      })
    }
    return route.continue()
  })

  await page.goto('/site-suitability')
  const note = page.getByTestId('candidate-total')
  await expect(note).toHaveText(
    '共 3 格 · 按得分取前 3 · 仅含水陆交界格 · 距既有港口 ≤ 50 km · 点击行定位'
  )

  // 列表行数仍是前 3；面板无纵向溢出（说明行与列表共存不挤爆）
  await expect(page.locator('.cell-name')).toHaveCount(3)
  const overflow = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('.GCS-panel')].find((el) =>
      (el.textContent ?? '').includes('候选格名单')
    ) as HTMLElement | undefined
    return panel ? panel.scrollHeight - panel.clientHeight : -1
  })
  expect(overflow).toBeLessThanOrEqual(0)
})

/**
 * a1「结果前置」：控制台的阅读顺序由页面声明。
 * 选址页先给结论（画像 → 候选名单），权重（参数）放最后；
 * 判据看 DOM 顺序而不是视觉位置——控制台就是按 DOM 自上而下读的。
 */
test('控制台里结果先于参数（画像 → 名单 → 权重）', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 })
  await page.route('**/*', (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/nest-api/site-suitability/defaults') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: DEFAULTS }),
      })
    }
    if (pathname === '/nest-api/site-suitability/map') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: MAP }),
      })
    }
    return route.continue()
  })
  await page.goto('/site-suitability')
  // 控制台是挂载后才有的（地图初始化 + 首次响应），不等到它就 evaluate 会拿到 null
  await expect(page.locator('.mobile-console .console-body')).toHaveCount(1, { timeout: 30_000 })

  const order = await page.evaluate(() => {
    const body = document.querySelector('.mobile-console .console-body')
    if (!body) return null
    // 按面板的固定文案认类：雷达「综合得分」/ 名单「按得分取前」/ 权重「准则权重」
    return [...body.children].map((el) => {
      const t = (el.textContent ?? '').replace(/\s+/g, '')
      if (t.includes('综合得分')) return 'radar'
      if (t.includes('按得分取前')) return 'candidates'
      if (t.includes('准则权重')) return 'weights'
      if (t.includes('底图')) return 'layers'
      return 'other'
    })
  })
  expect(order?.slice(0, 2)).toEqual(['radar', 'candidates'])
  expect(order?.[order.length - 2]).toBe('weights')
})
