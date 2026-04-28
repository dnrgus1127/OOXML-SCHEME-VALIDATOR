import { describe, expect, it } from 'vitest'
import { getEditorThemeCssVars } from './editorTheme'

describe('getEditorThemeCssVars', () => {
  it('includes legacy home screen tokens so the renewed home screen follows editor theme', () => {
    const cssVars = getEditorThemeCssVars('github-light')

    expect(cssVars['--bg-0']).toBe('#f6f8fa')
    expect(cssVars['--bg-1']).toBe('#ffffff')
    expect(cssVars['--line']).toBe('#d0d7de')
    expect(cssVars['--text-0']).toBe('#1f2328')
    expect(cssVars['--text-2']).toBe('#57606a')
    expect(cssVars['--accent']).toBe('#0969da')
    expect(cssVars['--accent-soft']).toBe('rgba(9, 105, 218, 0.14)')
  })
})
