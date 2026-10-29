import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'postcss'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../..')

function readCss(rel: string): string {
  return readFileSync(resolve(SRC, rel), 'utf8')
}

function sfcStyle(rel: string): string {
  const style = readCss(rel).match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1]
  if (!style) throw new Error(`${rel} 没有 style 块`)
  return style
}

function declarations(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  parse(css).walkRules((rule) => {
    if (rule.selector !== selector) return
    rule.walkDecls((decl) => {
      out[decl.prop] = decl.value.trim()
    })
  })
  return out
}

describe('阴影与反色边走主题 token', () => {
  it('气泡阴影使用 --GCS-shadow-sm', () => {
    const decl = declarations(readCss('core/map/components/bubble.css'), '.map-bubble')
    expect(decl['box-shadow']).toBe('var(--GCS-shadow-sm)')
  })

  it('滑块拇指边框/阴影使用主题 token（亮暗自动换值）', () => {
    const css = sfcStyle('shared/components/SliderSelectCard.vue')
    for (const selector of ['.ssc-slider::-webkit-slider-thumb', '.ssc-slider::-moz-range-thumb']) {
      const decl = declarations(css, selector)
      expect(decl.border, selector).toBe('2px solid var(--GCS-bg-panel)')
      expect(decl['box-shadow'], selector).toBe('var(--GCS-shadow-sm)')
    }
  })
})
