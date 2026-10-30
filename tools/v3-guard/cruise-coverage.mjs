#!/usr/bin/env node
/**
 * cruise-coverage.mjs — 04-E2 承接体：守护规则的模块集合 == 实际目录集合。
 *
 * 背景（z055）：04-防复发清单 E2 明文要求"规则里的模块集合 == 实际目录集合，
 * 缺一个即 fail"，但全仓无承接体。实证：business 互引规则曾只枚举 3 个模块，
 * route-analysis 自落地起无守护（z051/z053）；且"逐个枚举"式规则每加一个模块
 * 要静默少一格保护。
 *
 * 本守卫断言（business 域，双向）：
 *   ① business/ 下每个模块目录都有对应的 business-cross-import-<name> 规则；
 *   ② 规则里出现的每个模块名都对应真实存在的目录（防规则指向已删模块）。
 * 新增业务目录未建规则 ⇒ 红；规则引用幽灵模块 ⇒ 红。
 *
 * 追加（backend feature 域）：
 *   ③ backend/src/modules 下每个 feature 目录都有 nest-cross-feature-<域> 规则（双向）；
 *   ④ 显式豁免条目必须仍对应真实 import：删掉被豁免的 import 后条目转红（防过期豁免）；
 *   ⑤ scoped 规则数量 == 豁免源文件分组数（配置与登记表不得单向漂移）。
 *
 * 用法：node tools/v3-guard/cruise-coverage.mjs   # 集合不一致 exit 1
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { emptyInputProblem } from './lib/input-set.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const CRUISE_CONFIG = '.dependency-cruiser.cjs'
const BUSINESS_DIR = 'frontend/src/business'
const RULE_PREFIX = 'business-cross-import-'
const BACKEND_MODULES_DIR = 'backend/src/modules'
const NEST_RULE_PREFIX = 'nest-cross-feature-'
const NEST_EXEMPTIONS_FILE = 'tools/v3-guard/nest-cross-feature-exemptions.json'

/** business/ 下的模块目录（排除 index.ts / manifest.ts 等文件与 __tests__） */
export function listBusinessModules(root = ROOT) {
  const dir = path.join(root, BUSINESS_DIR)
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '__tests__')
    .map((e) => e.name)
    .sort()
}

/**
 * 从 cruise **配置对象**提取 business-cross-import-* 规则覆盖的模块名。
 *
 * 为什么收配置对象而不是配置文本（W11）：原实现对 `.dependency-cruiser.cjs` 的**文本**做正则，
 * 于是「注释掉一条规则」照样命中（规则名仍在注释里）⇒ 规则真的被停用时守卫不红。
 * 现在读 `require()` 出来的真实 `forbidden` 数组，注释/字符串里的同名文本不再算数。
 */
export function parseRuleModules(config) {
  const forbidden = Array.isArray(config?.forbidden) ? config.forbidden : []
  const modules = []
  for (const rule of forbidden) {
    const name = typeof rule?.name === 'string' ? rule.name : ''
    if (!name.startsWith(RULE_PREFIX)) continue
    const moduleName = name.slice(RULE_PREFIX.length)
    const fromPath = typeof rule?.from?.path === 'string' ? rule.from.path : ''
    const m = /\^?frontend\/src\/business\/([^/]+)\//.exec(fromPath)
    const fromModule = m ? m[1] : ''
    if (moduleName !== fromModule) {
      throw new Error(
        `规则名与 from 路径不一致：name=${moduleName} from=${fromModule}（命名约定 business-cross-import-<目录名>）`
      )
    }
    modules.push(moduleName)
  }
  return modules.sort()
}

/**
 * 分层规则覆盖面（W61 M4）：本表登记的每条分层规则，其 `from.path` 必须覆盖它宣称的整层。
 *
 * 为什么需要它：实测把 `core-not-import-services` 的 `from.path` 从 `^frontend/src/core/`
 * 窄写成 `^frontend/src/core/map/` 时，规则名与 comment 仍宣称「core 层」，而
 * `core/config`、`core/layout` 等子目录的反向边静默无人守 ⇒ 名实不符的假面。
 * 断言「规则名宣称的层 == from.path 的前缀」即可堵住这一面。
 */
