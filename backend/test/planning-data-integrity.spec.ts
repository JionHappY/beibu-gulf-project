import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// 规划港区采集件（豆包按公开法定文件汇编，2026-11-03）的完整性判据。
//
// 为什么要在后端测试里钉这份数据：
// 1. 它是**外部采集件**，没有管线能保证下一次更新仍守同一套口径；
// 2. 它把「规划港区」从文字变成了坐标，一旦有人手改坐标或新增无坐标的条目，
//    选址域的距离口径会静默漂移（`dist_port_m` 用的是既有港口，不是这份规划点，
//    所以漂移不会在任何既有用例里冒出来）；
// 3. 采集件自述「未加工的原始件」——**pending 条目必须没有坐标**，
//    否则等于把推算值伪装成实测值写进了数据。

// 与同目录其他用例一致用 __dirname 锚定：vitest 的 root 是 backend/，cwd 取决于调用方式
const DATA_DIR = path.resolve(__dirname, '../data/planning')
const RAW = path.join(DATA_DIR, 'qinzhou-port-planning-raw.2026-11-03.json')
const CSV = path.join(DATA_DIR, 'qinzhou-port-planning-points.2026-11-03.csv')

/** 北部湾研究区（与 backend 侧业务范围同量级，只用来识别明显错的坐标） */
const BBOX = { lng: [107.9, 109.9] as const, lat: [21.2, 22.2] as const }

interface Point {
  coordinate: [number, number] | null
  status: string
}
interface Area extends Point {
  name: string
  representative_point: { coordinate: [number, number]; derived_from: string }
  anchors: Array<{ name: string; coordinate: [number, number] }>
}

function inBbox([lng, lat]: [number, number]): boolean {
  return lng >= BBOX.lng[0] && lng <= BBOX.lng[1] && lat >= BBOX.lat[0] && lat <= BBOX.lat[1]
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
  const head = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row: Record<string, string> = {}
    head.forEach((k, i) => (row[k] = cells[i] ?? ''))
    return row
  })
}

describe('规划港区采集件', () => {
  const raw = JSON.parse(readFileSync(RAW, 'utf8')) as {
    port_areas: Area[]
    harbor_points: Point[]
    industrial_parks: Point[]
  }

  it('原始件自述为未加工采集件，且带采集日期与坐标口径', () => {
    expect(raw.port_areas).toHaveLength(3)
    const meta = (raw as unknown as { meta: Record<string, string> }).meta
    expect(meta.collected_date).toBe('2026-11-03')
    expect(meta.coordinate_system).toContain('CGCS2000')
    expect(meta.integrity_note).toContain('pending')
  })

  it('三个规划港区代表点都落在北部湾研究区内，且等于其两个法定锚点的均值', () => {
    for (const area of raw.port_areas) {
      const rep = area.representative_point.coordinate
      expect(inBbox(rep)).toBe(true)

      expect(area.anchors).toHaveLength(2)
      for (const a of area.anchors) expect(inBbox(a.coordinate)).toBe(true)

      const meanLng = (area.anchors[0].coordinate[0] + area.anchors[1].coordinate[0]) / 2
      const meanLat = (area.anchors[0].coordinate[1] + area.anchors[1].coordinate[1]) / 2
      // 采集件只保留 6 位小数：1e-5 ≈ 1m，足以挡住「手填一个大概值」而放过舍入
      expect(Math.abs(rep[0] - meanLng)).toBeLessThan(1e-5)
      expect(Math.abs(rep[1] - meanLat)).toBeLessThan(1e-5)
    }
  })

  it('status=pending 的条目不得带坐标（不许把推算值伪装成实测值）', () => {
    const pending = [...raw.harbor_points, ...raw.industrial_parks].filter(
      (p) => p.status === 'pending'
    )
    expect(pending.length).toBeGreaterThan(0)
    for (const p of pending) expect(p.coordinate).toBeNull()
  })

  it('点位 CSV 与原始件同口径：全部 verified、坐标在界内、id 不重复', () => {
    const rows = parseCsv(readFileSync(CSV, 'utf8'))
    expect(rows.length).toBe(9)
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    for (const r of rows) {
      expect(r.status).toBe('verified')
      expect(r.coordinate_system).toBe('CGCS2000')
      expect(inBbox([Number(r.lng), Number(r.lat)])).toBe(true)
    }
    const reps = rows.filter((r) => r.category === 'port_area_representative')
    expect(reps).toHaveLength(3)
    // CSV 与 JSON 的港区代表点必须逐点相同（同一事实只有一份数字）
    for (const area of raw.port_areas) {
      const hit = reps.find((r) => r.point_name.startsWith(area.name))
      expect(hit, `CSV 缺 ${area.name}`).toBeTruthy()
      expect(Number(hit!.lng)).toBeCloseTo(area.representative_point.coordinate[0], 6)
      expect(Number(hit!.lat)).toBeCloseTo(area.representative_point.coordinate[1], 6)
    }
  })
})
