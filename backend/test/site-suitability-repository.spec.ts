// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { SiteSuitabilityRepository } from '../src/modules/site-suitability/repositories/site-suitability.repository'

function repoWithSqlCapture() {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const repo = new SiteSuitabilityRepository({ query } as never)
  return { repo, query }
}

describe('site-suitability repository 确定定序', () => {
  it('🔴 全分辨率分支有最终 ORDER BY id', async () => {
    const { repo, query } = repoWithSqlCapture()
    await repo.fetchCellsAt(0.5, 0)
    expect(query.mock.calls[0][0]).toMatch(/ORDER BY id\s*$/m)
  })

  it('🔴 聚合分支有最终 ORDER BY id', async () => {
    const { repo, query } = repoWithSqlCapture()
    await repo.fetchCellsAt(0.5, 0.02)
    expect(query.mock.calls[0][0]).toMatch(/GROUP BY[\s\S]*ORDER BY id\s*$/m)
  })
})