const LAYER_RULES = [
  { name: 'core-not-import-services', prefix: '^frontend/src/core/' },
  { name: 'services-not-import-core', prefix: '^frontend/src/services/' },
  { name: 'core-imports-business', prefix: '^frontend/src/core/' },
  { name: 'services-imports-business', prefix: '^frontend/src/services/' },
  { name: 'shared-not-import-core', prefix: '^frontend/src/shared/' },
  { name: 'business-root-not-deep-import-modules', prefix: '^frontend/src/business/[^/]+\\.ts$' },
]

export function auditLayerRules(cruiseConfig) {
  const forbidden = Array.isArray(cruiseConfig?.forbidden) ? cruiseConfig.forbidden : []
  const problems = []
  for (const { name, prefix } of LAYER_RULES) {
    const rule = forbidden.find((r) => r?.name === name)
    if (!rule) {
      problems.push(`✗ 分层规则 ${name} 不在 .dependency-cruiser.cjs 里（名实相符要求它在册）`)
      continue
    }
    const fromPath = typeof rule.from?.path === 'string' ? rule.from.path : ''
    // 「覆盖整层」= 以前缀开头且前缀之后只剩正则结束符。
    // 不能只用 startsWith：`^frontend/src/core/map/` 同样以 `^frontend/src/core/` 开头，
    // 窄口径会被判成合法——那正是本断言要堵的假面（W61 M4 实测）。
    const rest = fromPath.startsWith(prefix) ? fromPath.slice(prefix.length) : null
    const coversWholeLayer = rest === '' || rest === '$' || rest === "$'" || rest === "')"
    if (!coversWholeLayer) {
      problems.push(
        `✗ 分层规则 ${name} 的 from.path 未覆盖整层：${fromPath}（应为 ${prefix}；写窄会让该层其余子目录的反向边无人守）`
      )
    }
  }
  return problems
}

/**
 * E2 对账。
 * @returns {{ problems: string[], rules: string[], dirs: string[] }}
 */
export function auditCoverage(cruiseConfig, dirs) {
  const problems = []
  const rules = parseRuleModules(cruiseConfig)

  for (const dir of dirs) {
    if (!rules.includes(dir)) {
      problems.push(
        `✗ business/${dir} 无互引守护规则：需在 .dependency-cruiser.cjs 增加 business-cross-import-${dir}（04-E2：规则集合 == 目录集合）`
      )
    }
  }
  for (const rule of rules) {
    if (!dirs.includes(rule)) {
      problems.push(
        `✗ 规则 business-cross-import-${rule} 指向不存在的目录 business/${rule}（幽灵规则）`
      )
    }
  }
  return { problems, rules, dirs }
}

/** backend/src/modules 下的 feature 目录（排除 __tests__） */
export function listBackendFeatures(root = ROOT) {
  const dir = path.join(root, BACKEND_MODULES_DIR)
  // 目录缺失按 0 个处理，交给 main 的 emptyInputProblem 报「空分母」——
  // 直接 readdir 抛 ENOENT 会把「没扫到」伪装成装置崩溃，判据仍然没跑。
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '__tests__')
    .map((e) => e.name)
    .sort()
}

/**
 * 从 cruise **配置对象**提取 `nest-cross-feature-<域>` 规则覆盖的域。
 * 与 business 版同因：读 require() 出来的对象，注释里的规则名不算数。
 * scoped 规则（`nest-cross-feature-scoped-<域>-<n>`）不参与「域集合」对账。
 */
