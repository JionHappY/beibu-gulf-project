<script setup lang="ts">
/**
 * SecondaryConsoleSlot - 全局二级控制台槽位（全站唯一）
 *
 * 桌面档与手机档都由 AppLayout 挂载同一实例契约；默认展开 4×4 图层控制，
 * 与改造前每页各写一份的视觉位置一致（top-right, offset-y 5.5）。
 * 槽位状态在 useSecondaryConsole（模块级单例）：close 即整体移出，
 * setActivePanel(null) 即把图层控制换下去——入口直接调它，不再复制面板。
 * 内容目前两种：默认图层控制（'layers'）与浸没页的海洋 DEM 参考表（'ocean-dem'）；
 * 两者共用同一个 4×4 槽位，切换内容不新增第二个挂点。
 */
import { computed, nextTick, ref, watch } from 'vue'

import LayerControlPanel from '@/core/map/components/LayerControlPanel.vue'
import type { LayerGroupSpec } from '@/types'

import { useSecondaryConsole } from '../useSecondaryConsole'

import GCSPanel from './GCSPanel.vue'
import OceanDemPanel from './OceanDemPanel.vue'

interface Props {
  /** 本页图层顺序，原样透传给唯一 LayerControlPanel（不在这里补默认值） */
  layerOrder?: string[]
  layerGroups?: LayerGroupSpec[]
  excludeKeys?: string[]
}

defineProps<Props>()

const { open, activePanel } = useSecondaryConsole()

// 只有「展开 + 有内容」才渲染 4×4 面板：
// open=false 是整体移出，activePanel=null 是被换下去的中间态，两者都不留占位壳。
const showPanel = computed(() => open.value && activePanel.value !== null)
const showLayers = computed(() => activePanel.value === 'layers')

const panelRef = ref<{ $el?: unknown } | null>(null)

// 槽位在 900/390 档位于 console-body 底部：点开报告页的“DEM 参考”后如果面板落在
// 视口外，用户会以为按钮没反应。切换内容/展开后只做最小滚动，已可见时不动。
watch(
  [open, activePanel],
  async () => {
    await nextTick()
    const el = panelRef.value?.$el
    if (!(el instanceof HTMLElement)) return
    const rect = el.getBoundingClientRect()
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  },
  { flush: 'post' }
)
</script>

<template>
  <GCSPanel
    v-if="showPanel"
    ref="panelRef"
    :w="4"
    :h="4"
    anchor="top-right"
    :offset-x="0"
    :offset-y="5.5"
    class="secondary-console"
  >
    <LayerControlPanel
      v-if="showLayers"
      :layer-order="layerOrder"
      :layer-groups="layerGroups"
      :exclude-keys="excludeKeys"
    />
    <OceanDemPanel v-else-if="activePanel === 'ocean-dem'" />
  </GCSPanel>
</template>
