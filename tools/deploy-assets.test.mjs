// 3D 资产清单的跨文件一致性判据（AGENTS §七-7：同一事实不得有两份手抄而不设守卫）。
//
// 事实的唯一来源是前端 spec（`beibu3dTiles.ts` 里 `url: '/static/...'`，决定浏览器请求什么）；
// CI 的部署前哨（`.github/workflows/ci.yml`「阶段 1.6」）把同一批路径手抄成 `test -s` 清单。
// 少了这条判据，前端新增第 6 条 URL 时前哨仍只查 5 条 ⇒ 新图层继续静默 404，而门禁全绿。
//
// 失效条件：① 前哨改为从 spec 生成（例如构建期产出清单文件）⇒ 本比对应改读生成物；
// ② 资产改走对象存储/CDN（不再有 `backend/static/<tree>/…tileset.json`）⇒ 两侧提取面同时失效。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CI = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')
const SPEC = fs.readFileSync(
  path.join(ROOT, 'frontend/src/business/route-analysis/constants/beibu3dTiles.ts'),
  'utf8'
)

const TREES = '(?:qinzhou-port|bridges-city)'

/** 前哨侧：CI 文本里的宿主路径（去重排序） */
export function ciAssetPaths(text) {
  const hits = [
    ...text.matchAll(new RegExp(`backend/static/${TREES}/[A-Za-z0-9_./-]*tileset\\.json`, 'g')),
  ]
  return [...new Set(hits.map((m) => m[0]))].sort()
}

/** 前端侧：spec 的 `/static/...` URL 映射回宿主路径（去重排序） */
export function specAssetPaths(text) {
  const hits = [...text.matchAll(new RegExp(`url: '/static/(${TREES}/[^']+)'`, 'g'))]
  return [...new Set(hits.map((m) => 'backend/static/' + m[1]))].sort()
}

describe('3D 资产部署前哨清单（CI ↔ 前端 spec）', () => {
  it('两侧路径集合一一对应', () => {
    const ci = ciAssetPaths(CI)
    expect(ci.length, 'CI 前哨里没找到 qinzhou-port/bridges-city 的 tileset 路径').toBeGreaterThan(
      0
    )
    expect(ci).toEqual(specAssetPaths(SPEC))
  })

  it('@guard-red-sample 前哨少抄一条 ⇒ 集合不等（改一处必红）', () => {
    const mutated = CI.replace(
      /^\s+backend\/static\/bridges-city\/tileset\.json; do \\$/m,
      ' bridges-city-placeholder; do \\'
    )
    expect(mutated).not.toBe(CI)
    expect(ciAssetPaths(mutated)).not.toEqual(specAssetPaths(SPEC))
  })

  it('@guard-red-sample 前端新增一条 URL ⇒ 集合不等（新图层不会被静默漏查）', () => {
    const mutated =
      SPEC + "\nconst EXTRA = { url: '/static/qinzhou-port/rebuilt/water/tileset.json' }\n"
    expect(mutated).not.toBe(SPEC)
    expect(ciAssetPaths(CI)).not.toEqual(specAssetPaths(mutated))
  })
})
