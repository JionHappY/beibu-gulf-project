import { expect, test } from '@playwright/test'

/**
 * E2E：手机档（390×844）控制台里的面板必须按内容撑开。
 *
 * 控制台把 GCSPanel 从「固定高度 + 绝对定位」改成「auto 高度 + 正常流」，两块面板原本
 * 是按前者写的，改骨架后会塌陷并把内容溢到相邻面板上：
 *   - 浸没报告：灰色内容区 `position:absolute` + 内联宽高 ⇒ 完全不为面板贡献高度；
 *   - 个人中心：内容区 `height:100%` + 子块 `flex:1 1 0` ⇒ basis 0 算成 0 高，再被
 *     `overflow:hidden` 裁掉，只剩顶上一条。
 * 判据用几何（jsdom 没有布局引擎，只能在这里钉）：面板自身无纵向溢出，且内容区底边
 * 不越过面板底边；个人中心则要求登录表单实高超过半屏。
 */

test.use({ viewport: { width: 390, height: 844 } })

test('浸没分析：报告面板按内容撑开，报告内容不越出面板', async ({ page }) => {
  await page.goto('/flood-analysis', { waitUntil: 'networkidle' })

  const panel = page
    .locator('.console-body .GCS-panel')
    .filter({ has: page.locator('.flood-analysis-report-panel') })
  await expect(panel).toHaveCount(1)

  const m = await panel.evaluate((el) => {
    const content = el.querySelector('.report-content')!
    const p = el.getBoundingClientRect()
    const c = content.getBoundingClientRect()
    return {
      overflow: el.scrollHeight - el.clientHeight,
      height: Math.round(p.height),
      contentBottom: Math.round(c.bottom),
      panelBottom: Math.round(p.bottom),
      position: getComputedStyle(content).position,
    }
  })

  expect(m.overflow).toBeLessThanOrEqual(4)
  expect(m.height).toBeGreaterThan(70)
  expect(m.position).toBe('static')
  expect(m.contentBottom).toBeLessThanOrEqual(m.panelBottom + 1)
})

test('个人中心：登录表单在控制台里按内容展开，不被裁成一条', async ({ page }) => {
  await page.goto('/profile', { waitUntil: 'networkidle' })

  const login = page.locator('.console-body .login-panel')
  await expect(login).toHaveCount(1)

  const h = await login.evaluate((el) => Math.round(el.getBoundingClientRect().height))
  expect(h).toBeGreaterThan(200)

  // 三个控件真的画出来了（塌陷时只有顶部一小条在视口里）
  await expect(page.locator('.console-body .login-panel input').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '注册' })).toBeVisible()
})

test('图层面板在控制台里收成三列紧凑排，桌面档仍是两列竖排', async ({ page }) => {
  await page.goto('/site-suitability', { waitUntil: 'networkidle' })

  const grid = page.locator('.console-body .layer-grid')
  await expect(grid).toHaveCount(1)

  const compact = await grid.evaluate((el) => {
    const btn = el.querySelector('.layer-btn')!
    return {
      cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      height: Math.round(el.getBoundingClientRect().height),
      rowDir: getComputedStyle(btn).flexDirection,
      clipped: [...el.querySelectorAll('.layer-btn')].some(
        (b) => b.scrollWidth > b.clientWidth + 1
      ),
    }
  })
  // 组件原本 2 列 × 0.8cell（390 宽下 262px、按钮竖排图标+文字），控制台里压成
  // 3 列 × 44px 两行：高度砍一半以上，且文字不能被省略号吃掉
  expect(compact.cols).toBe(3)
  expect(compact.height).toBeLessThan(150)
  expect(compact.rowDir).toBe('row')
  expect(compact.clipped).toBe(false)

  // 桌面档不受影响：同一组件在固定高度面板里仍是 2 列、竖排
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(400)
  const desktop = await page.evaluate(() => {
    const el = document.querySelector('.layer-grid')!
    return {
      cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      rowDir: getComputedStyle(el.querySelector('.layer-btn')!).flexDirection,
      inConsole: !!el.closest('.console-body'),
    }
  })
  expect(desktop.inConsole).toBe(false)
  expect(desktop.cols).toBe(2)
  expect(desktop.rowDir).toBe('column')
})
