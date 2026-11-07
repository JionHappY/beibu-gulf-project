<script setup lang="ts">
/**
 * SecondaryConsoleSlot - 全局二级控制台槽位（全站唯一）
 *
 * 桌面档与手机档都由 AppLayout 挂载同一实例契约；默认展开 4×4 图层控制，
 * 与改造前每页各写一份的视觉位置一致（top-right, offset-y 5.5）。
 * 槽位状态在 useSecondaryConsole（模块级单例）：close 即整体移出，
 * setActivePanel(null) 即把图层控制换下去——P2/P3 的入口直接调它，不再复制面板。
 */
import { computed } from 'vue'

import LayerControlPanel from '@/core/map/components/LayerControlPanel.vue'
import type { LayerGroupSpec } from '@/types'

import { useSecondaryConsole } from '../useSecondaryConsole'

import GCSPanel from './GCSPanel.vue'

interface Props {
  /** 本页图层顺序，原样透传给唯一 LayerControlPanel（不在这里补默认值） */
  layerOrder?: string[]
  layerGroups?: LayerGroupSpec[]
  excludeKeys?: string[]
}

defineProps<Props>()

const { open, activePanel } = useSecondaryConsole()

// 只有「展开 + 当前内容就是图层控制」才渲染 4×4 面板：
// open=false 是整体移出，activePanel=null 是被别的二级内容换下去，两者都不留占位壳。
const showLayers = computed(() => open.value && activePanel.value === 'layers')
</script>

<template>
  <GCSPanel
    v-if="showLayers"
    :w="4"
    :h="4"
    anchor="top-right"
    :offset-x="0"
    :offset-y="5.5"
    class="secondary-console"
  >
    <LayerControlPanel
      :layer-order="layerOrder"
      :layer-groups="layerGroups"
      :exclude-keys="excludeKeys"
    />
  </GCSPanel>
</template>
