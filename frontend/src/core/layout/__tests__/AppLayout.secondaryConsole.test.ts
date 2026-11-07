// @vitest-environment jsdom
/**
 * P1-1 守卫：图层控制全站唯一，桌面档与手机档各只有一个挂点。
 *
 * 判据是真实 AppLayout 在两种断点下的挂载产物（不是源码文本）：
 * 1440 只走桌面 #right，390 只走控制台末尾，两边都必须恰好 1 个 LayerControlPanel；
 * 个人中心关掉槽位时必须 0 个。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/flood-analysis', name: 'Flood', meta: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/core/map/components/LayerControlPanel.vue', () => ({
  default: {
    name: 'LayerControlPanel',
    props: ['layerOrder', 'layerGroups', 'excludeKeys'],
    template: '<div class="layer-panel-stub" />',
  },
}))

import AppLayout from '../AppLayout.vue'
import SecondaryConsoleSlot from '../components/SecondaryConsoleSlot.vue'
import { useSecondaryConsole } from '../useSecondaryConsole'

const originalWidth = window.innerWidth

async function setViewportWidth(width: number): Promise<void> {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
  window.dispatchEvent(new Event('resize'))
  // useGCS 的 resize 防抖 150ms：必须等模块单例真正换档，否则挂载仍按旧档渲染
  await new Promise((resolve) => setTimeout(resolve, 200))
}

beforeEach(() => {
  setActivePinia(createPinia())
  useSecondaryConsole().reset()
})

afterAll(() => {
  Object.defineProperty(window, 'innerWidth', {
    value: originalWidth,
    writable: true,
    configurable: true,
  })
  window.dispatchEvent(new Event('resize'))
})

describe('AppLayout 二级控制台挂点唯一性', () => {
  it('1440 桌面档：#right 后只有一个图层控制', async () => {
    await setViewportWidth(1440)
    const wrapper = mount(AppLayout)
    expect(wrapper.findAll('.layer-panel-stub')).toHaveLength(1)
    expect(wrapper.findAllComponents(SecondaryConsoleSlot)).toHaveLength(1)
  })

  it('390 手机档：控制台末尾只有一个图层控制', async () => {
    await setViewportWidth(390)
    const wrapper = mount(AppLayout)
    expect(wrapper.find('.console-body').exists()).toBe(true)
    expect(wrapper.findAll('.layer-panel-stub')).toHaveLength(1)
    expect(wrapper.findAllComponents(SecondaryConsoleSlot)).toHaveLength(1)
  })

  it('上一页收起后进新页面默认展开（避免无入口页锁死）', async () => {
    await setViewportWidth(1440)
    useSecondaryConsole().closeConsole()

    const wrapper = mount(AppLayout)

    expect(useSecondaryConsole().open.value).toBe(true)
    expect(wrapper.findAll('.layer-panel-stub')).toHaveLength(1)
  })

  it('showSecondaryConsole=false（个人中心）：不挂图层控制', async () => {
    await setViewportWidth(1440)
    const wrapper = mount(AppLayout, { props: { showSecondaryConsole: false } })
    expect(wrapper.findAll('.layer-panel-stub')).toHaveLength(0)
    expect(wrapper.findAllComponents(SecondaryConsoleSlot)).toHaveLength(0)
  })
})
