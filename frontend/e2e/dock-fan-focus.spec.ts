import { expect, test } from '@playwright/test'

/**
 * E2E：窄屏 ＋ 半圆是最小视口唯一的分析入口，必须纯键盘可用。
 *
 * 它是带遮罩的浮层：遮罩把底下的控制台盖住，鼠标点不到，但键盘仍能 Tab 进去——
 * 那就是「看得见的按钮不能按、看不见的按钮却能按」。这里钉三件事：
 *   ① 展开后焦点落在弧上（不是留在 ＋ 上）
 *   ② Tab 在弧内循环，不逃到遮罩背后
 *   ③ Esc 关闭并把焦点还给 ＋
 */

test.use({ viewport: { width: 390, height: 844 } })

test('半圆展开后焦点进弧内、Tab 循环、Esc 关回 ＋', async ({ page }) => {
  await page.goto('/forecast')
  const plus = page.locator('.dock-plus-wrap button').first()
  await expect(plus).toBeVisible()
  await plus.click()

  const fan = page.locator('.dock-fan')
  await expect(fan).toBeVisible()
  await expect(page.locator('.dock-fan__item button').first()).toBeFocused()

  // 连续 Tab 走过 4 个入口后必须绕回第一个，而不是掉到遮罩背后
  const items = page.locator('.dock-fan__item button')
  const count = await items.count()
  expect(count).toBe(4)
  for (let i = 1; i < count; i++) {
    await page.keyboard.press('Tab')
    await expect(items.nth(i)).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(items.first()).toBeFocused()

  // Shift+Tab 反向绕回去
  await page.keyboard.press('Shift+Tab')
  await expect(items.nth(count - 1)).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(fan).toHaveCount(0)
  await expect(plus).toBeFocused()
})
