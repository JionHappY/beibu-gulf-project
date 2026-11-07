<script setup lang="ts">
/**
 * SecondaryConsoleEntry - 二级控制台入口按钮（全站唯一一份）
 *
 * 默认展开时显示「收起图层」，收起后显示「图层控制」；点击只改
 * useSecondaryConsole 的单例状态，面板本体仍由 AppLayout 的槽位持有。
 * 页面只负责把它放进自己的底部入口位，不各自复制按钮与文案。
 */
import { computed } from 'vue'

import { useGCS } from '@/shared'

import { useSecondaryConsole } from '../useSecondaryConsole'

const { open, toggleConsole } = useSecondaryConsole()
const { cellPixel } = useGCS()
const smallFontSizeCss = computed(() => `${cellPixel.value * 0.15}px`)
const iconFontSizeCss = computed(() => `${cellPixel.value * 0.2}px`)
</script>

<template>
  <button
    type="button"
    class="secondary-entry"
    :class="{ sel: open }"
    :aria-pressed="open"
    @click="toggleConsole"
  >
    <span class="entry-icon" aria-hidden="true">🗺</span>
    <span>{{ open ? '收起图层' : '图层控制' }}</span>
  </button>
</template>

<style scoped>
.secondary-entry {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 40px;
  padding: 0 8px;
  border: 1px solid var(--GCS-border-default);
  border-radius: var(--GCS-radius-lg);
  background: var(--GCS-bg-panel);
  color: var(--GCS-text-regular);
  cursor: pointer;
  font-size: v-bind(smallFontSizeCss);
  transition:
    background-color var(--GCS-duration-base),
    border-color var(--GCS-duration-base);
}

.secondary-entry:hover {
  border-color: var(--GCS-color-primary);
  background: var(--GCS-bg-hover);
}

.secondary-entry.sel {
  border-color: var(--GCS-color-primary);
  color: var(--GCS-color-primary);
}

.entry-icon {
  font-size: v-bind(iconFontSizeCss);
  line-height: 1;
}
</style>
