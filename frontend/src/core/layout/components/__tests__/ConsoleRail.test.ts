import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import ConsoleRail from '../ConsoleRail.vue'
import type { TaskChipView } from '../../taskChipsContext'

// jsdom 没有 Pointer Capture：芯片在 pointerdown 里捕获指针，不补桩会直接抛错
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = () => {}
  HTMLElement.prototype.releasePointerCapture = () => {}
})

// ConsoleRail（手机档中转带）：芯片来自 App.vue 的同一份 resultChips，这里只做渲染与转发。
// 验证点：条数、已上图高亮、点击回传 key（父层据此 toggleIR）。

const chips: TaskChipView[] = [
  { key: 't1:route', label: '航线 A', color: '#2172ca', active: false },
  { key: 't2:flood', label: '淹没 B', color: '#18922f', active: true },
]

describe('ConsoleRail（控制台中转带）', () => {
  it('按 chips 渲染等量芯片', () => {
    const wrapper = mount(ConsoleRail, { props: { chips } })
    expect(wrapper.findAll('.task-result-chip')).toHaveLength(2)
  })

  it('active 芯片带 active 类（已上图的可辨识）', () => {
    const wrapper = mount(ConsoleRail, { props: { chips } })
    const buttons = wrapper.findAll('.task-result-chip')
    expect(buttons[0].classes()).not.toContain('active')
    expect(buttons[1].classes()).toContain('active')
  })

  it('点击芯片回传该芯片的 key（不是下标）', async () => {
    const wrapper = mount(ConsoleRail, { props: { chips } })
    const buttons = wrapper.findAll('.task-result-chip')
    // 芯片的 pointerup 才 emit（点按与拖拽松开同义），单测直接触发 pointerdown→pointerup
    await buttons[1].trigger('pointerdown')
    await buttons[1].trigger('pointerup')
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['t2:flood'])
  })

  it('空数组 → 仍渲染容器但无芯片（数量由父层 v-if 决定，这里只钉不崩）', () => {
    const wrapper = mount(ConsoleRail, { props: { chips: [] } })
    expect(wrapper.find('[data-testid="console-rail"]').exists()).toBe(true)
    expect(wrapper.findAll('.task-result-chip')).toHaveLength(0)
  })
})
