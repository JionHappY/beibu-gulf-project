/**
 * 城市发展指数：读静态快照 /data/development-index.json。
 *
 * 口径边界（必须与数据文件一致，改一处即两处漂移）：
 * - 六项指标各自在三市之间 min-max 归一化，再加权求和；
 * - 人口维度是「住宅小区密度」代理，数据库没有人口普查/户数/年龄字段，
 *   前端文案不得写成「人口结构」；
 * - 淹没暴露为逆向指标，占比越低得分越高。
 */
import { computed, type ComputedRef, ref, type Ref } from 'vue'
import { z } from 'zod'

import { loadStatic, logger } from '@/shared'

const dimensionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  score: z.number().min(0).max(100),
  display: z.string().min(1),
})

const citySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  score: z.number().min(0).max(100),
  areaKm2: z.number().positive(),
  dimensions: z.array(dimensionSchema).min(1),
})

export const developmentIndexSchema = z.object({
  generatedAt: z.string().min(1),
  method: z.string().min(1),
  weights: z.record(z.string(), z.number()),
  sources: z.record(z.string(), z.string()),
  cities: z.array(citySchema).min(1),
})

export type DevelopmentIndex = z.infer<typeof developmentIndexSchema>
export type DevelopmentCity = z.infer<typeof citySchema>

const DATA_URL = '/data/development-index.json'

interface UseDevelopmentIndexReturn {
  data: Ref<DevelopmentIndex | null>
  failed: Ref<boolean>
  selectedId: Ref<string>
  selected: ComputedRef<DevelopmentCity | null>
  load: () => Promise<void>
  cancel: () => void
}

export function useDevelopmentIndex(): UseDevelopmentIndexReturn {
  const data = ref<DevelopmentIndex | null>(null)
  const failed = ref(false)
  const selectedId = ref('qz')
  let controller: AbortController | null = null

  const selected = computed<DevelopmentCity | null>(() => {
    const list = data.value?.cities
    if (!list || list.length === 0) return null
    return list.find((c) => c.id === selectedId.value) ?? list[0]
  })

  function cancel(): void {
    controller?.abort()
    controller = null
  }

  async function load(): Promise<void> {
    cancel()
    const current = new AbortController()
    controller = current
    failed.value = false
    try {
      const parsed = await loadStatic(DATA_URL, {
        signal: current.signal,
        schema: developmentIndexSchema,
      })
      if (current.signal.aborted) return
      data.value = parsed
      if (!parsed.cities.some((c) => c.id === selectedId.value)) {
        selectedId.value = parsed.cities[0].id
      }
    } catch (error) {
      if (current.signal.aborted) return
      failed.value = true
      logger.warn('[useDevelopmentIndex] 发展指数静态数据加载失败:', error)
    } finally {
      if (controller === current) controller = null
    }
  }

  return { data, failed, selectedId, selected, load, cancel }
}
