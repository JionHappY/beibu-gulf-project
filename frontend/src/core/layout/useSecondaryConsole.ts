/**
 * useSecondaryConsole - 全局二级控制台状态（模块级单例）
 *
 * 二级控制台是**一处**机制：AppLayout 桌面档 / 手机档各挂一次同一槽位，
 * 槽位里的 LayerControlPanel 全站唯一。页面只声明入口与图层顺序，
 * 不再各自 new 一份 4×4 面板（原 4 份副本，违反 AGENTS §七-7）。
 *
 * 内容面板由入口调用 openConsole/setActivePanel 换下去，不新增第二套槽位。
 * 当前两种：'layers'（图层控制）与 'ocean-dem'（浸没页六档海洋 DEM 参考表）。
 */

import { type Ref, ref } from 'vue'

/** 槽位当前承载的二级面板；后续内容在此联合类型上扩，不另开口子 */
type SecondaryConsolePanel = 'layers' | 'ocean-dem'

interface UseSecondaryConsoleReturn {
  /** 槽位是否展开（false = 整体移出，入口再次 openConsole 才回来） */
  open: Ref<boolean>
  /** 当前面板；null = 槽位在但未承载内容（换下去的中间态） */
  activePanel: Ref<SecondaryConsolePanel | null>
  openConsole: (panel?: SecondaryConsolePanel) => void
  closeConsole: () => void
  toggleConsole: () => void
  setActivePanel: (panel: SecondaryConsolePanel | null) => void
  /** 测试与「进页面恢复默认」入口：默认展开图层控制 */
  reset: () => void
}

const open = ref(true)
const activePanel = ref<SecondaryConsolePanel | null>('layers')

function reset(): void {
  open.value = true
  activePanel.value = 'layers'
}

export function useSecondaryConsole(): UseSecondaryConsoleReturn {
  function openConsole(panel: SecondaryConsolePanel = 'layers'): void {
    activePanel.value = panel
    open.value = true
  }

  function closeConsole(): void {
    open.value = false
  }

  function toggleConsole(): void {
    if (open.value) closeConsole()
    else openConsole()
  }

  function setActivePanel(panel: SecondaryConsolePanel | null): void {
    activePanel.value = panel
    // 换到具体内容时槽位必须可见；置 null 只表示「内容被换下去」，槽位状态不动
    if (panel) open.value = true
  }

  return {
    open,
    activePanel,
    openConsole,
    closeConsole,
    toggleConsole,
    setActivePanel,
    reset,
  }
}
