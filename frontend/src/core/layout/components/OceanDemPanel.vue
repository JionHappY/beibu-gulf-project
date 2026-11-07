<script setup lang="ts">
/**
 * 海洋 DEM 参考面板——二级控制台 4×4 槽位的第二个内容（G4 点击通道的落地件）。
 *
 * 为什么放在 core/layout：槽位由 AppLayout 持有，core 不能反向 import business；
 * 数据本身是六档反演参考值，展示副本与权威源的漂移由 oceanDemLevels.test.ts 断言。
 * 为什么入口在报告面板而不是滑块面板：报告里的平均/最大水深正来自这张表，
 * 「这个数从哪来」的入口贴着被解释的数字，才不会变成孤立按钮（D3 的反面）。
 */
import { useSecondaryConsole } from '../useSecondaryConsole'

import { OCEAN_DEM_LEVELS } from './oceanDemLevels'

const { openConsole } = useSecondaryConsole()

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
</script>

<template>
  <div class="ocean-dem-panel" data-testid="ocean-dem-panel">
    <div class="panel-header">
      <span class="panel-title">海洋 DEM 参考</span>
      <button type="button" class="back-btn" @click="openConsole('layers')">返回图层</button>
    </div>

    <div class="panel-subtitle">6 档反演参考值（非实时）</div>

    <div class="dem-table" role="table" aria-label="海洋 DEM 六档参考表">
      <div class="dem-row dem-row--head" role="row">
        <span role="columnheader">水位</span>
        <span role="columnheader">EGM96</span>
        <span role="columnheader">均深</span>
        <span role="columnheader">最大</span>
      </div>
      <div v-for="row in OCEAN_DEM_LEVELS" :key="row.waterLevel" class="dem-row" role="row">
        <span class="cell-strong">{{ row.waterLevel }}m</span>
        <span>{{ signed(row.egm96) }}m</span>
        <span>{{ row.averageDepth }}</span>
        <span>{{ row.maxDepth }}</span>
      </div>
    </div>

    <p class="dem-note">
      基准：理论深度基准面 = EGM96 + 2.5m；超过 15m 按 15m 档兜底。水深单位 m。
    </p>
    <p class="dem-note">
      面积由 PostGIS 按当前水位陆域裁剪计算，不取本表；terrain 瓦片
      <code>/static/terrain</code> 仅抬升起伏，不参与淹没判定。
    </p>
  </div>
</template>

<style scoped>
.ocean-dem-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  box-sizing: border-box;
  color: var(--GCS-text-regular);
  font-size: 10px;
  line-height: 1.3;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.panel-title {
  color: var(--GCS-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.back-btn {
  flex-shrink: 0;
  height: 20px;
  padding: 0 6px;
  border: 1px solid var(--GCS-border-default);
  border-radius: var(--GCS-radius-sm);
  background: var(--GCS-bg-panel);
  color: var(--GCS-text-regular);
  font-size: 10px;
  cursor: pointer;
}

.back-btn:hover {
  border-color: var(--GCS-color-primary);
  color: var(--GCS-color-primary);
}

.panel-subtitle {
  flex-shrink: 0;
  color: var(--GCS-text-muted);
}

.dem-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.dem-row {
  display: grid;
  grid-template-columns: 34px 44px 1fr 1fr;
  gap: 3px;
  align-items: center;
  min-height: 16px;
}

.dem-row--head {
  color: var(--GCS-text-muted);
  border-bottom: 1px solid var(--GCS-border-default);
}

.cell-strong {
  color: var(--GCS-text-primary);
  font-weight: 600;
}

.dem-note {
  margin: 0;
  color: var(--GCS-text-muted);
}

.dem-note code {
  font-family: inherit;
  color: var(--GCS-text-secondary);
}
</style>
