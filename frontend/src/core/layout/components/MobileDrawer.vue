<script setup lang="ts">
/**
 * MobileDrawer - 业务面板侧滑抽屉（仅抽屉模式即窄屏渲染）
 * 复用 AppLayout 注入的 left/right slot（Vue 插槽）内容，内部 GCSPanel 的绝对定位
 * 由 style.css 全局规则强制改为正常流布局。role="dialog" + aria-modal，Esc/遮罩关闭。
 */
import { nextTick, ref, watch } from 'vue'

import { useEscapeClose } from '@/shared'

interface Props {
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

useEscapeClose(
  () => emit('close'),
  () => props.open
)

/* ===== 键盘焦点 =====
 * 这层自称 role="dialog" + aria-modal="true"：对读屏意味着「外面是惰性的」，
 * 可键盘此前 Tab 到第 29 个就漏到 body、再进到遮罩背后的控件——声明与实际不符。
 * 展开时把焦点交给第一个可聚焦元素（关闭键），Tab/Shift+Tab 在抽屉内循环，关闭回焦。 */
const rootRef = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  const root = rootRef.value
  if (!root) return []
  // offsetParent 为 null 的是 display:none / 被折叠的面板内部控件，不能算进循环
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return
  const list = focusables()
  if (!list.length) return
  const first = list[0]!
  const last = list[list.length - 1]!
  const active = document.activeElement as HTMLElement | null
  const inside = !!active && !!rootRef.value?.contains(active)
  if (e.shiftKey && (!inside || active === first)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (!inside || active === last)) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      lastFocused?.focus()
      lastFocused = null
      return
    }
    lastFocused = document.activeElement as HTMLElement | null
    await nextTick()
    focusables()[0]?.focus()
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="open"
        ref="rootRef"
        class="GCS-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="业务面板"
        @keydown="onKeydown"
      >
        <div class="GCS-drawer__backdrop" @click="emit('close')"></div>
        <aside class="GCS-drawer__sheet">
          <header class="GCS-drawer__header">
            <span>业务面板</span>
            <button
              type="button"
              class="GCS-drawer__close"
              aria-label="关闭面板"
              @click="emit('close')"
            >
              ✕
            </button>
          </header>
          <div class="GCS-drawer__body">
            <slot />
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
