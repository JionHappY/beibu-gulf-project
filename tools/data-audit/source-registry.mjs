#!/usr/bin/env node
/**
 * source-registry.mjs — 数据来源登记的守卫（W9）。
 *
 * ## 它治什么
 *
 * 论文与开源的第一问是"这些数据哪来的、能不能用"。此前答案散在 README/脚本注释里，
 * 且**没有任何判据**保证新增数据资产会被登记——典型的"无权威源的多份副本"（AGENTS §七-7）。
 *
 * ## 它怎么做
 *
 * 1. `git ls-files backend/data backend/static` 取**受版本控制的数据资产全集**（派生，不手写清单）；
 * 2. 与 `source-registry.json` 的组逐一对齐：每个文件必须被至少一组覆盖；
 * 3. 有任何文件没被覆盖 ⇒ 非零退出（新增资产忘登记即红）；
 * 4. `pending` 组必须设 `reviewBy`（YYYY-MM-DD）：缺字段/格式错/已到期 ⇒ 非零退出；
 *    未到期只打印剩余天数——**未确认的来源是要还的债**，不许静默，也不许无限期挂着。
 *
 * 用法：
 *   node tools/data-audit/source-registry.mjs            # 核对（缺登记/到期 pending 即 exit 1）
 *   node tools/data-audit/source-registry.mjs --json     # 机器可读输出
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const REGISTRY_PATH = path.join(HERE, 'source-registry.json')

export const SCAN_ROOTS = ['backend/data', 'backend/static']

/** 极简 glob：支持 ** 与 *（不引入依赖） */
export function matchesGlob(file, pattern) {
  const norm = file.replace(/\\/g, '/')
  if (!pattern.includes('*')) return norm === pattern
  // 先按 ** 切段（段内 * 不跨目录），再各段转义——避免用控制字符占位（no-control-regex）
  const rx = pattern
    .split('**')
    .map((seg) => seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('.*')
  return new RegExp('^' + rx + '$').test(norm)
}

/** 某文件是否被该组覆盖 */
export function groupCovers(group, file) {
  const exact = group.paths ?? []
  const globs = group.globs ?? []
  return exact.includes(file) || globs.some((g) => matchesGlob(file, g))
}

/** 覆盖率计算（纯函数）：返回 { gaps, counts } */
export function computeCoverage(files, groups) {
  const gaps = []
  const counts = {}
  for (const g of groups) counts[g.id] = 0
  for (const f of files) {
    const hit = groups.find((g) => groupCovers(g, f))
    if (!hit) gaps.push(f)
    else counts[hit.id] += 1
  }
  return { gaps, counts }
}

/** 登记表自检：必填字段、id 唯一 */
export function validateRegistry(registry) {
  const problems = []
  const seen = new Set()
  for (const g of registry.groups ?? []) {
    if (!g.id) problems.push('组缺 id：' + JSON.stringify(g).slice(0, 60))
    else if (seen.has(g.id)) problems.push('id 重复：' + g.id)
    else seen.add(g.id)
    for (const field of ['source', 'license', 'fetchedAt', 'coverage', 'quality']) {
      if (!g[field]) problems.push((g.id ?? '?') + ' 缺字段 ' + field)
    }
    if (!(g.paths?.length || g.globs?.length))
      problems.push((g.id ?? '?') + ' 既无 paths 也无 globs')
  }
  return problems
}

/** 口径假设的合法状态：作者设定 / 文献锚点 / 合成 / 代理指标 / 未达标待裁 */
export const ASSUMPTION_STATUSES = ['author-set', 'literature', 'synthetic', 'proxy', 'unverified']

/**
 * 口径假设自检：必填字段、id 唯一、status 合法、每个 where 指向的文件必须存在。
 *
 * 为什么要查文件存在：假设条目一旦指向被删除/改名的实现，登记表就变成第二份过期文档；
 * 这里让「代码没了、假设还在」当场红，而不是等论文引用时才发现。
 */
export function validateAssumptions(registry) {
  const problems = []
  const seen = new Set()
  for (const a of registry.assumptions ?? []) {
    const id = a.id ?? '?'
    if (!a.id) problems.push('假设缺 id：' + JSON.stringify(a).slice(0, 60))
    else if (seen.has(a.id)) problems.push('假设 id 重复：' + a.id)
    else seen.add(a.id)

    for (const field of ['title', 'basis', 'status', 'impact', 'disclosure']) {
      if (!a[field]) problems.push(id + ' 缺字段 ' + field)
    }
    if (!Array.isArray(a.where) || a.where.length === 0) {
      problems.push(id + ' 缺 where（至少一个 file:line）')
    } else {
      for (const w of a.where) {
        const file = String(w).split(':')[0]
        if (!fs.existsSync(path.join(ROOT, file))) problems.push(id + ' where 文件不存在：' + file)
      }
    }
    if (a.status && !ASSUMPTION_STATUSES.includes(a.status)) {
      problems.push(
        id + ' status 非法：' + a.status + '（合法：' + ASSUMPTION_STATUSES.join('/') + '）'
      )
    }
  }
  return problems
}

/** 论文「数据与口径假设」表：由登记表派生，禁止手抄第二份 */
export function assumptionTable(registry) {
  const rows = ['| 口径 | 落点 | 依据 | 状态 | 论文表述要求 |', '| --- | --- | --- | --- | --- |']
  for (const a of registry.assumptions ?? []) {
    const where = (a.where ?? []).map((w) => '`' + w + '`').join('<br>')
    rows.push(
      '| ' + a.title + ' | ' + where + ' | ' + a.basis + ' | ' + a.status + ' | ' + a.impact + ' |'
    )
  }
  return rows.join('\n')
}

/** UTC 日期 YYYY-MM-DD：判据与运行机器的时区无关（CI 在 UTC，本机在 +08） */
export function utcDate(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

/** 严格 `YYYY-MM-DD`：Date.parse('2026-02-30') 会滚到 03-02，必须回比字符串才算合法 */
export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * pending 组的复查截止日判据（纯函数；today 由调用方注入，测试不受系统时钟摆布）。
 *
 * - 缺 `reviewBy` / 格式非法 ⇒ problem（新 pending 未设截止日 = 当场红）
 * - `reviewBy` < today（UTC 日期比较）⇒ problem（到期红）
 * - 未到期 ⇒ 进 upcoming（带剩余天数，只报告债务，不参与退出码）
 * - `confirmed` 组不要求 `reviewBy`；即使带了也不报错（普通字段，不是判据面）
 */
export function checkReviewBy(groups, today) {
  const problems = []
  const upcoming = []
  for (const g of groups ?? []) {
    if (g.provenanceStatus !== 'pending') continue
    if (!g.reviewBy) {
      problems.push((g.id ?? '?') + ' 缺 reviewBy（pending 组必须设复查截止日 YYYY-MM-DD）')
      continue
    }
    if (!isIsoDate(g.reviewBy)) {
      problems.push(
        (g.id ?? '?') + ' reviewBy 格式非法：' + g.reviewBy + '（须为真实日期 YYYY-MM-DD）'
      )
      continue
    }
    const days = Math.round(
      (Date.parse(g.reviewBy + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000
    )
    if (days < 0) {
      problems.push(
        g.id + ' reviewBy 已到期：' + g.reviewBy + '（逾期 ' + -days + ' 天；须结清来源或改期）'
      )
    } else {
      upcoming.push({ id: g.id, reviewBy: g.reviewBy, days })
    }
  }
  return { problems, upcoming }
}

function trackedDataFiles() {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', 'ls-files', ...SCAN_ROOTS], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error('git ls-files 失败：' + (r.stderr || '').slice(0, 200))
  return r.stdout.split('\n').filter(Boolean)
}

function main() {
  const asJson = process.argv.includes('--json')
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'))
  const problems = [...validateRegistry(registry), ...validateAssumptions(registry)]
  const assumptions = registry.assumptions ?? []
  const files = trackedDataFiles()
  const { gaps, counts } = computeCoverage(files, registry.groups)
  const pending = registry.groups.filter((g) => g.provenanceStatus === 'pending')
  const today = utcDate()
  const review = checkReviewBy(registry.groups, today)
  problems.push(...review.problems)

  if (process.argv.includes('--table')) {
    if (problems.length) {
      console.error('[source-registry] 登记表自检失败，拒绝派生表格：')
      for (const p of problems) console.error('  - ' + p)
      process.exit(1)
    }
    console.log(assumptionTable(registry))
    return
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          files: files.length,
          gaps,
          counts,
          problems,
          pending: pending.map((g) => g.id),
          assumptions: assumptions.length,
          review: { today, upcoming: review.upcoming },
        },
        null,
        2
      )
    )
  } else {
    console.log(
      '[source-registry] 数据资产 ' +
        files.length +
        ' 件 / 登记组 ' +
        registry.groups.length +
        ' 组'
    )
    const reviewById = new Map(review.upcoming.map((u) => [u.id, u]))
    for (const g of registry.groups) {
      const mark = g.provenanceStatus === 'pending' ? '⚠️ 来源未确认' : '✅'
      const due =
        g.provenanceStatus === 'pending' && g.reviewBy
          ? ' [reviewBy ' +
            g.reviewBy +
            (reviewById.has(g.id) ? '，剩 ' + reviewById.get(g.id).days + ' 天' : '，已到期') +
            ']'
          : ''
      console.log('  ' + mark + ' ' + g.id + '：' + counts[g.id] + ' 件 — ' + g.title + due)
    }
    const byStatus = {}
    for (const a of assumptions) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    console.log(
      '[source-registry] 口径假设 ' +
        assumptions.length +
        ' 条（' +
        Object.entries(byStatus)
          .map(([k, v]) => k + ' ' + v)
          .join(' / ') +
        '）；--table 可派生论文表'
    )
    if (problems.length) {
      console.error('[source-registry] 登记表自检失败：')
      for (const p of problems) console.error('  - ' + p)
    }
    if (gaps.length) {
      console.error(
        '[source-registry] ✗ ' +
          gaps.length +
          ' 件数据资产未登记（新增资产必须进 source-registry.json）：'
      )
      for (const f of gaps.slice(0, 20)) console.error('  - ' + f)
      if (gaps.length > 20) console.error('  … 其余 ' + (gaps.length - 20) + ' 件见 --json')
    }
    const debt = pending.length
      ? '；待还债：' +
        pending.length +
        ' 组来源未确认（' +
        pending
          .map((g) =>
            reviewById.has(g.id)
              ? g.id + ' 剩 ' + reviewById.get(g.id).days + ' 天'
              : g.id + ' 已到期/缺截止日'
          )
          .join('、') +
        '）'
      : ''
    console.log(
      '[source-registry] ' +
        (gaps.length === 0 && problems.length === 0 ? '✓ 全部数据资产已登记' : '✗ 未通过') +
        debt
    )
  }
  process.exit(gaps.length === 0 && problems.length === 0 ? 0 : 1)
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
