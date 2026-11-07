// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

// 只测槽位契约：面板本体不是本件对象，打桩后仍能断言 layerOrder/layerGroups/excludeKeys
// 原样透传；真实 LayerControlPanel 的图层行为另有其单测。
vi.mock('@/core/map/components/LayerControlPanel.vue', () => ({
  default: {
    name: 'LayerControlPanel',
    props: ['layerOrder', 'layerGroups', 'excludeKeys'],
    template: '<div class="layer-panel-stub" />',
  },
}))

import { useSecondaryConsole } from '../../useSecondaryConsole'
import GCSPanel from '../GCSPanel.vue'
import SecondaryConsoleSlot from '../SecondaryConsoleSlot.vue'

const layerProps = {
  layerOrder: ['a', 'b'],
  layerGroups: [{ key: 'g', label: '组', memberKeys: ['a'] }],
  excludeKeys: ['x'],
}

beforeEach(() => {
  useSecondaryConsole().reset()
})

describe('SecondaryConsoleSlot 全局槽位', () => {
  it('默认展开 4×4 图层控制并透传页面参数', () => {
    const wrapper = mount(SecondaryConsoleSlot, { props: layerProps })

    const panel = wrapper.findComponent(GCSPanel)
    expect(panel.exists()).toBe(true)
    expect(panel.props()).toMatchObject({
      w: 4,
      h: 4,
      anchor: 'top-right',
      offsetX: 0,
      offsetY: 5.5,
    })

    const layer = wrapper.findComponent({ name: 'LayerControlPanel' })
    expect(layer.exists()).toBe(true)
    expect(layer.props()).toMatchObject(layerProps)
  })

  it('closeConsole 后整体移出：既不渲染面板也不留占位壳', async () => {
    const wrapper = mount(SecondaryConsoleSlot, { props: layerProps })
    useSecondaryConsole().closeConsole()
    await nextTick()

    expect(wrapper.find('.GCS-panel').exists()).toBe(false)
    expect(wrapper.find('.layer-panel-stub').exists()).toBe(false)
  })

  it('openConsole 后图层控制回来', async () => {
    const wrapper = mount(SecondaryConsoleSlot, { props: layerProps })
    const c = useSecondaryConsole()
    c.closeConsole()
    await nextTick()
    c.openConsole()
    await nextTick()

    expect(wrapper.find('.GCS-panel').exists()).toBe(true)
    expect(wrapper.find('.layer-panel-stub').exists()).toBe(true)
  })

  it('setActivePanel(null) 把内容换下去，换回 layers 再回来', async () => {
    const wrapper = mount(SecondaryConsoleSlot, { props: layerProps })
    const c = useSecondaryConsole()

    c.setActivePanel(null)
    await nextTick()
    expect(wrapper.find('.GCS-panel').exists()).toBe(false)

    c.setActivePanel('layers')
    await nextTick()
    expect(wrapper.find('.GCS-panel').exists()).toBe(true)
    expect(wrapper.find('.layer-panel-stub').exists()).toBe(true)
  })
})
