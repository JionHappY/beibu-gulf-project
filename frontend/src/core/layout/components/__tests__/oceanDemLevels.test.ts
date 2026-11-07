import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { OCEAN_DEM_DATUM_OFFSET_M, OCEAN_DEM_LEVELS } from '../oceanDemLevels'

/**
 * 漂移守卫：前端六档表是展示副本，权威源是 backend/data/flood/floodStatistics.json。
 * 后端重算改档而前端不跟 ⇒ 本用例红（这正是 2026-10-04 全量重派生后的实际风险）。
 * 只比展示用到的水位/均深/最大三个字段；面积由 PostGIS 现算、risk/loss 不进表，均不在本契约内。
 */
const DATA_DIR = join(__dirname, '../../../../../../backend/data')

interface StatRow {
  waterLevel: number
  averageDepth: number
  maxDepth: number
}

function readStatistics(): StatRow[] {
  const data = JSON.parse(readFileSync(join(DATA_DIR, 'flood/floodStatistics.json'), 'utf8')) as {
    statistics: StatRow[]
  }
  return data.statistics
}

describe('海洋 DEM 六档表与后端权威源一致', () => {
  it('六档逐行同值，EGM96 由水位减固定偏移派生', () => {
    const statistics = readStatistics()
    expect(OCEAN_DEM_LEVELS.map((row) => row.waterLevel)).toEqual(
      statistics.map((row) => row.waterLevel)
    )

    for (const row of OCEAN_DEM_LEVELS) {
      const source = statistics.find((item) => item.waterLevel === row.waterLevel)
      expect(source, `权威源缺少 ${row.waterLevel}m 档`).toBeTruthy()
      expect(
        {
          averageDepth: row.averageDepth,
          maxDepth: row.maxDepth,
        },
        `${row.waterLevel}m 档与 floodStatistics.json 漂移`
      ).toEqual({
        averageDepth: source!.averageDepth,
        maxDepth: source!.maxDepth,
      })
      expect(row.egm96).toBe(row.waterLevel - OCEAN_DEM_DATUM_OFFSET_M)
    }
  })
})
