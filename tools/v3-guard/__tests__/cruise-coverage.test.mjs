import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  auditCoverage,
  auditExemptionLiveness,
  auditLayerRules,
  auditNestFeatureCoverage,
  parseNestFeatureRules,
  parseRuleModules,
} from '../cruise-coverage.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GUARD = path.resolve(HERE, '../cruise-coverage.mjs')
const ROOT = path.resolve(HERE, '../../..')

// 最小 cruise 配置**对象**（规则命名约定：business-cross-import-<目录名>）。
// W11 起对账读 require() 出来的真实配置对象，故 fixture 也必须是对象——
// 文本 fixture 会让"注释里的规则名"重新变成可命中项。
const CRUISE_OK = {
  forbidden: [
    {
      name: 'business-cross-import-flood-analysis',
      from: { path: '^frontend/src/business/flood-analysis/' },
      to: { pathNot: '^frontend/src/business/flood-analysis/' },
    },
    {
      name: 'business-cross-import-forecast',
      from: { path: '^frontend/src/business/forecast/' },
      to: { pathNot: '^frontend/src/business/forecast/' },
    },
  ],
}

describe('cruise-coverage：04-E2 规则集合 == 目录集合（z055）', () => {
  it('目录与规则一一对应时无问题', () => {
    const { problems, rules } = auditCoverage(CRUISE_OK, ['flood-analysis', 'forecast'])
    expect(problems).toEqual([])
    expect(rules).toEqual(['flood-analysis', 'forecast'])
  })

  it('@guard-red-sample 阳性对照①：新增业务目录未建规则必红（route-analysis 落地即无守护的回归形态）', () => {
    const { problems } = auditCoverage(CRUISE_OK, ['flood-analysis', 'forecast', 'route-analysis'])
    expect(problems.some((p) => p.includes('business/route-analysis 无互引守护规则'))).toBe(true)
  })

  it('阳性对照②：规则指向不存在的目录（幽灵规则）必红', () => {
    const { problems } = auditCoverage(CRUISE_OK, ['flood-analysis', 'forecast', 'site-selection'])
    expect(
      problems.some((p) => p.includes('幽灵规则') || p.includes('site-selection 无互引守护规则'))
    ).toBe(true)
  })

  it('规则名与 from 路径不一致时抛错（命名约定被破坏）', () => {
    const bad = {
      forbidden: [
        {
          name: 'business-cross-import-flood',
          from: { path: '^frontend/src/business/flood-analysis/' },
        },
      ],
    }
    expect(() => parseRuleModules(bad)).toThrow(/命名约定/)
  })

  it('🔴 不再数注释里的规则名：规则只剩在注释文本里即在册（W11）', () => {
    // 旧实现读配置**文本**做正则 ⇒ 规则名留在注释里照样命中，规则真被停用也不红。
    const commentedOut = {
      comment:
        "// { name: 'business-cross-import-forecast', from: { path: '^frontend/src/business/forecast/' } }",
      forbidden: CRUISE_OK.forbidden.slice(0, 1), // forecast 那条已从真实配置里拿掉
    }
    expect(parseRuleModules(commentedOut)).toEqual(['flood-analysis'])
    const { problems } = auditCoverage(commentedOut, ['flood-analysis', 'forecast'])
    expect(problems.some((p) => p.includes('business/forecast 无互引守护规则'))).toBe(true)
  })
})

