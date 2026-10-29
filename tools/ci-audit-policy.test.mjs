/**
 * CI 依赖审计策略的判据（z179）。
 *
 * 为什么需要：审计门禁只在 CI 的 audit job 里执行，本地 `ci:local` 与 pre-push 都
 * 不跑 npm audit（网络/registry 依赖会造成假红）。若 CI YAML 被改成
 * `--audit-level=none` 或把 high 报告改成阻断，没有任何测试会知道。
 * 本文件只读 policy 文本，不跑网络审计。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CI = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')

describe('CI audit 分级策略', () => {
  it('生产依赖保持 high+ 阻断', () => {
    expect(CI).toMatch(
      /- name: npm audit \(root, 生产依赖 high\+ 阻断\)\s*\n\s*run: npm audit --omit=dev --audit-level=high/
    )
  })

  it('开发依赖 critical 阻断，high 仅报告（不得改成阻断或忽略）', () => {
    expect(CI).toMatch(
      /- name: npm audit \(root, dev critical 阻断 \/ high 报告\)\s*\n\s*run: \|\s*\n\s*npm audit --audit-level=critical\s*\n\s*echo "--- dev high 报告（不阻断）---"\s*\n\s*npm audit --audit-level=high \|\| true/
    )
  })

  it('backend 保留 high+ 阻断（与生产依赖同口径）', () => {
    expect(CI).toMatch(
      /- name: npm audit \(nest, high\+ 阻断\)\s*\n\s*working-directory: backend\s*\n\s*run: npm audit --audit-level=high/
    )
  })

  it('🟥 红样：忽略 critical 门槛 ⇒ 本判据必红', () => {
    const mutated = CI.replace('npm audit --audit-level=critical', 'npm audit --audit-level=none')
    expect(mutated).not.toBe(CI)
    expect(mutated).not.toMatch(
      /npm audit --audit-level=critical\s*\n\s*echo "--- dev high 报告（不阻断）---"/
    )
  })

  it('发布门禁：deploy needs 必须包含 e2e（真实任务 flow 阻断发布）', () => {
    expect(CI).toMatch(/deploy:\s*\n\s*needs: \[[^\]]*\be2e\b[^\]]*\]/)
  })

  it('🟥 红样：从 deploy needs 摘掉 e2e ⇒ 本判据必红', () => {
    const mutated = CI.replace(
      'needs: [audit, build-push-images, e2e]',
      'needs: [audit, build-push-images]'
    )
    expect(mutated).not.toBe(CI)
    expect(mutated).not.toMatch(/deploy:\s*\n\s*needs: \[[^\]]*\be2e\b[^\]]*\]/)
  })
})
