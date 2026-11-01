<!-- 中转带（手机档控制台顶部）：已完成任务结果的芯片，点一下上图 / 再点撤下。
     桌面档不用它——那里是 App.vue 的 .task-result-strip（浮在地图右下），两处消费同一份数据。 -->
<script setup lang="ts">
import type { TaskChipView } from '../taskChipsContext'

import TaskResultChip from './TaskResultChip.vue'

defineProps<{ chips: TaskChipView[] }>()
const emit = defineEmits<{ (e: 'toggle', key: string): void }>()
</script>

<template>
  <div class="console-rail" data-testid="console-rail">
    <TaskResultChip
      v-for="chip in chips"
      :key="chip.key"
      :label="chip.label"
      :color="chip.color"
      :active="chip.active"
      @toggle="emit('toggle', chip.key)"
    />
  </div>
</template>

<style scoped>
/* 单行横滚：芯片数量不设上限，但不许撑高控制台（控制台高度决定地图剩多少屏）。
   本体在控制台滚动区之外（见 AppLayout），自身不再需要 sticky。 */
.console-rail {
  display: flex;
  flex: 0 0 auto;
  gap: var(--GCS-space-1);
  align-items: center;
  overflow-x: auto;
  scrollbar-width: none;
}

.console-rail::-webkit-scrollbar {
  display: none;
}

/* 中转带里只有「点一下上图/再点撤下」一种手势：拖拽提示文案在窄屏会把芯片撑成两行。
   拖拽语义由桌面浮条承担（那里有地图命中区），手机档不搬 */
.console-rail :deep(.task-result-chip .hint) {
  display: none;
}
</style>
