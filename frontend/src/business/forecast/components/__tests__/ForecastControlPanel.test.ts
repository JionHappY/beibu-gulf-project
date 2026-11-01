// @vitest-environment jsdom

/**
 * ForecastControlPanel 时间轴契约测试（2026-11-01 用户定稿：年份轴裸露，不再点开才出现）：
 * ①默认渲染即有 input[type=range]，值=当前步（年月双基换算不变）；
 * ②滑块输入写 store.currentTime（步→时间串仍走 ../timeline）；
 * ③年/月粒度切换后步值与上界同步（既有换算行为不变）；
 * ④可点击刻度跳年（选择步进不变），刻度常驻；
 * ⑤滑块本体按下进入专注模式、松手退出（beginSliderFocus/endSliderFocus 保留）；
 * ⑥▶ 开始键撤除；挂载即自动播放；空格切换播放/暂停（输入框内不劫持）。
 */
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useSliderFocus } from '@/core'
import { useForecastStore } from '@/stores'

import { provideForecastOrchestrator } from '../../composables/useForecastOrchestrator'
import ForecastControlPanel from '../ForecastControlPanel.vue'

/** v4-S3：面板从页面 inject 编排器（缺提供即抛错，设计如此）——测件按真实拓扑注入桩。
 *  编排器 key 已收为模块内部（去 export），故经 provideForecastOrchestrator 真建实例后替换其
 *  doForecastUpdate 为桩：与 ForecastPage.vue 的 provide 路径同形，且注入靠组件树而非 key 字面量。 */
const doForecastUpdate = vi.fn(() => Promise.resolve())
let router: Router
function mountPanel(attach = false) {
  const Parent = defineComponent({
    setup() {
      const orchestrator = provideForecastOrchestrator({ updateForecastLayer: async () => {} })
      orchestrator.doForecastUpdate = doForecastUpdate
      return () => h(ForecastControlPanel)
    },
  })
  return mount(Parent, {
    attachTo: attach ? document.body : undefined,
    global: { plugins: [router] },
  })
}

/** 时间轴：裸露的 range（不点开就能拖，2026-11-01 用户定稿） */
function timeRange(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('input.time-range')
}