describe('cruise-coverage：分层规则覆盖面（W61 M4：from.path 不许窄于它宣称的整层）', () => {
  // 最小配置：只放分层规则，不放 business 互引规则（本 describe 只测分层覆盖面）。
  const LAYER_OK = {
    forbidden: [
      { name: 'core-not-import-services', from: { path: '^frontend/src/core/' }, to: {} },
      { name: 'services-not-import-core', from: { path: '^frontend/src/services/' }, to: {} },
      { name: 'core-imports-business', from: { path: '^frontend/src/core/' }, to: {} },
      { name: 'services-imports-business', from: { path: '^frontend/src/services/' }, to: {} },
      { name: 'shared-not-import-core', from: { path: '^frontend/src/shared/' }, to: {} },
      {
        name: 'business-root-not-deep-import-modules',
        from: { path: '^frontend/src/business/[^/]+\\.ts$' },
        to: {},
      },
    ],
  }

  it('六条分层规则的 from.path 各覆盖其整层 ⇒ 无问题', () => {
    expect(auditLayerRules(LAYER_OK)).toEqual([])
  })

  it('@guard-red-sample 阳性对照：from.path 窄写成 core/map/ ⇒ 必红且点名该规则', () => {
    // W61 实测形态：规则名与 comment 仍宣称「core 层」，from.path 却只覆盖 core/map/，
    // 于是 core/config、core/layout 的反向边静默无人守——名实不符的假面。
    const narrowed = {
      forbidden: LAYER_OK.forbidden.map((r) =>
        r.name === 'core-not-import-services'
          ? { ...r, from: { path: '^frontend/src/core/map/' } }
          : r
      ),
    }
    const problems = auditLayerRules(narrowed)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('core-not-import-services')
    expect(problems[0]).toContain('^frontend/src/core/map/')
  })

  it('@guard-red-sample 阳性对照：分层规则被整条删掉 ⇒ 必红（在册性）', () => {
    const removed = {
      forbidden: LAYER_OK.forbidden.filter((r) => r.name !== 'services-not-import-core'),
    }
    const problems = auditLayerRules(removed)
    expect(problems.some((p) => p.includes('services-not-import-core') && p.includes('不在'))).toBe(
      true
    )
  })

  it('@guard-red-sample 端到端：真实配置里把某层 from.path 改窄 ⇒ 守卫本体 exit 1', () => {
    // M2 形态：main 不接 auditLayerRules 时，纯函数用例全绿而守卫本体静默放行——
    // 所以必须有一条起子进程的端到端断言钉住「接线」这件事（PD-2 M1 同型教训）。
    const src = fs.readFileSync(GUARD, 'utf8')
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w61-m4-'))
    fs.mkdirSync(path.join(tmp, 'tools/v3-guard/lib'), { recursive: true })
    // 守卫本体按 `../../..` 反推仓库根，依赖须按同层级一起抄
    fs.copyFileSync(GUARD, path.join(tmp, 'tools/v3-guard/cruise-coverage.mjs'))
    fs.copyFileSync(
      path.join(path.dirname(GUARD), 'lib/input-set.mjs'),
      path.join(tmp, 'tools/v3-guard/lib/input-set.mjs')
    )
    fs.mkdirSync(path.join(tmp, 'frontend/src/business/flood-analysis'), { recursive: true })
    // 守卫还会对账 backend feature（规则集合由目录派生）并读豁免登记表——
    // 夹具必须同时给出最小 feature 目录与登记表，否则红的是「读不到目录」而非被测判据。
    fs.mkdirSync(path.join(tmp, 'backend/src/modules/auth'), { recursive: true })
    fs.copyFileSync(
      path.join(path.dirname(GUARD), 'nest-cross-feature-exemptions.json'),
      path.join(tmp, 'tools/v3-guard/nest-cross-feature-exemptions.json')
    )
    // 变异：把 `.dependency-cruiser.cjs` 里 core-not-import-services 的 from.path 改窄。
    // 定位方式与探针不同——这里读的是**被测守卫读的那份配置**，按 name 行往下找第一个 from 行。
    const cruiseSrc = fs.readFileSync(path.join(ROOT, '.dependency-cruiser.cjs'), 'utf8')
    const lines = cruiseSrc.split('\n')
    const nameIdx = lines.findIndex((l) => l.includes("name: 'core-not-import-services'"))
    expect(nameIdx).toBeGreaterThan(-1)
    let fromIdx = -1
    for (let i = nameIdx; i < Math.min(nameIdx + 8, lines.length); i++) {
      if (lines[i].includes('from: {')) {
        fromIdx = i
        break
      }
    }
    expect(fromIdx).toBeGreaterThan(-1)
    // prettier 已把 from 展开成多行（`from: {` 独占一行，path/pathNot 各占一行）。
    // 整块替换成单行窄口径：改 from 行 + 删掉紧随的 path 行与 pathNot 行。
    const indent = lines[fromIdx].match(/^\s*/)[0]
    lines[fromIdx] = `${indent}from: { path: '^frontend/src/core/map/' },`
    // 把 from 块内**所有续行**删到收尾 `},`：from: { / path / (注释) / pathNot / },
    // 行数取决于 prettier 何时把对象展开，所以按「见到收尾行」收口，不写死条数。
    let removed = 0
    while (fromIdx + 1 < lines.length) {
      if (lines[fromIdx + 1].trim() === '},') {
        lines.splice(fromIdx + 1, 1)
        removed += 1
        break
      }
      lines.splice(fromIdx + 1, 1)
      removed += 1
      if (removed > 8) break // 兜底：形状异常时别把整份配置吃空
    }
    expect(removed).toBeGreaterThan(1)
    const mutated = lines.join('\n')
    expect(mutated).not.toBe(cruiseSrc) // 变异必须真的发生
    expect(mutated).toContain("from: { path: '^frontend/src/core/map/' },")
    // 变异件必须仍是合法 JS：require 得起来，否则红的是语法错不是判据。
    // 用 `new Function` 编译（不执行）即可验语法；顶层 await 不会出现，安全。
    expect(
      () => new Function(mutated.replace('module.exports =', 'globalThis.__cruise ='))
    ).not.toThrow()
    // 守卫 main 用 createRequire(import.meta.url) 按**守卫文件位置**解析
    // path.join(ROOT, CRUISE_CONFIG)，而 ROOT = <tmp>/tools/v3-guard 的上两级 = <tmp>；
    // 但 createRequire 的基准是守卫文件自身 ⇒ 相对路径解析到 <tmp>/tools/v3-guard/。
    // 两处都写，任何一处解析策略变化都不至于让红变成「加载失败」。
    fs.writeFileSync(path.join(tmp, '.dependency-cruiser.cjs'), mutated)
    fs.writeFileSync(path.join(tmp, 'tools/v3-guard/.dependency-cruiser.cjs'), mutated)
    let code = 0
    let output = ''
    try {
      output = execFileSync('node', [path.join(tmp, 'tools/v3-guard/cruise-coverage.mjs')], {
        cwd: tmp,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (err) {
      code = err.status ?? -1
      output = `${err.stdout ?? ''}${err.stderr ?? ''}`
    }
    fs.rmSync(tmp, { recursive: true, force: true })
    expect(code).toBe(1)
    expect(output).toContain('core-not-import-services')
    expect(output).toContain('未覆盖整层')
  })
})

/**
 * z185：`@backend/*` 是 2026-10-27 引入的跨端源码别名（前端直接引后端源码）。
 * `tsconfig.cruise.json` 是**架构图**的 tsConfig——它的 paths 若缺这条别名，
 * dependency-cruiser 会把该 specifier 静默丢弃（既不建边，也不进 couldNotResolve），
 * 于是 `npm run cruise` 对这条跨端边、以及任何 `to: '^backend/'` 规则永久零判据。
 *
 * 判据只读图的语义（解析到的 resolved 路径 + 依赖 specifier），不读源码文本、
 * 也不比对 tsconfig 的字面写法：`backend/src/*` 与 `./backend/src/*`、key 顺序不同
 * 都是等价配置，必须照常命中——否则会逼人守住某一种写法。
 */
describe('tsconfig.cruise.json：@backend 跨端别名必须让依赖进图（z185）', () => {
  const TASK_TS = 'frontend/src/types/task.ts'
  const BACKEND_TASK_TYPES = 'backend/src/modules/task/types/task.ts'
  // 从模块解析器取主仓已安装包：guard:mutation 在无 node_modules 的 worktree 副本里跑本测试。
  const DEPCRUISE_ENTRY = fileURLToPath(import.meta.resolve('dependency-cruiser'))
  const DEPCRUISE_ROOT = path.resolve(path.dirname(DEPCRUISE_ENTRY), '../..')
  const DEPCRUISE_PKG = JSON.parse(
    fs.readFileSync(path.join(DEPCRUISE_ROOT, 'package.json'), 'utf8')
  )
  const DEPCRUISE_BIN = path.join(DEPCRUISE_ROOT, DEPCRUISE_PKG.bin['dependency-cruiser'])

  /** 与 `npm run cruise` 同一个二进制、同一份 .dependency-cruiser.cjs，只换 tsConfig。 */
  function cruiseDeps(cruiseConfig) {
    const stdout = execFileSync(
      process.execPath,
      [DEPCRUISE_BIN, '-c', cruiseConfig, '-T', 'json', TASK_TS],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
    const graph = JSON.parse(stdout)
    const mod = graph.modules.find((m) => m.source === TASK_TS)
    expect(mod, `cruise 图里没有 ${TASK_TS}（includeOnly/exclude 变了？）`).toBeTruthy()
    return mod.dependencies
  }

  function backendEdges(deps) {
    return deps.filter(
      (d) => d.resolved === BACKEND_TASK_TYPES && String(d.module).startsWith('@backend/')
    )
  }

  /**
   * 以**受版本控制的那份** tsconfig.cruise.json 为底稿派生变体（不手抄一份别名表），
   * 只把 baseUrl/include 换成绝对路径，好让变体落在 os.tmpdir() 里仍解析到本仓。
   */
  function variant(mutate) {
    const tracked = JSON.parse(fs.readFileSync(path.join(ROOT, 'tsconfig.cruise.json'), 'utf8'))
    const next = mutate(tracked)
    const baseUrl = ROOT.split(path.sep).join('/')
    next.compilerOptions.baseUrl = baseUrl
    next.include = next.include.map((p) => `${baseUrl}/${p}`)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'z185-cruise-'))
    const tsconfig = path.join(dir, 'tsconfig.variant.json')
    fs.writeFileSync(tsconfig, JSON.stringify(next, null, 2))
    const config = path.join(dir, 'cruise.config.cjs')
    fs.writeFileSync(
      config,
      `const base = require(${JSON.stringify(path.join(ROOT, '.dependency-cruiser.cjs'))})\n` +
        'module.exports = { forbidden: base.forbidden, options: { ...base.options, ' +
        `tsConfig: { fileName: ${JSON.stringify(tsconfig)} } } }\n`
    )
    return { config, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) }
  }

  it('真实配置：task.ts 对 backend task types 的依赖在图里可见且已解析', () => {
    const deps = cruiseDeps(path.join(ROOT, '.dependency-cruiser.cjs'))
    const edges = backendEdges(deps)
    expect(
      edges.length,
      `tsconfig.cruise.json 的 paths 缺 "@backend/*" ⇒ 该边被静默丢弃（实测 deps=${deps.length}）`
    ).toBeGreaterThan(0)
    expect(edges.every((d) => d.couldNotResolve !== true)).toBe(true)
  })

  it('等价写法（./ 前缀 + key 顺序不同）⇒ 照常命中，不误红', () => {
    const { config, cleanup } = variant((ts) => {
      const paths = ts.compilerOptions.paths
      ts.compilerOptions.paths = { '@backend/*': ['./backend/src/*'], '@/*': paths['@/*'] }
      return ts
    })
    try {
      expect(backendEdges(cruiseDeps(config)).length).toBeGreaterThan(0)
    } finally {
      cleanup()
    }
  })

  it('阳性对照：临时移除别名 ⇒ 该边从图里消失（判据不是"配置里有这行"）', () => {
    const { config, cleanup } = variant((ts) => {
      delete ts.compilerOptions.paths['@backend/*']
      return ts
    })
    try {
      expect(backendEdges(cruiseDeps(config))).toEqual([])
    } finally {
      cleanup()
    }
  })
})

describe('cruise-coverage：backend feature 规则域', () => {
  const NEST_OK = {
    forbidden: [
      {
        name: 'nest-cross-feature-auth',
        from: { path: '^backend/src/modules/auth/' },
        to: { path: '^backend/src/modules/' },
      },
      {
        name: 'nest-cross-feature-task',
        from: { path: '^backend/src/modules/task/' },
        to: { path: '^backend/src/modules/' },
      },
    ],
  }

  it('域与规则一一对应时无问题', () => {
    const { problems, domains } = auditNestFeatureCoverage(NEST_OK, ['auth', 'task'], [])
    expect(problems).toEqual([])
    expect(domains).toEqual(['auth', 'task'])
  })

  it('🔴 @guard-red-sample 新增 feature 未建规则必红（目录多一个）', () => {
    const { problems } = auditNestFeatureCoverage(NEST_OK, ['auth', 'task', 'billing'], [])
    expect(problems.some((p) => p.includes('backend feature billing 无 cross-feature 规则'))).toBe(
      true
    )
  })

  it('阳性对照：规则指向不存在的 feature 必红（幽灵规则）', () => {
    const { problems } = auditNestFeatureCoverage(NEST_OK, ['auth'], [])
    expect(problems.some((p) => p.includes('幽灵规则'))).toBe(true)
  })

  it('规则名与 from 路径不一致时抛错（命名约定被破坏）', () => {
    const bad = {
      forbidden: [
        { name: 'nest-cross-feature-flood', from: { path: '^backend/src/modules/auth/' } },
      ],
    }
    expect(() => parseNestFeatureRules(bad)).toThrow(/命名约定/)
  })

  it('scoped 规则数量与豁免源文件分组不一致必红', () => {
    const withScoped = {
      forbidden: [
        ...NEST_OK.forbidden,
        {
          name: 'nest-cross-feature-scoped-auth-1',
          from: { path: '^backend/src/modules/auth/a.ts$' },
          to: { path: '^backend/src/modules/' },
        },
      ],
    }
    const { problems } = auditNestFeatureCoverage(withScoped, ['auth', 'task'], [])
    expect(problems.some((p) => p.includes('scoped 规则 1 条 ≠ 豁免源文件分组 0 组'))).toBe(true)
  })

  it('🔴 @guard-red-sample 豁免过期：删掉被豁免的 import 后必红', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-exempt-'))
    try {
      const aDir = path.join(dir, 'backend/src/modules/a/services')
      const bDir = path.join(dir, 'backend/src/modules/b/services')
      fs.mkdirSync(aDir, { recursive: true })
      fs.mkdirSync(bDir, { recursive: true })
      fs.writeFileSync(path.join(bDir, 'b.service.ts'), 'export const b = 1\n')
      const aFile = path.join(aDir, 'a.ts')
      const entry = {
        id: 'demo',
        reason: '演示用',
        from: 'backend/src/modules/a/services/a.ts',
        to: 'backend/src/modules/b/services/b.service.ts',
      }
      const write = (body) => fs.writeFileSync(aFile, body)
      write("import { b } from '../../b/services/b.service'\nexport const a = b\n")
      expect(auditExemptionLiveness([entry], dir)).toEqual([])
      // 变异：import 被删掉，条目还在 ⇒ 必须红（防过期豁免）
      write('export const a = 1\n')
      expect(auditExemptionLiveness([entry], dir).join('\n')).toContain('已过期')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('豁免条目缺理由/缺目标必红（理由不是可选装饰）', () => {
    const problems = auditExemptionLiveness(
      [{ id: 'x', from: 'backend/src/modules/a/a.ts', to: 'backend/src/modules/b/b.ts' }],
      ROOT
    )
    expect(problems.some((p) => p.includes('缺 from / to / reason'))).toBe(true)
  })
})
