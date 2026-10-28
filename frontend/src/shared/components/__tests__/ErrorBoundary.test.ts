import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const captureError = vi.fn()
vi.mock('../../utils/errorReporting', () => ({
  captureError: (...args: unknown[]) => captureError(...args),
}))

import ErrorBoundary from '../ErrorBoundary.vue'

let shouldThrow = true
const BrokenOnce = defineComponent({
  setup() {
    if (shouldThrow) {
      shouldThrow = false
      throw new Error('boom')
    }
  },
  template: '<div class="healthy">ok</div>',
})

const Healthy = defineComponent({ template: '<div class="healthy">ok</div>' })

describe('ErrorBoundary 上报与复位', () => {
  it('🔴 边界内错误仍上报一次，并按 resetKey 离开降级态', async () => {
    const wrapper = mount(ErrorBoundary, {
      props: { resetKey: '/a' },
      slots: { default: BrokenOnce },
      global: { config: { errorHandler: () => {} } },
    })

    await wrapper.vm.$nextTick()
    expect(captureError).toHaveBeenCalledTimes(1)
    expect(captureError.mock.calls[0][1]).toEqual({ source: 'ErrorBoundary' })
    expect(wrapper.text()).toContain('页面出现异常')

    await wrapper.setProps({ resetKey: '/b' })
    expect(wrapper.text()).not.toContain('页面出现异常')
    expect(wrapper.text()).toContain('ok')
  })

  it('正常子树不触发上报', () => {
    captureError.mockClear()
    const wrapper = mount(ErrorBoundary, {
      props: { resetKey: '/a' },
      slots: { default: Healthy },
    })
    expect(wrapper.text()).toContain('ok')
    expect(captureError).not.toHaveBeenCalled()
  })
})
