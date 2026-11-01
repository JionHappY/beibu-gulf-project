import { expect, test } from '@playwright/test'

/**
 * E2E：窄屏下可点区域与提示文案不许被「视觉尺寸」坑掉。
 *
 * ① 预测时间轴：视觉轨道 14px，但命中区只有 14px 时手机上按偏两像素就滑不动
 *    （WCAG 2.5.8 要求至少 24×24）。这里量 boundingBox，不看截图。
 * ② 首屏 toast：一句话「热力点空间分布为示意性插值，非实测点位」在 390 宽下
 *    单行放不下，曾被强制单行 + ellipsis 截成半句。折行到两行后要求整句可见。
 */

test.use({ viewport: { width: 390, height: 844 } })

test('预测时间轴命中区 ≥24px，首屏提示整句可见', async ({ page }) => {
  await page.goto('/forecast')

  const range = page.locator('.time-range')
  await expect(range).toBeVisible()
  const box = await range.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(24)

  const toast = page.locator('.GCS-toast-message', {
    hasText: '热力点空间分布',
  })
  await expect(toast).toBeVisible()
  // 未被裁：滚动宽度不超过可视宽度，且两行封顶后仍完整包含全句
  const clipped = await toast.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(clipped).toBeLessThanOrEqual(0)
  await expect(toast).toHaveText('热力点空间分布为示意性插值，非实测点位')
})
