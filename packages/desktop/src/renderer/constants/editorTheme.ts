export type EditorThemeId =
  | 'vs-dark'
  | 'vs'
  | 'hc-black'
  | 'hc-light'
  | 'one-dark-pro'
  | 'github-dark'
  | 'github-light'
  | 'dracula'
  | 'tokyo-night'
  | 'nord'
  | 'darcula'
  | 'intellij-light'

type MonacoBuiltinTheme = 'vs-dark' | 'vs' | 'hc-black' | 'hc-light'

interface ThemePreviewPalette {
  background: string
  gutter: string
  accent: string
  line: string
  soft: string
  border: string
}

interface AppThemePalette {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgHover: string
  bgSelected: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  borderColor: string
  accent: string
  success: string
  error: string
  warning: string
  editorSurface: string
  editorBadgeBackground: string
  editorBadgeBorder: string
  editorBadgeText: string
  preview: ThemePreviewPalette
}

interface MonacoThemeDefinition {
  base: MonacoBuiltinTheme
  inherit: boolean
  rules: Array<{
    token: string
    foreground?: string
    background?: string
    fontStyle?: string
  }>
  colors: Record<string, string>
}

export interface EditorThemeOption {
  id: EditorThemeId
  label: string
  family: 'Built-in' | 'VS Code' | 'JetBrains'
  description: string
  app: AppThemePalette
  monaco?: MonacoThemeDefinition
}

function createXmlRules(colors: {
  comment: string
  tag: string
  attribute: string
  string: string
  number: string
  keyword: string
  delimiter: string
}) {
  return [
    { token: 'comment', foreground: colors.comment, fontStyle: 'italic' },
    { token: 'tag', foreground: colors.tag },
    { token: 'tag.name', foreground: colors.tag },
    { token: 'delimiter', foreground: colors.delimiter },
    { token: 'delimiter.angle', foreground: colors.delimiter },
    { token: 'attribute.name', foreground: colors.attribute },
    { token: 'attribute.value', foreground: colors.string },
    { token: 'string', foreground: colors.string },
    { token: 'number', foreground: colors.number },
    { token: 'keyword', foreground: colors.keyword },
    { token: 'metatag', foreground: colors.keyword },
    { token: 'metatag.content', foreground: colors.string },
  ]
}

