/**
 * 海洋 DEM 六档反演参考表（展示副本）。
 *
 * 权威源：backend/data/flood/floodStatistics.json（tracked）。前端必须自带一份才能离线讲，
 * 且 D1' 已裁定本批零后端改动；两份漂移由 __tests__/oceanDemLevels.test.ts 读权威 JSON
 * 逐行断言（后端改档而此处不改即红）。
 *
 * 基准：理论深度基准面 = EGM96 + 2.5m（与 backend 的 datumOffset 同值）。
 * 这里只保留后端仍作为水深参考消费的字段；面积由 PostGIS 按当前水位陆域裁剪现算，
 * 不取本表（旧全域面积会与报告里的 171.139 km² 冲突，见 flood.service.ts:278-289）。
 */
export interface OceanDemLevel {
  /** 理论深度基准面水位（m） */
  waterLevel: number
  /** 对应 EGM96 正高（m） */
  egm96: number
  /** 平均水深（m） */
  averageDepth: number
  /** 最大水深（m） */
  maxDepth: number
}

/** 理论深度基准面 → EGM96 的固定偏移（m） */
export const OCEAN_DEM_DATUM_OFFSET_M = 2.5

const LEVEL_ROWS = [
  { waterLevel: 0, averageDepth: 0, maxDepth: 0 },
  { waterLevel: 2, averageDepth: 0, maxDepth: 0 },
  { waterLevel: 5, averageDepth: 0.95, maxDepth: 1.5 },
  { waterLevel: 8, averageDepth: 1.82, maxDepth: 4.5 },
  { waterLevel: 10, averageDepth: 2.9, maxDepth: 6.5 },
  { waterLevel: 15, averageDepth: 6.14, maxDepth: 11.5 },
] as const

export const OCEAN_DEM_LEVELS: readonly OceanDemLevel[] = LEVEL_ROWS.map((row) => ({
  ...row,
  egm96: row.waterLevel - OCEAN_DEM_DATUM_OFFSET_M,
}))
