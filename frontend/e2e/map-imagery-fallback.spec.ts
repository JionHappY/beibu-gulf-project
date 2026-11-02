import { expect, test } from '@playwright/test'

/**
 * E2E：底图瓦片不可达时的失败态。
 *
 * 天地图（3D 页的影像/注记底图）在内网、断网或密钥失效时整层失败，
 * Cesium 会露出 `globe.baseColor` 的默认值 #000080 —— 整屏深蓝，看起来像地图坏了。
 * 这里钉住：首次瓦片错误后必须切到中性底色，并在容器上留下 `data-imagery-fallback`
 * （既是判据，也是将来做「底图不可用」提示的挂点）。
 *
 * 用 `page.route` 直接 abort 天地图域，不依赖宿主机是否通外网。
 */

test.use({ viewport: { width: 390, height: 844 } })

test('底图瓦片不可达：切中性底色并打标记，不留整屏深蓝', async ({ page }) => {
  await page.route('**://t*.tianditu.gov.cn/**', (route) => route.abort())
  await page.goto('/flood-analysis')

  const wrapper = page.locator('.unified-map-wrapper[data-imagery-fallback="true"]')
  await expect(wrapper).toHaveCount(1, { timeout: 30_000 })
  await page.screenshot({ path: '.local/design-shots/imagery-fallback-390.png' })
})
