<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue'

import { captureError } from '../utils/errorReporting'
import { logger } from '../utils/logger'

const props = defineProps<{ resetKey?: string | number }>()
const hasError = ref(false)

onErrorCaptured((err) => {
  logger.error('[ErrorBoundary]', err)
  logger.error('错误堆栈:', err.stack)
  // return false 会掐断全局 errorHandler，必须在本边界完成同一上报。
  captureError(err, { source: 'ErrorBoundary' })

  // 降级 UI 只展示友好文案，技术细节仅 DEV 记录（生产不暴露内部 message）
  hasError.value = true
  return false // 阻止冒泡到全局
})
function reset() {
  hasError.value = false
}

// 路由切换后必须离开降级态，否则新页面仍被旧错误遮挡。
watch(
  () => props.resetKey,
  () => reset()
)
</script>

<template>
  <div v-if="hasError" class="eb-wrap">
    <!-- 友好文案，不暴露技术细节（生产同样安全） -->
    <p>页面出现异常，请点击重试；若持续发生请联系管理员</p>
    <button @click="reset">重试</button>
  </div>
  <slot v-else />
</template>

<style scoped>
.eb-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 12px;
}
</style>
