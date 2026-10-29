/**
 * E2E：任务提交→轮询→done→前端渲染非空结果（全流程，可控后端夹具）。
 *
 * 背景：`frontend/e2e/*.spec.ts` 的现有用例（smoke/first-paint/perf-drag）把后端请求全部
 * `page.route` 成 404，只断言「页面壳 + 地图就绪 + 无错误态」，不碰任何数据面。本文件补一条
 * 「真走通」的端到端链路，证明前端任务编排（提交→链式轮询→终态→结果上屏）在可控后端下闭环：
 *
 *   航线分析页选起点/终点（POI 下拉，命中合成夹具）
 *     → 点「开始查询」
 *     → taskStore.submitAndWait
 *     → POST /nest-api/task            （合成：返回 taskId + 初始 pending）
 *     → 链式轮询 GET /nest-api/task/:id（先 running 后 done，result 带非空里程/时长/段数）
 *     → 页面结果面板渲染非空里程/时长/段数
 *
 * 断言目标是「页面出现非空结果/面板数据（`.summary-main` 的非空 km 文本）」，而非只断言壳。
 * 全部后端由 `route.fulfill` 合成，不依赖真库/真后端；其余未显式合成的 `/nest-api`、`/api`
 * 请求统一 404 兜底（与既有 smoke 同口径），前端走各自降级。
 *
 * 本文件内保留两个用例：
 *   ① happy path —— 后端合成可控结果，断言结果面板出现非空数据；
 *   ② 404 对照 —— 后端全拦截，断言页面仍挂载且结果面板不出现（证明 happy path 非假绿、降级仍成立）。
 * 原 smoke.spec.ts 不受影响（纯新增文件）——运行原 smoke 仍应全绿。
 *
 * 落点：frontend/e2e/route-task-flow.spec.ts
 */
import { expect, type Page, test } from '@playwright/test'

/** 合成 POI 列表：起点/终点各一条（id/name/type/source/city/district/lng/lat 齐全，过 zod） */
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

/** 合成的 RoutePathResponse：found=true，非空 result（里程/时长/段数 + 真实折线坐标） */
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

/** 后端合成夹具：POST /task、GET /task/:id、GET /route/pois 合成；其余后端域 404 兜底 */
async function stubBackendForFlow(page: Page): Promise<void> {
  let taskGetCount = 0
  await page.route('**/*', (route) => {
    const req = route.request()
    const { pathname } = new URL(req.url())
    const method = req.method()

    // 1) POI 搜索：返回可控兜底列表（起点/终点各一），供 UI 填充槽位
    if (pathname === '/nest-api/route/pois') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 200, data: POIS }),
      })
    }
    // 2) 任务提交：返回 taskId + 初始 pending（taskSubmitResponseSchema 必填字段齐全）
    if (method === 'POST' && pathname === '/nest-api/task') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: {
            taskId: 'task-flow-1',
            status: 'pending',
            queuePosition: 1,
            createdAtMs: Date.now(),
          },
        }),
      })
    }
    // 3) 任务轮询：首轮 running（激活态，继续轮询），其后 done（带非空 result）
    //    pathname 形如 /nest-api/task/task-flow-1，必须排在 POST 分支之后判定
    if (pathname.startsWith('/nest-api/task/')) {
      taskGetCount += 1
      const done = taskGetCount >= 2
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          data: {
            taskId: 'task-flow-1',
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
    // 4) 其余后端域（auth/me、favorites 等）：统一 404 兜底，页面走各自降级（与 smoke 同口径）
    if (pathname.startsWith('/nest-api/') || pathname.startsWith('/api/')) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404001, error: 'E2E：后端未接', data: null }),
      })
    }
    // 5) 前端自身资源 / 静态瓦片：放行真实请求
    return route.fallback()
  })
}

test.describe('任务全流程（提交→轮询→done→结果上屏）', () => {
  test('① happy path：提交→轮询→done，结果面板渲染非空里程', async ({ page }) => {
    await stubBackendForFlow(page)
    await page.goto('/route-analysis')

    // 控制面板挂载即可交互（不依赖地图 canvas 就绪）
    const panel = page.locator('.route-panel')
    await expect(panel).toBeVisible({ timeout: 30_000 })

    const slotBtns = page.locator('.slot-btn')

    // 选起点：点「起点」槽 → POI 下拉展开 → 点第一个 POI
    await slotBtns.nth(0).click()
    await expect(page.locator('.poi-drop')).toBeVisible()
    await page.locator('.poi-item').first().click()
    await expect(slotBtns.nth(0)).toContainText('钦州港西港区')

    // 选终点：点「终点」槽 → 下拉重新展开 → 点第二个 POI（坐标不同，from≠to）
    await slotBtns.nth(3).click()
    await expect(page.locator('.poi-drop')).toBeVisible()
    await page.locator('.poi-item').nth(1).click()
    await expect(slotBtns.nth(3)).toContainText('防城港渔澫港区')

    // 「开始查询」可用后点击，触发 taskStore.submitAndWait
    const queryBtn = page.getByRole('button', { name: '开始查询' })
    await expect(queryBtn).toBeEnabled()
    await queryBtn.click()

    // 后端合成：轮询 pending→done，结果面板渲染非空里程（断言非空结果，而非只断言壳）
    const summary = page.locator('.summary-main')
    await expect(summary).toBeVisible({ timeout: 30_000 })
    await expect(summary).toHaveText(/\d+\.\d+\s*km/)

    // 副行含段数（非空结果的另一维度），确认 summary 由真实 result 派生
    await expect(page.locator('.summary-sub').first()).toContainText('段')
  })

  test('② 404 对照：后端全拦截时页面仍挂载、结果面板不出现（降级成立 + happy path 非假绿）', async ({
    page,
  }) => {
    // 与既有 smoke 同口径：所有后端域 404，前端走降级
    await page.route('**/*', (route) => {
      const { pathname } = new URL(route.request().url())
      if (!pathname.startsWith('/nest-api/') && !pathname.startsWith('/api/')) {
        return route.fallback()
      }
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404001, error: 'E2E 对照：后端未接', data: null }),
      })
    })

    await page.goto('/route-analysis')
    // 壳挂载（控制面板可见），证明整页未崩、降级路径成立
    await expect(page.locator('.route-panel')).toBeVisible({ timeout: 30_000 })
    // 结果面板始终处于提示态：无 .summary-main —— 反证 ① 的成功确由后端夹具驱动
    await expect(page.locator('.summary-main')).toHaveCount(0)
  })
})
