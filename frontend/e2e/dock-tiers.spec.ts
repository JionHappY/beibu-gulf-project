import { expect, test } from '@playwright/test'

/**
 * E2E：三档承载面的边界值（639 / 640 / 959 / 960）必须与断点判定一致。
 *
 * `useGCS().layoutTierFor` 是唯一的断点判定点，但档位切换改的是 DOM 结构
 * （3 格 ＋ / 6 项 / 6 项），单测只断言 tier 字符串，测不出「DOM 没跟着换」。
 * 这里按实际渲染的文本钉边界：差 1px 就换档，换档就得换结构。
 */

const DOCK_TEXT = '.GCS-panel'

async function dockText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate((sel) => {
    const panels = [...document.querySelectorAll(sel)]
    const bottom = panels
      .filter((p) => p.getBoundingClientRect().top > window.innerHeight * 0.75)
      .map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim())
    return bottom.join(' | ')
  }, DOCK_TEXT)
}

test('639 是紧凑档：三格 ＋，无菜单', async ({ page }) => {
  await page.setViewportSize({ width: 639, height: 900 })
  await page.goto('/forecast')
  await page.waitForTimeout(800)
  await expect(page.locator('.dock-plus-wrap')).toHaveCount(1)
  const text = await dockText(page)
  expect(text).toContain('首页')
  expect(text).toContain('个人中心')
  expect(text).not.toContain('菜单')
  expect(text).not.toContain('选址分析')
})

// 平板档（640–959）已与控制台并存：抽屉退役后不再有菜单键，导航只剩 6 个入口
test('640 起是平板档：六项、无菜单、无 ＋', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 })
  await page.goto('/forecast')
  await page.waitForTimeout(800)
  await expect(page.locator('.dock-plus-wrap')).toHaveCount(0)
  await expect(page.locator('.mobile-console')).toHaveCount(1)
  const text = await dockText(page)
  for (const label of ['首页', '选址分析', '预测分析', '个人中心']) expect(text).toContain(label)
  expect(text).not.toContain('菜单')
})

test('959 仍是控制台档，960 起换成桌面面板', async ({ page }) => {
  await page.setViewportSize({ width: 959, height: 900 })
  await page.goto('/forecast')
  await page.waitForTimeout(800)
  await expect(page.locator('.mobile-console')).toHaveCount(1)
  expect(await dockText(page)).not.toContain('菜单')

  await page.setViewportSize({ width: 960, height: 900 })
  await page.goto('/forecast')
  await page.waitForTimeout(800)
  await expect(page.locator('.mobile-console')).toHaveCount(0)
  const text = await dockText(page)
  expect(text).not.toContain('菜单')
  expect(text).toContain('航线分析')
})
