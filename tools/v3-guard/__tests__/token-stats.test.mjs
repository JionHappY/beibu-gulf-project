import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function runTokenStats() {
  const stdout = execFileSync(
    process.execPath,
    [resolve(ROOT, 'tools/token-stats.mjs'), '--json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  )
  return JSON.parse(stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1))
}

describe('token-stats 双主题集合差', () => {
  it('输出真实 root/dark 集合差，颜色族仅 root 为 0', () => {
    const report = runTokenStats()
    expect(report.rootCount).toBeGreaterThan(report.darkCount)
    expect(report.rootOnly.length).toBe(report.rootCount - report.darkCount)
    expect(report.rootOnly).toContain('--GCS-radius-sm')
    expect(report.colorRootOnly).toEqual([])
    expect(report.darkOnlyTokens).toEqual([])
  })
})