describe('ForecastControlPanel 时间轴（裸露滑块）', () => {
  let originalWidth = 0

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({ history: createMemoryHistory(), routes: [] })
    await router.push('/')
    await router.isReady()
    originalWidth = window.innerWidth
    // 专注模式仅在 <960px 抽屉档生效（桌面档 beginSliderFocus 主动 return）
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalWidth,
      writable: true,
      configurable: true,
    })
    vi.useRealTimers()
  })

  it('默认渲染即有 range 滑块，值=当前步、上界=月模式上限、文案=当前时间', () => {
    const wrapper = mountPanel()

    const sliders = wrapper.findAll('input[type="range"]')
    expect(sliders).toHaveLength(1)
    expect((sliders[0].element as HTMLInputElement).value).toBe('65')
    expect(sliders[0].attributes('min')).toBe('0')
    expect(sliders[0].attributes('max')).toBe('131')
    expect(sliders[0].attributes('step')).toBe('1')
    expect(wrapper.find('.time-now').text()).toBe('2026年06月')

    wrapper.unmount()
  })

  it('滑块输入写 store.currentTime，文案同步（月模式步→时间串）', async () => {
    const wrapper = mountPanel()
    const store = useForecastStore()

    await timeRange(wrapper).setValue('12')

    expect(store.currentTime).toBe('2022-01')
    expect(wrapper.find('.time-now').text()).toBe('2022年01月')

    wrapper.unmount()
  })

  it('年粒度切换：步值与上界切到年基（换算行为不变）', async () => {
    const wrapper = mountPanel()
    const store = useForecastStore()

    await wrapper.find('.gr-toggle input').setValue(true)

    expect(store.timeGranularity).toBe('year')
    const slider = timeRange(wrapper)
    expect(slider.attributes('max')).toBe('10')
    expect((slider.element as HTMLInputElement).value).toBe('5')

    await slider.setValue('10')
    expect(store.currentTime).toBe('2031')
    expect(wrapper.find('.time-now').text()).toBe('2031年')

    wrapper.unmount()
  })

  it('年模式点击刻度写入 YYYY（不再混入 -01）', async () => {
    const wrapper = mountPanel()
    const store = useForecastStore()

    await wrapper.find('.gr-toggle input').setValue(true)
    await wrapper.findAll('.t-tick.clickable')[2].trigger('click')

    expect(store.currentTime).toBe('2031')
    expect(wrapper.find('.time-now').text()).toBe('2031年')

    wrapper.unmount()
  })

  it('可点击刻度常驻（滑块未展开这一前置不复存在），跳年步进保留', async () => {
    const wrapper = mountPanel()
    const store = useForecastStore()

    const ticks = wrapper.findAll('.t-tick.clickable')
    expect(ticks.map((t) => t.text())).toEqual(['2021.1', '2026.1', '2031.1'])

    await ticks[2].trigger('click')

    expect(store.currentTime).toBe('2031-01')
    wrapper.unmount()
  })

  it('滑块本体按下进入专注模式、松手退出（专注模式保留）', async () => {
    const wrapper = mountPanel(true)
    const scope = effectScope()
    const sliderFocus = scope.run(() => useSliderFocus())!

    const slider = timeRange(wrapper)
    slider.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(sliderFocus.active.value).toBe(true)

    slider.element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(sliderFocus.active.value).toBe(false)

    wrapper.unmount()
    scope.stop()
  })

  it('▶ 开始键已撤：面板内不存在播放按钮/播放按钮容器', () => {
    const wrapper = mountPanel()

    expect(wrapper.find('.time-acts').exists()).toBe(false)
    expect(wrapper.findAll('button.act-btn')).toHaveLength(0)

    wrapper.unmount()
  })

  it('默认自动播放：挂载即 isPlaying，且按 playSpeed 推进时间', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel()
    const store = useForecastStore()

    expect(store.isPlaying).toBe(true)
    const before = store.currentTime
    await vi.advanceTimersByTimeAsync(store.playSpeed)

    expect(store.currentTime).not.toBe(before)
    wrapper.unmount()
  })

  it('空格切换播放/暂停；在输入框内不劫持', async () => {
    const wrapper = mountPanel(true)
    const store = useForecastStore()

    const playing = store.isPlaying
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    expect(store.isPlaying).toBe(!playing)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    expect(store.isPlaying).toBe(playing)

    // 输入框里按空格是"输入空格"，不是播放控制
    const input = timeRange(wrapper).element as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    expect(store.isPlaying).toBe(playing)

    wrapper.unmount()
  })
})