const editorThemeRegistry: Record<EditorThemeId, EditorThemeOption> = {
  'vs-dark': {
    id: 'vs-dark',
    label: 'Monaco Dark',
    family: 'Built-in',
    description: 'Monaco 기본 다크 테마입니다.',
    app: {
      bgPrimary: '#1e1e1e',
      bgSecondary: '#252526',
      bgTertiary: '#2d2d2d',
      bgHover: '#3c3c3c',
      bgSelected: '#094771',
      textPrimary: '#cccccc',
      textSecondary: '#858585',
      textMuted: '#6e6e6e',
      borderColor: '#3c3c3c',
      accent: '#0078d4',
      success: '#4ec9b0',
      error: '#f14c4c',
      warning: '#dcdcaa',
      editorSurface: '#1e1e1e',
      editorBadgeBackground: '#2d2d2d',
      editorBadgeBorder: '#3c3c3c',
      editorBadgeText: '#cccccc',
      preview: {
        background: '#1e1e1e',
        gutter: '#2d2d30',
        accent: '#4fc1ff',
        line: '#d4d4d4',
        soft: '#ce9178',
        border: '#3c3c3c',
      },
    },
  },
  vs: {
    id: 'vs',
    label: 'Monaco Light',
    family: 'Built-in',
    description: 'Monaco 기본 라이트 테마입니다.',
    app: {
      bgPrimary: '#f5f7fb',
      bgSecondary: '#ffffff',
      bgTertiary: '#eef2f7',
      bgHover: '#e3eaf5',
      bgSelected: '#dbeafe',
      textPrimary: '#172033',
      textSecondary: '#52607a',
      textMuted: '#7d889d',
      borderColor: '#d7dfeb',
      accent: '#0b57d0',
      success: '#117a65',
      error: '#c62828',
      warning: '#8a6a00',
      editorSurface: '#ffffff',
      editorBadgeBackground: '#ffffff',
      editorBadgeBorder: '#cfd7e3',
      editorBadgeText: '#3f4a5a',
      preview: {
        background: '#ffffff',
        gutter: '#f3f4f6',
        accent: '#0451a5',
        line: '#333333',
        soft: '#a31515',
        border: '#d9dfe8',
      },
    },
  },
  'hc-black': {
    id: 'hc-black',
    label: 'Monaco High Contrast Dark',
    family: 'Built-in',
    description: 'Monaco 기본 고대비 다크 테마입니다.',
    app: {
      bgPrimary: '#000000',
      bgSecondary: '#0a0a0a',
      bgTertiary: '#111111',
      bgHover: '#1c1c1c',
      bgSelected: '#1a1a1a',
      textPrimary: '#ffffff',
      textSecondary: '#f2f2f2',
      textMuted: '#cccccc',
      borderColor: '#ffffff',
      accent: '#ffff00',
      success: '#00ff00',
      error: '#ff5f5f',
      warning: '#ffd84d',
      editorSurface: '#000000',
      editorBadgeBackground: '#000000',
      editorBadgeBorder: '#ffffff',
      editorBadgeText: '#ffffff',
      preview: {
        background: '#000000',
        gutter: '#1a1a1a',
        accent: '#ffff00',
        line: '#ffffff',
        soft: '#00ff00',
        border: '#ffffff',
      },
    },
  },
  'hc-light': {
    id: 'hc-light',
    label: 'Monaco High Contrast Light',
    family: 'Built-in',
    description: 'Monaco 기본 고대비 라이트 테마입니다.',
    app: {
      bgPrimary: '#ffffff',
      bgSecondary: '#ffffff',
      bgTertiary: '#f3f3f3',
      bgHover: '#e7eefc',
      bgSelected: '#dce8ff',
      textPrimary: '#000000',
      textSecondary: '#222222',
      textMuted: '#4d4d4d',
      borderColor: '#1f1f1f',
      accent: '#005fcc',
      success: '#007a00',
      error: '#b00020',
      warning: '#7a5600',
      editorSurface: '#ffffff',
      editorBadgeBackground: '#ffffff',
      editorBadgeBorder: '#1f1f1f',
      editorBadgeText: '#000000',
      preview: {
        background: '#ffffff',
        gutter: '#ececec',
        accent: '#0b57d0',
        line: '#000000',
        soft: '#7a1fa2',
        border: '#1f1f1f',
      },
    },
  },
  'one-dark-pro': {
    id: 'one-dark-pro',
    label: 'One Dark Pro',
    family: 'VS Code',
    description: 'Atom One Dark 계열의 대표적인 VS Code 테마입니다.',
    app: {
      bgPrimary: '#21252b',
      bgSecondary: '#282c34',
      bgTertiary: '#2f3440',
      bgHover: '#343b46',
      bgSelected: '#33415c',
      textPrimary: '#abb2bf',
      textSecondary: '#7f848e',
      textMuted: '#5c6370',
      borderColor: '#353b45',
      accent: '#61afef',
      success: '#98c379',
      error: '#e06c75',
      warning: '#e5c07b',
      editorSurface: '#282c34',
      editorBadgeBackground: '#2f3440',
      editorBadgeBorder: '#3a414d',
      editorBadgeText: '#abb2bf',
      preview: {
        background: '#282c34',
        gutter: '#21252b',
        accent: '#61afef',
        line: '#abb2bf',
        soft: '#c678dd',
        border: '#3a414d',
      },
    },
    monaco: {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#282c34',
        'editor.foreground': '#abb2bf',
        'editorLineNumber.foreground': '#5c6370',
        'editorLineNumber.activeForeground': '#abb2bf',
        'editorCursor.foreground': '#528bff',
        'editor.selectionBackground': '#3e4451',
        'editor.inactiveSelectionBackground': '#3a3f4b',
        'editor.lineHighlightBackground': '#2c313c',
        'editorGutter.background': '#282c34',
      },
      rules: createXmlRules({
        comment: '5c6370',
        tag: 'e06c75',
        attribute: 'd19a66',
        string: '98c379',
        number: 'd19a66',
        keyword: 'c678dd',
        delimiter: 'abb2bf',
      }),
    },
  },
  'github-dark': {
    id: 'github-dark',
    label: 'GitHub Dark',
    family: 'VS Code',
    description: 'GitHub Primer 기반의 차분한 다크 테마입니다.',
    app: {
      bgPrimary: '#0d1117',
      bgSecondary: '#161b22',
      bgTertiary: '#21262d',
      bgHover: '#30363d',
      bgSelected: '#1f2937',
      textPrimary: '#c9d1d9',
      textSecondary: '#8b949e',
      textMuted: '#6e7681',
      borderColor: '#30363d',
      accent: '#58a6ff',
      success: '#3fb950',
      error: '#f85149',
      warning: '#d29922',
      editorSurface: '#0d1117',
      editorBadgeBackground: '#161b22',
      editorBadgeBorder: '#30363d',
      editorBadgeText: '#c9d1d9',
      preview: {
        background: '#0d1117',
        gutter: '#161b22',
        accent: '#79c0ff',
        line: '#c9d1d9',
        soft: '#a371f7',
        border: '#30363d',
      },
    },
    monaco: {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#c9d1d9',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#c9d1d9',
        'editorCursor.foreground': '#58a6ff',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#1f2937',
        'editor.lineHighlightBackground': '#161b22',
        'editorGutter.background': '#0d1117',
      },
      rules: createXmlRules({
        comment: '8b949e',
        tag: 'ff7b72',
        attribute: 'd2a8ff',
        string: '7ee787',
        number: '79c0ff',
        keyword: 'ffa657',
        delimiter: 'c9d1d9',
      }),
    },
  },
  'github-light': {
    id: 'github-light',
    label: 'GitHub Light',
    family: 'VS Code',
    description: 'GitHub Primer 기반의 선명한 라이트 테마입니다.',
    app: {
      bgPrimary: '#f6f8fa',
      bgSecondary: '#ffffff',
      bgTertiary: '#f3f4f6',
      bgHover: '#eef2f7',
      bgSelected: '#dbeafe',
      textPrimary: '#1f2328',
      textSecondary: '#57606a',
      textMuted: '#6e7781',
      borderColor: '#d0d7de',
      accent: '#0969da',
      success: '#1a7f37',
      error: '#cf222e',
      warning: '#9a6700',
      editorSurface: '#ffffff',
      editorBadgeBackground: '#ffffff',
      editorBadgeBorder: '#d0d7de',
      editorBadgeText: '#1f2328',
      preview: {
        background: '#ffffff',
        gutter: '#f6f8fa',
        accent: '#0969da',
        line: '#1f2328',
        soft: '#8250df',
        border: '#d0d7de',
      },
    },
    monaco: {
      base: 'vs',
      inherit: true,
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1f2328',
        'editorLineNumber.foreground': '#6e7781',
        'editorLineNumber.activeForeground': '#1f2328',
        'editorCursor.foreground': '#0969da',
        'editor.selectionBackground': '#b6d7ff',
        'editor.inactiveSelectionBackground': '#ddf4ff',
        'editor.lineHighlightBackground': '#f6f8fa',
        'editorGutter.background': '#ffffff',
      },
      rules: createXmlRules({
        comment: '6e7781',
        tag: 'cf222e',
        attribute: '8250df',
        string: '0a3069',
        number: '0550ae',
        keyword: 'cf222e',
        delimiter: '1f2328',
      }),
    },
  },
  dracula: {
    id: 'dracula',
    label: 'Dracula',
    family: 'VS Code',
    description: 'Dracula 공식 컬러 스킴 기반의 강한 대비 다크 테마입니다.',
    app: {
      bgPrimary: '#21222c',
      bgSecondary: '#282a36',
      bgTertiary: '#303341',
      bgHover: '#3a3d4d',
      bgSelected: '#44475a',
      textPrimary: '#f8f8f2',
      textSecondary: '#bdc0d1',
      textMuted: '#6272a4',
      borderColor: '#44475a',
      accent: '#bd93f9',
      success: '#50fa7b',
      error: '#ff5555',
      warning: '#f1fa8c',
      editorSurface: '#282a36',
      editorBadgeBackground: '#303341',
      editorBadgeBorder: '#44475a',
      editorBadgeText: '#f8f8f2',
      preview: {
        background: '#282a36',
        gutter: '#21222c',
        accent: '#ff79c6',
        line: '#f8f8f2',
        soft: '#8be9fd',
        border: '#44475a',
      },
    },
    monaco: {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editorLineNumber.foreground': '#6272a4',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'editorCursor.foreground': '#f8f8f0',
        'editor.selectionBackground': '#44475a',
        'editor.inactiveSelectionBackground': '#3a3d4d',
        'editor.lineHighlightBackground': '#2f3140',
        'editorGutter.background': '#282a36',
      },
      rules: createXmlRules({
        comment: '6272a4',
        tag: 'ff79c6',
        attribute: '8be9fd',
        string: 'f1fa8c',
        number: 'bd93f9',
        keyword: 'ff79c6',
        delimiter: 'f8f8f2',
      }),
    },
  },
  'tokyo-night': {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    family: 'VS Code',
    description: 'Tokyo Night 공식 VS Code 포트 기반의 선명한 야간 테마입니다.',
    app: {
      bgPrimary: '#16161e',
      bgSecondary: '#1a1b26',
      bgTertiary: '#24283b',
      bgHover: '#2a2f45',
      bgSelected: '#2e3c64',
      textPrimary: '#c0caf5',
      textSecondary: '#9aa5ce',
      textMuted: '#565f89',
      borderColor: '#2f3549',
      accent: '#7aa2f7',
      success: '#9ece6a',
      error: '#f7768e',
      warning: '#e0af68',
      editorSurface: '#1a1b26',
      editorBadgeBackground: '#24283b',
      editorBadgeBorder: '#2f3549',
      editorBadgeText: '#c0caf5',
      preview: {
        background: '#1a1b26',
        gutter: '#16161e',
        accent: '#7aa2f7',
        line: '#c0caf5',
        soft: '#bb9af7',
        border: '#2f3549',
      },
    },
    monaco: {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#1a1b26',
        'editor.foreground': '#c0caf5',
        'editorLineNumber.foreground': '#565f89',
        'editorLineNumber.activeForeground': '#c0caf5',
        'editorCursor.foreground': '#c0caf5',
        'editor.selectionBackground': '#33467c',
        'editor.inactiveSelectionBackground': '#283457',
        'editor.lineHighlightBackground': '#1f2335',
        'editorGutter.background': '#1a1b26',
      },
      rules: createXmlRules({
        comment: '565f89',
        tag: '7aa2f7',
        attribute: 'bb9af7',
        string: '9ece6a',
        number: 'ff9e64',
        keyword: 'f7768e',
        delimiter: 'c0caf5',
      }),
    },
  },
  nord: {
    id: 'nord',
    label: 'Nord',
    family: 'VS Code',
    description: 'Nord 공식 VS Code 테마 기반의 북유럽 톤 다크 테마입니다.',
    app: {
      bgPrimary: '#242933',
      bgSecondary: '#2e3440',
      bgTertiary: '#3b4252',
      bgHover: '#434c5e',
      bgSelected: '#4c566a',
      textPrimary: '#d8dee9',
      textSecondary: '#b8c0d0',
      textMuted: '#81a1c1',
      borderColor: '#434c5e',
      accent: '#88c0d0',
      success: '#a3be8c',
      error: '#bf616a',
      warning: '#ebcb8b',
      editorSurface: '#2e3440',
      editorBadgeBackground: '#3b4252',
      editorBadgeBorder: '#4c566a',
      editorBadgeText: '#d8dee9',
      preview: {
        background: '#2e3440',
        gutter: '#242933',
        accent: '#88c0d0',
        line: '#d8dee9',
        soft: '#b48ead',
        border: '#4c566a',
      },
    },
    monaco: {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#2e3440',
        'editor.foreground': '#d8dee9',
        'editorLineNumber.foreground': '#616e88',
        'editorLineNumber.activeForeground': '#d8dee9',
        'editorCursor.foreground': '#88c0d0',
        'editor.selectionBackground': '#434c5e',
        'editor.inactiveSelectionBackground': '#3b4252',
        'editor.lineHighlightBackground': '#323a48',
        'editorGutter.background': '#2e3440',
      },
      rules: createXmlRules({
        comment: '616e88',
        tag: '81a1c1',
        attribute: 'b48ead',
        string: 'a3be8c',
        number: 'd08770',
        keyword: '88c0d0',
        delimiter: 'd8dee9',
      }),
    },
  },
  darcula: {
    id: 'darcula',
    label: 'Darcula',
    family: 'JetBrains',
    description: 'JetBrains IDE 기본 Darcula 분위기를 반영한 테마입니다.',
    app: {
      bgPrimary: '#252526',
      bgSecondary: '#2b2b2b',
      bgTertiary: '#313335',
      bgHover: '#3c3f41',
      bgSelected: '#214283',
      textPrimary: '#a9b7c6',
      textSecondary: '#808080',
      textMuted: '#6c7072',
      borderColor: '#3c3f41',
      accent: '#4a88c7',
      success: '#629755',
      error: '#bc3f3c',
      warning: '#bbb529',
      editorSurface: '#2b2b2b',
      editorBadgeBackground: '#313335',
      editorBadgeBorder: '#3c3f41',
      editorBadgeText: '#a9b7c6',
      preview: {
        background: '#2b2b2b',
        gutter: '#252526',
        accent: '#4a88c7',
        line: '#a9b7c6',
        soft: '#cc7832',
        border: '#3c3f41',
      },
    },
    monaco: {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#2b2b2b',
        'editor.foreground': '#a9b7c6',
        'editorLineNumber.foreground': '#606366',
        'editorLineNumber.activeForeground': '#a9b7c6',
        'editorCursor.foreground': '#a9b7c6',
        'editor.selectionBackground': '#214283',
        'editor.inactiveSelectionBackground': '#38404a',
        'editor.lineHighlightBackground': '#323232',
        'editorGutter.background': '#2b2b2b',
      },
      rules: createXmlRules({
        comment: '808080',
        tag: 'e8bf6a',
        attribute: 'bababa',
        string: '6a8759',
        number: '6897bb',
        keyword: 'cc7832',
        delimiter: 'a9b7c6',
      }),
    },
  },
  'intellij-light': {
    id: 'intellij-light',
    label: 'IntelliJ Light',
    family: 'JetBrains',
    description: 'JetBrains IntelliJ Light 계열의 밝은 편집 경험을 반영한 테마입니다.',
    app: {
      bgPrimary: '#f7f9fc',
      bgSecondary: '#ffffff',
      bgTertiary: '#eef2f7',
      bgHover: '#e7edf5',
      bgSelected: '#dbe9ff',
      textPrimary: '#1f2329',
      textSecondary: '#5f6b7c',
      textMuted: '#7a8699',
      borderColor: '#d5dbe5',
      accent: '#3574f0',
      success: '#5f8c2f',
      error: '#cf5b56',
      warning: '#8a6d1d',
      editorSurface: '#ffffff',
      editorBadgeBackground: '#ffffff',
      editorBadgeBorder: '#d5dbe5',
      editorBadgeText: '#1f2329',
      preview: {
        background: '#ffffff',
        gutter: '#f3f5f7',
        accent: '#3574f0',
        line: '#1f2329',
        soft: '#871094',
        border: '#d5dbe5',
      },
    },
    monaco: {
      base: 'vs',
      inherit: true,
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1f2329',
        'editorLineNumber.foreground': '#9aa3ad',
        'editorLineNumber.activeForeground': '#1f2329',
        'editorCursor.foreground': '#1f2329',
        'editor.selectionBackground': '#cfe1ff',
        'editor.inactiveSelectionBackground': '#e8f0ff',
        'editor.lineHighlightBackground': '#f5f8fe',
        'editorGutter.background': '#ffffff',
      },
      rules: createXmlRules({
        comment: '8c8c8c',
        tag: '0033b3',
        attribute: '871094',
        string: '067d17',
        number: '1750eb',
        keyword: '0033b3',
        delimiter: '1f2329',
      }),
    },
  },
}

