import { expect, type Page, test } from '@playwright/test'

/**
 * E2E：桌面档（1440×900）把结果芯片拖到导航项上 ⇒ 换到该分析页（F：结果流转）。
 *
 * 钉住两件事：
 *   ① 拖过阈值松手落在导航项上 = 一次投递，路由跟着换（此前只有手机档能做）；
 *   ② 换页后芯片仍在——结果图层挂在 App 作用域，不随路由卸载（叠加的前置条件）。
 *
 * 后端全部 `page.route` 合成（与 console-rail.spec.ts 同口径），不依赖真库/真后端。
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
          data: { taskId: 't-desk', status: 'pending', queuePosition: 1, createdAtMs: Date.now() },
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
            taskId: 't-desk',
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

test.use({ viewport: { width: 1440, height: 900 } })

test('桌面档：把结果芯片拖到导航项上，换到该分析页且芯片仍在', async ({ page }) => {
  await stub(page)
  await page.goto('/route-analysis')

  const slots = page.locator('.slot-btn')
  await expect(slots.nth(0)).toBeVisible({ timeout: 30_000 })
  await slots.nth(0).click()
  await page.locator('.poi-item').first().click()
  await slots.nth(3).click()
  await page.locator('.poi-item').nth(1).click()
  await page.getByRole('button', { name: '开始查询' }).click()

  const chip = page.locator('.task-result-strip .task-result-chip').first()
  await expect(chip).toBeVisible({ timeout: 30_000 })

  // 导航项在桌面 dock 上（同一套 data-dock-route 判据）
  const target = page.locator('[data-dock-route="/forecast"]').first()
  await expect(target).toBeVisible()

  const from = await chip.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('拿不到拖拽起止坐标')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 20, from.y, { steps: 3 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page).toHaveURL(/\/forecast/, { timeout: 10_000 })
  await expect(page.locator('.task-result-strip .task-result-chip')).toHaveCount(1)
  await page.screenshot({ path: '.local/design-shots/desktop-chip-drop.png' })
})
