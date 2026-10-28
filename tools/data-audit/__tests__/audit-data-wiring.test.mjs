// @vitest-environment node
/**
 * `npm run audit:data` 的强制点接线（工单 W2-1）。
 *
 * 治的是本脚本接线前的真实状态：判据本体能跑、也能红，但**没有任何入口跑它**
 * （不在 `guard:v3` 的 GUARDS、不在 `package.json`、不在 CI、不在 husky），
 * 于是"从未运行"被误读成"一直绿"。
 *
 * 判据复用 `run-all.mjs` 的 `stepBlockOf` / `stepIfProblems`（z063/N2 的强制点自证）：
 * ① ci.yml 里必须有**可执行**的 `npm run audit:data` 步骤（注释与 echo 不算）；
 * ② 该步骤不得带 `if:` —— 条件不成立时它不跑，等于没挂强制点。
 * 新建第二套解析会与那两条判据分叉，故只调用、不重写。
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { stepBlockOf, stepIfProblems } from '../../v3-guard/run-all.mjs'

const CI = '.github/workflows/ci.yml'
const SCRIPT = 'audit:data'
const ciText = () => readFileSync(new URL(`../../../${CI}`, import.meta.url), 'utf8')

describe('audit:data 强制点接线', () => {
  it('@guard-red-sample 当前仓库：ci.yml 有可执行步骤且不带 if:', () => {
    const text = ciText()
    expect(stepBlockOf(text, SCRIPT), `${CI} 里找不到跑 npm run ${SCRIPT} 的步骤`).toBeTruthy()
    expect(stepIfProblems(text, SCRIPT, stepBlockOf)).toEqual([])
  })

  it('🔴 式 1 删字面：步骤被删（只剩注释里提到）⇒ 必须判为缺步骤', () => {
    // 只把命令行改成注释行：文件里仍"出现"这段字面量，但它不会被 shell 执行
    const stripped = ciText()
      .split(/\r?\n/)
      .map((l) => (l.includes(`npm run ${SCRIPT}`) ? `# ${l}` : l))
      .join('\n')
    expect(stepBlockOf(stripped, SCRIPT)).toBeNull()
  })

  it('🔴 式 2 停用：步骤被包进 if: 条件 ⇒ 必须报"等于没挂强制点"', () => {
    const lines = ciText().split(/\r?\n/)
    const at = lines.findIndex((l) => !l.trim().startsWith('#') && l.includes(`npm run ${SCRIPT}`))
    expect(at, '定位不到 audit:data 的 run 行，本红样失去对象').toBeGreaterThan(0)
    // 在该步骤块内插一行步骤级条件（缩进比 run: 深一档，形状同 ci.yml 已有的 if: 步骤）
    const indent = lines[at].match(/^ */)[0] + '  '
    const gated = [
      ...lines.slice(0, at),
      `${indent}if: \${{ github.event_name == 'x' }}`,
      ...lines.slice(at),
    ].join('\n')
    const problems = stepIfProblems(gated, SCRIPT, stepBlockOf)
    expect(problems.join(' ')).toContain('等于没挂强制点')
  })
})