export function parseNestFeatureRules(config) {
  const forbidden = Array.isArray(config?.forbidden) ? config.forbidden : []
  const domains = []
  for (const rule of forbidden) {
    const name = typeof rule?.name === 'string' ? rule.name : ''
    if (!name.startsWith(NEST_RULE_PREFIX)) continue
    const suffix = name.slice(NEST_RULE_PREFIX.length)
    if (suffix.startsWith('scoped-')) continue
    const fromPath = typeof rule?.from?.path === 'string' ? rule.from.path : ''
    const m = /\^?backend\/src\/modules\/([^/]+)\//.exec(fromPath)
    const fromDomain = m ? m[1] : ''
    if (suffix !== fromDomain) {
      throw new Error(
        `规则名与 from 路径不一致：name=${suffix} from=${fromDomain}（命名约定 nest-cross-feature-<目录名>）`
      )
    }
    domains.push(suffix)
  }
  return domains.sort()
}

const featureOfPath = (file) => {
  const m = /^backend\/src\/modules\/([^/]+)\//.exec(file || '')
  return m ? m[1] : ''
}

/** 把 scoped 规则的 from.path（正则字面量）还原为文件路径 */
const unescapePathRe = (re) =>
  (re || '').replace(/^\^/, '').replace(/\$$/, '').replace(/\\(.)/g, '$1')

/**
 * 对账：backend feature 域集合 == `nest-cross-feature-*` 规则域集合，双向。
 * 另断言 scoped 规则数量与豁免登记表的「源文件分组数」一致，且规则指向的文件真实存在。
 */
export function auditNestFeatureCoverage(config, dirs, exemptions = []) {
  const problems = []
  const domains = parseNestFeatureRules(config)

  for (const dir of dirs) {
    if (!domains.includes(dir)) {
      problems.push(
        `✗ backend feature ${dir} 无 cross-feature 规则：需在 .dependency-cruiser.cjs 增加 nest-cross-feature-${dir}（规则集合由 backend/src/modules 目录派生）`
      )
    }
  }
  for (const domain of domains) {
    if (!dirs.includes(domain)) {
      problems.push(
        `✗ 规则 nest-cross-feature-${domain} 指向不存在的目录 modules/${domain}（幽灵规则）`
      )
    }
  }

  const forbidden = Array.isArray(config?.forbidden) ? config.forbidden : []
  const scoped = forbidden.filter(
    (r) =>
      typeof r?.name === 'string' &&
      r.name.startsWith(NEST_RULE_PREFIX) &&
      r.name.slice(NEST_RULE_PREFIX.length).startsWith('scoped-')
  )
  const expectedGroups = new Set(
    (Array.isArray(exemptions) ? exemptions : []).map((e) => `${featureOfPath(e?.from)}|${e?.from}`)
  )
  if (scoped.length !== expectedGroups.size) {
    problems.push(
      `✗ scoped 规则 ${scoped.length} 条 ≠ 豁免源文件分组 ${expectedGroups.size} 组（登记表与配置单向漂移）`
    )
  }
  for (const rule of scoped) {
    const file = unescapePathRe(rule?.from?.path)
    if (!file || !existsSync(path.join(ROOT, file))) {
      problems.push(`✗ scoped 规则 ${rule.name} 指向不存在的源文件：${file || '(空)'}`)
    }
  }

  return { problems, domains, scoped }
}

