<script setup lang="ts">
/**
 * 首页右侧「城市发展指数」面板。
 * 数据/口径全部在 useDevelopmentIndex 与 /data/development-index.json 中，
 * 本组件只做三市切换与条形展示，不在这里复算分数。
 */
import { onMounted, onUnmounted } from 'vue'

import { useDevelopmentIndex } from '@/business'

const { data, failed, selectedId, selected, load, cancel } = useDevelopmentIndex()

onMounted(load)
onUnmounted(cancel)
</script>

<template>
  <div class="dev-index" data-testid="development-index">
    <div v-if="failed" class="dev-state">发展指数数据加载失败</div>
    <div v-else-if="!data || !selected" class="dev-state">加载中…</div>
    <template v-else>
      <div class="dev-tabs" role="tablist" aria-label="选择城市">
        <button
          v-for="city in data.cities"
          :key="city.id"
          type="button"
          class="dev-tab"
          :class="{ on: city.id === selected.id }"
          role="tab"
          :aria-selected="city.id === selected.id"
          @click="selectedId = city.id"
        >
          {{ city.name }}
        </button>
      </div>

      <div class="dev-score-row">
        <span class="dev-score">{{ selected.score.toFixed(1) }}</span>
        <span class="dev-score-unit">/ 100 综合得分</span>
      </div>

      <div class="dev-bars">
        <div v-for="dim in selected.dimensions" :key="dim.key" class="dev-bar">
          <span class="dev-label">{{ dim.label }}</span>
          <span class="dev-track">
            <i class="dev-fill" :style="{ width: dim.score + '%' }"></i>
          </span>
          <span class="dev-value">{{ dim.display }}</span>
        </div>
      </div>

      <div class="dev-foot">* 居住密度为住宅小区数量代理，非人口普查 · 2025 年口径</div>
    </template>
  </div>
</template>

<style scoped>
.dev-index {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  padding: 4px 12px 10px;
  box-sizing: border-box;
  color: var(--GCS-text-primary);
  overflow: hidden;
}

.dev-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: var(--GCS-text-muted);
  font-size: 12px;
}

.dev-tabs {
  display: flex;
  gap: 4px;
}

.dev-tab {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 4px;
  border: 1px solid var(--GCS-border-default);
  border-radius: var(--GCS-radius-sm);
  background: var(--GCS-bg-panel);
  color: var(--GCS-text-regular);
  font-size: 11px;
  cursor: pointer;
}

.dev-tab.on {
  border-color: var(--GCS-color-primary);
  color: var(--GCS-color-primary);
  background: var(--GCS-bg-hover);
}

.dev-score-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.dev-score {
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  color: var(--GCS-color-primary);
}

.dev-score-unit {
  color: var(--GCS-text-muted);
  font-size: 11px;
}

.dev-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dev-bar {
  display: grid;
  grid-template-columns: 48px 1fr 82px;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.dev-label {
  color: var(--GCS-text-regular);
  white-space: nowrap;
}

.dev-track {
  height: 6px;
  border-radius: 3px;
  background: var(--GCS-bg-container);
  overflow: hidden;
}

.dev-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--GCS-color-primary);
}

.dev-value {
  color: var(--GCS-text-muted);
  text-align: right;
  white-space: nowrap;
}

.dev-foot {
  margin-top: auto;
  color: var(--GCS-text-muted);
  font-size: 10px;
  line-height: 1.4;
}
</style>