describe('ForecastControlPanel 请求归属（v4-S3）', () => {
  // ── v4-S3：请求归属上移后，"用户改了什么"由本面板发起（判据在防抖窗口上） ──
  it('参数变化经 300ms 防抖调用一次编排器（连续两次变化只发一次）', async () => {
    vi.useFakeTimers()
    try {
      doForecastUpdate.mockClear()
      // 必须卸载：默认自动播放的 interval 会跨用例继续写时间（泄漏面板会污染后续断言）
      const wrapper = mountPanel()
      const store = useForecastStore()

      store.setCurrentTime('2027-01')
      store.setCurrentTime('2028-01')
      await vi.advanceTimersByTimeAsync(0)
      expect(doForecastUpdate).not.toHaveBeenCalled() // 防抖窗口内不发起

      await vi.advanceTimersByTimeAsync(300)
      expect(doForecastUpdate).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('卸载后防抖窗口内的那一次不再发起（与页面 cancelAll 互补）', async () => {
    vi.useFakeTimers()
    try {
      doForecastUpdate.mockClear()
      const wrapper = mountPanel()
      useForecastStore().setCurrentTime('2027-06')
      // 先让 pre-flush 的 watch 回调落地（防抖计时器真的被登记），再卸载才有「撤销」可验
      await nextTick()

      wrapper.unmount()
      await vi.advanceTimersByTimeAsync(400)
      expect(doForecastUpdate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── F4：运河情景芯片——仅 cargo 有文献锚点，非 cargo 指标禁用非基线档 ──
describe('ForecastControlPanel 运河情景芯片（F4）', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({ history: createMemoryHistory(), routes: [] })
    await router.push('/')
    await router.isReady()
  })

  it('cargo 下四档可选：点「中位」写 store.canalScenario（阳性对照）', async () => {
    const wrapper = mountPanel()
    const store = useForecastStore()

    const chips = wrapper.findAll('button.scenario-chip')
    expect(chips.map((c) => c.text())).toEqual(['基线', '设计', '中位', '诱导'])
    expect(store.canalScenario).toBe('baseline')
    expect(wrapper.find('.scenario-row').classes()).not.toContain('off')

    await chips[2].trigger('click')
    expect(store.canalScenario).toBe('median')

    wrapper.unmount()
  })

  it('非 cargo 指标：非基线三档 disabled 且点击不改 store', async () => {
    const wrapper = mountPanel()
    const store = useForecastStore()
    store.setActiveIndicator('container')
    await nextTick()

    const chips = wrapper.findAll('button.scenario-chip')
    expect(chips.map((c) => (c.element as HTMLButtonElement).disabled)).toEqual([
      false,
      true,
      true,
      true,
    ])
    expect(wrapper.find('.scenario-row').classes()).toContain('off')

    await chips[1].trigger('click')
    await chips[2].trigger('click')
    expect(store.canalScenario).toBe('baseline')

    wrapper.unmount()
  })
})
// W17：热力散射点的空间分布是示意性插值（每港 40 点按距离衰减铺在港口周围），
// 此前只在后端 forecast-engine.ts 的注释里说明，UI 零披露 ⇒ 用户会把热力面读成实测点位。
describe('ForecastControlPanel 空间口径披露（W17）', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({ history: createMemoryHistory(), routes: [] })
    await router.push('/')
    await router.isReady()
  })

  it('面板披露「空间分布是示意性插值、非实测」，且不在按钮网格的滚动区内', () => {
    const wrapper = mountPanel()

    const note = wrapper.find('.forecast-note')
    expect(note.exists()).toBe(true)
    // 只钉承重三段：披露对象（空间分布）、性质（示意）、否定项（非实测）——
    // 不钉整句措辞，措辞是等价可改的（AGENTS §5.3 第三式）。
    const text = note.text()
    expect(text).toContain('空间分布')
    expect(text).toContain('示意')
    expect(text).toContain('非实测')
    // 位置约束：脚注必须常驻可见。落进 .btn-grid 会被 overflow-y:auto 滚走，
    // 那时披露等于没有（.btn-grid 是 flex:1 的可滚区，见 panelOverflowExit 的容量出口判据）。
    expect(wrapper.find('.btn-grid').element.contains(note.element)).toBe(false)

    wrapper.unmount()
  })
})

// D3 去 export：FORECAST_ORCHESTRATOR_KEY 已收为模块内部；本组是「公开面收窄」本身的判据。
describe('公开面收窄 — FORECAST_ORCHESTRATOR_KEY 不得再导出', () => {
  const INTERNAL = ['FORECAST_ORCHESTRATOR_KEY']

  it('内部符号不在模块公开面；公开符号仍在（阳性对照）', async () => {
    const mod = (await import('../../composables/useForecastOrchestrator')) as unknown as Record<
      string,
      unknown
    >
    for (const k of INTERNAL) expect(mod[k], k + ' 应已收为模块内部').toBeUndefined()
    expect(typeof mod.provideForecastOrchestrator).toBe('function')
  })
})