/** 解析一条相对 import 的落点（TS 后端惯例：无扩展名） */
function resolveImport(fileAbs, spec) {
  const base = path.resolve(path.dirname(fileAbs), spec)
  for (const candidate of [base, `${base}.ts`, `${base}.js`, path.join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * 豁免不过期：每条登记都必须仍对应一条真实 import。
 * 删掉被豁免的 import 而条目留着 ⇒ 红（否则豁免清单会永久膨胀、掩盖新耦合）。
 */
export function auditExemptionLiveness(exemptions, root = ROOT) {
  const problems = []
  const entries = Array.isArray(exemptions) ? exemptions : []
  for (const [i, e] of entries.entries()) {
    const tag = `豁免#${i + 1}（${e?.id ?? '无 id'}）`
    if (!e?.from || !e?.to || !e?.reason) {
      problems.push(`✗ ${tag} 缺 from / to / reason`)
      continue
    }
    if (!featureOfPath(e.from)) {
      problems.push(`✗ ${tag} 的 from 不在 backend/src/modules/<域>/ 下：${e.from}`)
      continue
    }
    const abs = path.join(root, e.from)
    if (!existsSync(abs)) {
      problems.push(`✗ ${tag} 的源文件不存在：${e.from}`)
      continue
    }
    const text = readFileSync(abs, 'utf8')
    const specs = [...text.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1])
    const hit = specs.some((spec) => {
      const resolved = resolveImport(abs, spec)
      return resolved !== null && path.relative(root, resolved).replace(/\\/g, '/') === e.to
    })
    if (!hit) {
      problems.push(
        `✗ ${tag} 已过期：${e.from} 不再 import ${e.to}（删除 import 时须同笔删豁免条目）`
      )
    }
  }
  return problems
}

// ---------- main ----------

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const require = createRequire(import.meta.url)
  let config
  try {
    // 读**真实配置**（require 后的对象），不读文本：文本里注释掉的规则同样会被正则命中
    config = require(path.join(ROOT, CRUISE_CONFIG))
  } catch (err) {
    console.error(`[cruise-coverage] 无法加载 ${CRUISE_CONFIG}：${err?.message ?? err}`)
    process.exit(1)
  }
  const dirs = listBusinessModules()
  // W58：空分母防护——0 个目录时「规则集合 == 目录集合 ✓」是空对空，判据没跑
  const empty = emptyInputProblem(dirs.length, {
    what: 'business 模块目录',
    hint: 'frontend/src/business 没被挪位、`listBusinessModules()` 的过滤条件没把目录全筛掉',
  })
  if (empty) {
    console.error(`[cruise-coverage] FAIL：${empty}`)
    process.exit(1)
  }
  const { problems, rules } = auditCoverage(config, dirs)
  const layerProblems = auditLayerRules(config)

  // backend feature 域（规则集合 == 目录集合）+ 豁免不过期
  const features = listBackendFeatures()
  const featureEmpty = emptyInputProblem(features.length, {
    what: 'backend feature 目录',
    hint: 'backend/src/modules 没被挪位、`listBackendFeatures()` 的过滤条件没把目录全筛掉',
  })
  if (featureEmpty) {
    console.error(`[cruise-coverage] FAIL：${featureEmpty}`)
    process.exit(1)
  }
  const exemptions = JSON.parse(readFileSync(path.join(ROOT, NEST_EXEMPTIONS_FILE), 'utf8'))
  const nest = auditNestFeatureCoverage(config, features, exemptions)
  const exemptionProblems = auditExemptionLiveness(exemptions)

  console.log(`[cruise-coverage] business 目录 ${dirs.length} 个：${dirs.join('、')}`)
  console.log(
    `[cruise-coverage] 互引规则 ${rules.length} 条：${rules.map((r) => RULE_PREFIX + r).join('、')}`
  )
  console.log(
    `[cruise-coverage] backend feature 目录 ${features.length} 个：${features.join('、')}`
  )
  console.log(
    `[cruise-coverage] cross-feature 规则 ${nest.domains.length} 条 + scoped ${nest.scoped.length} 条；豁免 ${exemptions.length} 条`
  )
  const allProblems = [...problems, ...layerProblems, ...nest.problems, ...exemptionProblems]
  if (allProblems.length) {
    console.error('\n' + allProblems.join('\n'))
    console.error(`\n[cruise-coverage] 04-E2 对账未通过（${allProblems.length} 处）`)
    process.exit(1)
  }
  console.log('[cruise-coverage] 规则集合 == 目录集合 ✓')
  console.log(`[cruise-coverage] 分层规则覆盖面 ${LAYER_RULES.length} 条 ✓`)
  console.log('[cruise-coverage] backend feature 规则集合 == 目录集合 ✓；豁免条目均未过期 ✓')
}
