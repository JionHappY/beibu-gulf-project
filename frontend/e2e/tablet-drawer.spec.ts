/**
 * 平板档抽屉的图层控制可达性（2026-11-02）。
 *
 * 治的失效：把 5 个业务页的 `LayerControlPanel` 从 `#right` 挪进新增的 `#layers`
 * 插槽后（手机档控制台改序为 参数 → 结果 → 图层），抽屉分支当时只渲染
 * right/left，`#layers` 无人消费 ⇒ 640–959px 下图层控制**整个消失**，
 * 而 390/1440 两档都正常，单测与既有 e2e 全绿。
 *
 * 判据：抽屉里必须能看到 `.layer-panel`，且它是最后一个面板（与手机档同序）。
 */
import { expect, test } from '@playwright/test'

test('900px 抽屉里图层控制可见，且排在参数与结果之后', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.route('**/nest-api/**', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 404001, error: 'E2E：后端未接', data: null }),
    })
  )
  await page.goto('/site-suitability')
  await page.getByRole('button', { name: '菜单' }).click()

  const drawer = page.locator('.GCS-drawer')
  await expect(drawer).toBeVisible()

  const layerPanel = drawer.locator('.layer-panel')
  await expect(layerPanel).toBeVisible()

  // 与手机档控制台同序：参数 → 结果 → 图层。抽屉里最后一个 GCSPanel 就是图层控制。
  await expect(drawer.locator('.GCS-panel').last().locator('.layer-panel')).toHaveCount(1)
})
