// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

let scrollIntoView: ReturnType<typeof vi.fn>

beforeEach(() => {
  useSecondaryConsole().reset()
  scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

function mockPanelRect(top: number, bottom: number): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: top,
    width: 300,
    height: bottom - top,
    top,
    right: 300,
    bottom,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

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

  it('openConsole(ocean-dem) 把图层控制换成 DEM 参考表，返回按钮可切回', async () => {
    const wrapper = mount(SecondaryConsoleSlot, { props: layerProps })
    const c = useSecondaryConsole()

    c.openConsole('ocean-dem')
    await nextTick()
    expect(wrapper.find('[data-testid="ocean-dem-panel"]').exists()).toBe(true)
    expect(wrapper.find('.layer-panel-stub').exists()).toBe(false)
    expect(wrapper.text()).toContain('海洋 DEM 参考')
    expect(wrapper.text()).toContain('0.95')

    await wrapper.find('button.back-btn').trigger('click')
    expect(c.activePanel.value).toBe('layers')
    expect(wrapper.find('.layer-panel-stub').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ocean-dem-panel"]').exists()).toBe(false)
  })

  it('切换 DEM 后面板落在视口外时滚到可见位置', async () => {
    mockPanelRect(900, 1100)
    mount(SecondaryConsoleSlot, { props: layerProps })

    useSecondaryConsole().openConsole('ocean-dem')
    await nextTick()
    await nextTick()

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })

  it('面板已可见时不做多余滚动', async () => {
    mockPanelRect(100, 400)
    mount(SecondaryConsoleSlot, { props: layerProps })

    useSecondaryConsole().openConsole('ocean-dem')
    await nextTick()
    await nextTick()

    expect(scrollIntoView).not.toHaveBeenCalled()
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
