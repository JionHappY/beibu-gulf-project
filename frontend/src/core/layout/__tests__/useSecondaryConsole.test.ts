import { beforeEach, describe, expect, it } from 'vitest'

import { useSecondaryConsole } from '../useSecondaryConsole'

// 二级控制台是模块级单例：默认展开图层控制；close 是整体移出，setActivePanel(null)
// 是换内容（P2 入口用），两者都不留占位壳。所有用例先 reset，避免跨用例串状态。
describe('useSecondaryConsole 槽位状态', () => {
  beforeEach(() => {
    useSecondaryConsole().reset()
  })

  it('默认展开且当前内容是图层控制', () => {
    const { open, activePanel } = useSecondaryConsole()
    expect(open.value).toBe(true)
    expect(activePanel.value).toBe('layers')
  })

  it('closeConsole 后整体移出；openConsole 恢复图层控制', () => {
    const c = useSecondaryConsole()
    c.closeConsole()
    expect(c.open.value).toBe(false)

    c.openConsole()
    expect(c.open.value).toBe(true)
    expect(c.activePanel.value).toBe('layers')
  })

  it('openConsole 可切到海洋 DEM 参考面板并保持展开', () => {
    const c = useSecondaryConsole()
    c.closeConsole()

    c.openConsole('ocean-dem')
    expect(c.open.value).toBe(true)
    expect(c.activePanel.value).toBe('ocean-dem')
  })

  it('toggleConsole 在开/关之间切换', () => {
    const c = useSecondaryConsole()
    c.toggleConsole()
    expect(c.open.value).toBe(false)
    c.toggleConsole()
    expect(c.open.value).toBe(true)
    expect(c.activePanel.value).toBe('layers')
  })

  it('setActivePanel(null) 把内容换下去但槽位仍展开；换回 layers 时强制展开', () => {
    const c = useSecondaryConsole()
    c.setActivePanel(null)
    expect(c.open.value).toBe(true)
    expect(c.activePanel.value).toBeNull()

    c.closeConsole()
    c.setActivePanel('layers')
    expect(c.open.value).toBe(true)
    expect(c.activePanel.value).toBe('layers')
  })

  it('reset 回到默认态', () => {
    const c = useSecondaryConsole()
    c.closeConsole()
    c.setActivePanel(null)
    c.reset()
    expect(c.open.value).toBe(true)
    expect(c.activePanel.value).toBe('layers')
  })
})
