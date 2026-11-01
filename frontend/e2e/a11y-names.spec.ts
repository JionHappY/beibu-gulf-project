import { expect, test } from '@playwright/test'

/**
 * E2E：表单输入框必须有可访问名（accessible name），不能只靠 placeholder。
 *
 * 屏幕阅读器读 placeholder 不算名字；键盘用户靠 label 关联才知道在填什么。
 * 这里用 Playwright 的可访问名定位（getByRole/getByLabel 就是算 accessible name），
 * 因此把 aria-label 删掉、或只留 placeholder，都会红。
 */

test('航线搜索框有可访问名', async ({ page }) => {
  await page.goto('/route-analysis')
  await expect(page.getByRole('textbox', { name: '搜索地点' })).toBeVisible()
})

test('登录/注册表单三个输入框都有可访问名', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByRole('textbox', { name: '用户名' })).toBeVisible()
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible()

  // 注册态多一个确认密码框
  await page.getByRole('button', { name: '注册' }).click()
  await expect(page.getByLabel('确认密码', { exact: true })).toBeVisible()
})
