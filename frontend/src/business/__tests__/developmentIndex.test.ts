// @vitest-environment node
/**
 * 发展指数静态快照的自洽判据：
 * - 数据结构必须过 schema；
 * - 城市综合得分必须等于「六维得分 × 权重」的加权和（允许 0.1 舍入）；
 * - 三角形色：三市至少一项维度拉满、至少一项为 0（说明 min-max 真的生效）。
 */
import { describe, expect, it } from 'vitest'

import data from '../../../public/data/development-index.json'
import { developmentIndexSchema } from '../useDevelopmentIndex'

const parsed = developmentIndexSchema.parse(data)

describe('development-index.json', () => {
  it('六项权重和为 1', () => {
    const sum = Object.values(parsed.weights).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it('每市综合得分 = 六维加权和', () => {
    for (const city of parsed.cities) {
      const byKey = Object.fromEntries(city.dimensions.map((d) => [d.key, d.score]))
      const weighted = Object.entries(parsed.weights).reduce(
        (acc, [key, weight]) => acc + (byKey[key] ?? Number.NaN) * weight,
        0
      )
      expect(weighted).toBeCloseTo(city.score, 1)
    }
  })

  it('min-max 生效：存在 100 与 0 的维度极值', () => {
    const all = parsed.cities.flatMap((c) => c.dimensions.map((d) => d.score))
    expect(all).toContain(100)
    expect(all).toContain(0)
  })
})