export const editorThemeOptions = Object.values(editorThemeRegistry)

export function getEditorThemeLabel(themeId: EditorThemeId): string {
  return editorThemeRegistry[themeId]?.label ?? themeId
}

export function getEditorThemeOption(themeId: EditorThemeId): EditorThemeOption {
  return editorThemeRegistry[themeId] ?? editorThemeRegistry['vs-dark']
}

export function getEditorThemeCssVars(themeId: EditorThemeId): Record<string, string> {
  const theme = getEditorThemeOption(themeId)
  return {
    '--bg-primary': theme.app.bgPrimary,
    '--bg-secondary': theme.app.bgSecondary,
    '--bg-tertiary': theme.app.bgTertiary,
    '--bg-hover': theme.app.bgHover,
    '--bg-selected': theme.app.bgSelected,
    '--text-primary': theme.app.textPrimary,
    '--text-secondary': theme.app.textSecondary,
    '--text-muted': theme.app.textMuted,
    '--border-color': theme.app.borderColor,
    '--accent': theme.app.accent,
    '--success': theme.app.success,
    '--error': theme.app.error,
    '--warning': theme.app.warning,
    '--editor-surface': theme.app.editorSurface,
    '--editor-badge-bg': theme.app.editorBadgeBackground,
    '--editor-badge-border': theme.app.editorBadgeBorder,
    '--editor-badge-text': theme.app.editorBadgeText,
  }
}

export function getEditorThemePreviewVars(themeId: EditorThemeId): Record<string, string> {
  const { preview } = getEditorThemeOption(themeId).app
  return {
    '--editor-preview-bg': preview.background,
    '--editor-preview-gutter': preview.gutter,
    '--editor-preview-accent': preview.accent,
    '--editor-preview-line': preview.line,
    '--editor-preview-soft': preview.soft,
    '--editor-preview-border': preview.border,
  }
}

export function registerEditorThemes(monaco: {
  editor: {
    defineTheme: (themeName: string, themeData: MonacoThemeDefinition) => void
  }
}) {
  for (const theme of editorThemeOptions) {
    if (!theme.monaco) continue
    monaco.editor.defineTheme(theme.id, theme.monaco)
  }
}

