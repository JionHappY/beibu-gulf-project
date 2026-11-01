import { expect, type Page, test } from '@playwright/test'

/**
 * E2E：手机档（390×844）结果芯片进控制台「中转带」。
 *
 * 钉住三件事：
 *   ① 任务 done 后芯片渲染在控制台的 `.console-rail` 里，而不是桌面档的右下浮条
 *      （手机档浮条已收起，两处消费同一份数据、不能同时出现）；
 *   ② 点一下芯片 = 上图（`.active`）—— 这依赖 `layerIR.owned` 是响应式判据
 *      （裸 Set 不触发 computed，芯片会永远停在「未上图」）；
 *   ③ 客户端路由换到 /flood-analysis 后芯片仍在且仍 active ⇒ 结果跨路由存活，
 *      这是「两个分析结果叠加在同一张图上」的前置条件。
 *
 * 后端全部 `page.route` 合成（与 route-task-flow.spec.ts 同口径），不依赖真库/真后端。
 */

const POIS = [
  {
    id: 'poi-from',
    name: '钦州港西港区',
    type: 'port',
    source: 'port',
    city: '钦州市',
    district: '钦南区',
    lng: 108.62,
    lat: 21.72,
  },
  {
    id: 'poi-to',
    name: '防城港渔澫港区',
    type: 'port',
    source: 'port',
    city: '防城港市',
    district: '港口区',
    lng: 108.35,
    lat: 21.55,
  },
]

function routeResult() {
  return {
    found: true as const,
    mode: 'distance' as const,
    distanceM: 12300,
    durationMin: 18.5,
    snapDistanceM: { from: 50, to: 80 },
    edgeCount: 12,
    coordinates: [
      [108.62, 21.72],
      [108.5, 21.65],
      [108.35, 21.55],
    ],
  }
}

async function stub(page: Page): Promise<void> {
  let n = 0
  await page.route('**/*', (route) => {
    const req = route.request()
    const { pathname } = new URL(req.url())
    if (pathname === '/nest-api/route/pois') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: POIS }),
      })
    }
    if (req.method() === 'POST' && pathname === '/nest-api/task') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: { taskId: 't-rail', status: 'pending', queuePosition: 1, createdAtMs: Date.now() },
        }),
      })
    }
    if (pathname.startsWith('/nest-api/task/')) {
      n += 1
      const done = n >= 2
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: {
            taskId: 't-rail',
            domain: 'route-path',
            route: '/route-analysis',
            status: done ? 'done' : 'running',
            progress: done ? 1 : 0.5,
            retryCount: 0,
            createdAtMs: Date.now(),
            ...(done ? { result: routeResult() } : {}),
          },
        }),
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
}

test.use({ viewport: { width: 390, height: 844 } })

test('手机档：结果芯片进控制台中转带，点击上图，换路由仍在', async ({ page }) => {
  await stub(page)
  await page.goto('/route-analysis')

  const slots = page.locator('.slot-btn')
  await expect(slots.nth(0)).toBeVisible({ timeout: 30_000 })
  await slots.nth(0).click()
  await page.locator('.poi-item').first().click()
  await slots.nth(3).click()
  await page.locator('.poi-item').nth(1).click()
  await page.getByRole('button', { name: '开始查询' }).click()

  // 结果芯片出现在控制台中转带（不是右下浮条）
  const rail = page.locator('.console-rail .task-result-chip')
  await expect(rail.first()).toBeVisible({ timeout: 30_000 })
  expect(await page.locator('.task-result-strip').isVisible()).toBe(false)
  await page.screenshot({ path: '.local/design-shots/rail-390.png', fullPage: false })

  // 点击上图 → active
  await rail.first().click()
  await expect(page.locator('.console-rail .task-result-chip.active')).toHaveCount(1)

  // 换路由：走客户端路由（整页 goto 会丢内存态任务槽），芯片仍在且仍 active
  await page.locator('.dock-plus-wrap button').click()
  await page.getByRole('button', { name: '浸没分析' }).click()
  await expect(page).toHaveURL(/flood-analysis/)
  await expect(page.locator('.console-rail .task-result-chip')).toHaveCount(1)
  await expect(page.locator('.console-rail .task-result-chip.active')).toHaveCount(1)
  await page.screenshot({ path: '.local/design-shots/rail-390-flood.png' })
})
