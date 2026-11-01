import { expect, test } from '@playwright/test'

/**
 * E2E：平板档（640–959）的侧滑抽屉自称 role="dialog" + aria-modal="true"。
 *
 * aria-modal 对读屏的意思是「外面是惰性的」，可键盘此前 Tab 到第 29 个就漏到 body、
 * 进而进到遮罩背后的控件——声明与实际不符。这里钉：焦点进抽屉、Tab 不逃、
 * Shift+Tab 反向绕回、Esc 关闭回焦触发键。
 */

test.use({ viewport: { width: 900, height: 900 } })

async function focusedInDrawer(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement
    return !!el && !!el.closest('.GCS-drawer')
  })
}

test('抽屉展开后焦点进内、Tab 不逃出、Esc 关回菜单键', async ({ page }) => {
  await page.goto('/forecast')
  const menu = page.getByRole('button', { name: /菜单|更多/ }).first()
  await expect(menu).toBeVisible()
  await menu.click()

  const drawer = page.locator('.GCS-drawer')
  await expect(drawer).toBeVisible()
  await expect(page.locator('.GCS-drawer__close')).toBeFocused()

  // 抽屉内容很长：连按 40 次 Tab 都不许跑出去（此前第 29 次就落到 body）
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    expect(await focusedInDrawer(page), `第 ${i + 1} 次 Tab 落在抽屉外`).toBe(true)
  }

  // 反向：Shift+Tab 也不能跑到遮罩后
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(await focusedInDrawer(page), `第 ${i + 1} 次 Shift+Tab 落在抽屉外`).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(menu).toBeFocused()
})
