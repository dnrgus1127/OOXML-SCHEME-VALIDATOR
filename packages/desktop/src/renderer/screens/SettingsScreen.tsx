import { useEffect, useMemo, useRef, useState } from 'react'
import {
  editorThemeOptions,
  getEditorThemeLabel,
  getEditorThemePreviewVars,
  type EditorThemeId,
} from '../constants/editorTheme'
import { useSettingsStore } from '../stores/settings'
import { normalizeShortcut } from '../utils/shortcuts'
import { getAllPlugins } from '../plugins'
import { MarkdownLite } from '../components/MarkdownLite'

interface SettingsScreenProps {
  onClose: () => void
}

type SettingsSection = 'general' | 'xml-editor' | 'batch-validator' | 'extensions'

interface ShortcutHelpItem {
  action: string
  shortcut: string
  isCustomizable?: boolean
}

function getPluginInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9가-힣]/g, ''))
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) {
    const w = words[0] ?? ''
    return w.slice(0, 2).toUpperCase()
  }
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase()
}

const PLUGIN_ACCENT_PALETTE: Array<{ gradient: string; fg: string }> = [
  { gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', fg: '#ffffff' },
  { gradient: 'linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)', fg: '#ffffff' },
  { gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', fg: '#ffffff' },
  { gradient: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)', fg: '#ffffff' },
  { gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)', fg: '#ffffff' },
]

function getPluginAccent(id: string): { gradient: string; fg: string } {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % PLUGIN_ACCENT_PALETTE.length
  return PLUGIN_ACCENT_PALETTE[idx] ?? PLUGIN_ACCENT_PALETTE[0]!
}

const xmlEditorShortcutHelp: ShortcutHelpItem[] = [
  {
    action: '현재 파일 재검증',
    shortcut: 'CmdOrCtrl+Shift+V (기본값)',
    isCustomizable: true,
  },
  {
    action: '명령 팔레트 열기',
    shortcut: 'F1 또는 Shift+CmdOrCtrl+P',
  },
  {
    action: '빠른 파일 찾기',
    shortcut: 'CmdOrCtrl+P',
  },
  {
    action: '현재 라인 이동',
    shortcut: 'CmdOrCtrl+G',
  },
  {
    action: '찾기 / 치환',
    shortcut: 'CmdOrCtrl+F / CmdOrCtrl+H',
  },
  {
    action: '접기 / 펼치기',
    shortcut: 'CmdOrCtrl+Shift+[ / CmdOrCtrl+Shift+]',
  },
]

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const {
    xmlEditor,
    previewEditorTheme,
    plugins,
    updateXmlEditorSettings,
    setPreviewEditorTheme,
    clearPreviewEditorTheme,
    updatePluginEnabled,
  } = useSettingsStore()
  const allPlugins = useMemo(() => getAllPlugins(), [])
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [shortcutInput, setShortcutInput] = useState(xmlEditor.revalidateShortcut)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)
  const [expandedPluginIds, setExpandedPluginIds] = useState<Set<string>>(new Set())
  const themeMenuRef = useRef<HTMLDivElement>(null)

  const togglePluginExpanded = (id: string) => {
    setExpandedPluginIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sections = useMemo(
    () => [
      { id: 'general' as const, label: '기본' },
      { id: 'xml-editor' as const, label: 'XML Editor' },
      { id: 'batch-validator' as const, label: 'Batch Validator' },
      { id: 'extensions' as const, label: 'Extensions' },
    ],
    []
  )

  useEffect(() => {
    setShortcutInput(xmlEditor.revalidateShortcut)
  }, [xmlEditor.revalidateShortcut])

  useEffect(() => {
    if (!isThemeMenuOpen) {
      clearPreviewEditorTheme()
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) {
        setIsThemeMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [clearPreviewEditorTheme, isThemeMenuOpen])

  const handleShortcutInputChange = (value: string) => {
    setShortcutInput(value)

    const normalized = normalizeShortcut(value)
    if (!normalized) {
      setShortcutError(
        '유효한 형식이 아닙니다. 예: CmdOrCtrl+Shift+V, CmdOrCtrl+R, Shift+F8'
      )
      return
    }

    setShortcutError(null)
    updateXmlEditorSettings({ revalidateShortcut: normalized })
  }

  const handleThemePreview = (themeId: EditorThemeId) => {
    setPreviewEditorTheme(themeId)
  }

  const handleThemeSelect = (themeId: EditorThemeId) => {
    updateXmlEditorSettings({ editorTheme: themeId })
    setPreviewEditorTheme(themeId)
    setIsThemeMenuOpen(false)
  }

  const displayedTheme = previewEditorTheme ?? xmlEditor.editorTheme

  return (
    <div
      className="settings-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <header className="settings-header">
        <h1 id="settings-title">Settings</h1>
        <button onClick={onClose} className="toolbar-btn">
          Close
        </button>
      </header>

      <div className="settings-layout">
        <aside className="settings-sidebar" aria-label="Settings sections">
          <nav className="settings-nav">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`settings-nav-item${activeSection === section.id ? ' active' : ''}`}
                onClick={() => setActiveSection(section.id)}
                aria-current={activeSection === section.id ? 'page' : undefined}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-content" aria-live="polite">
          {activeSection === 'general' && (
            <section className="settings-section" aria-labelledby="settings-general-title">
              <h2 id="settings-general-title">기본 설정</h2>
              <p className="settings-placeholder">
                기본 설정 항목은 추후 추가될 예정입니다.
              </p>
            </section>
          )}

          {activeSection === 'xml-editor' && (
            <section className="settings-section" aria-labelledby="settings-xml-editor-title">
              <h2 id="settings-xml-editor-title">XML Editor 설정</h2>

              <div className="settings-field-row">
                <label htmlFor="validate-on-open" className="settings-toggle-label">
                  <span>파일 오픈 시 즉시 검증</span>
                  <input
                    id="validate-on-open"
                    type="checkbox"
                    checked={xmlEditor.validateOnOpen}
                    onChange={(event) =>
                      updateXmlEditorSettings({ validateOnOpen: event.target.checked })
                    }
                  />
                </label>
                <p className="settings-help-text">
                  파일을 열자마자 문서 검증을 자동으로 실행합니다.
                </p>
              </div>

              <div className="settings-field-row">
                <div>
                  <h3 className="settings-subtitle">에디터 테마</h3>
                  <p className="settings-help-text">
                    Monaco Editor가 기본 제공하는 모든 테마를 드롭다운에서 선택할 수 있습니다.
                    항목에 마우스를 올리면 앱과 에디터에 즉시 미리보기 됩니다.
                  </p>
                </div>

                <div
                  className={`settings-select${isThemeMenuOpen ? ' is-open' : ''}`}
                  ref={themeMenuRef}
                  onMouseLeave={() => {
                    if (isThemeMenuOpen) {
                      clearPreviewEditorTheme()
                    }
                  }}
                >
                  <button
                    type="button"
                    className="settings-select-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={isThemeMenuOpen}
                    onClick={() => setIsThemeMenuOpen((open) => !open)}
                  >
                    <span className="settings-select-trigger-copy">
                      <span className="settings-select-label">현재 선택</span>
                      <span className="settings-select-value">
                        {getEditorThemeLabel(xmlEditor.editorTheme)}
                      </span>
                    </span>
                    <span
                      className="editor-theme-preview"
                      style={getEditorThemePreviewVars(displayedTheme)}
                      aria-hidden="true"
                    >
                      <span className="editor-theme-preview__gutter" />
                      <span className="editor-theme-preview__line editor-theme-preview__line--accent" />
                      <span className="editor-theme-preview__line" />
                      <span className="editor-theme-preview__line editor-theme-preview__line--soft" />
                    </span>
                  </button>

                  {isThemeMenuOpen && (
                    <div className="settings-select-menu" role="listbox" aria-label="Editor theme">
                      {editorThemeOptions.map((theme) => {
                        const selected = xmlEditor.editorTheme === theme.id

                        return (
                          <button
                            key={theme.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`settings-select-option${selected ? ' is-selected' : ''}`}
                            onMouseEnter={() => handleThemePreview(theme.id)}
                            onFocus={() => handleThemePreview(theme.id)}
                            onClick={() => handleThemeSelect(theme.id)}
                          >
                            <span
                              className="editor-theme-preview"
                              style={getEditorThemePreviewVars(theme.id)}
                              aria-hidden="true"
                            >
                              <span className="editor-theme-preview__gutter" />
                              <span className="editor-theme-preview__line editor-theme-preview__line--accent" />
                              <span className="editor-theme-preview__line" />
                              <span className="editor-theme-preview__line editor-theme-preview__line--soft" />
                            </span>
                            <span className="settings-option-copy">
                              <span className="settings-option-title">
                                {theme.label}
                                <span className="settings-option-family">{theme.family}</span>
                              </span>
                              <span className="settings-option-description">{theme.description}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-field-row">
                <label htmlFor="revalidate-shortcut" className="settings-input-label">
                  현재 파일 재검증 단축키
                </label>
                <input
                  id="revalidate-shortcut"
                  className={`settings-input${shortcutError ? ' settings-input--error' : ''}`}
                  type="text"
                  value={shortcutInput}
                  onChange={(event) => handleShortcutInputChange(event.target.value)}
                  placeholder="CmdOrCtrl+Shift+V"
                  spellCheck={false}
                  autoComplete="off"
                />
                <p className="settings-help-text">
                  XML Editor 화면에서만 동작합니다. 입력 즉시 유효성 검사를 수행합니다.
                </p>
                {shortcutError && <p className="settings-error-text">{shortcutError}</p>}
              </div>

              <div className="settings-field-row" aria-labelledby="xml-editor-shortcut-help-title">
                <h3 id="xml-editor-shortcut-help-title" className="settings-subtitle">
                  XML Editor 단축키 도움말
                </h3>
                <p className="settings-help-text">
                  아래는 Monaco Editor에서 기본으로 제공되는 주요 단축키입니다.
                </p>

                <ul className="settings-shortcut-list">
                  {xmlEditorShortcutHelp.map((item) => (
                    <li key={item.action} className="settings-shortcut-item">
                      <div>
                        <p className="settings-shortcut-action">{item.action}</p>
                        {item.isCustomizable ? (
                          <p className="settings-shortcut-customizable">설정에서 커스텀 가능</p>
                        ) : (
                          <p className="settings-shortcut-fixed">현재 버전에서는 기본 단축키만 지원</p>
                        )}
                      </div>
                      <code className="settings-shortcut-code">{item.shortcut}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {activeSection === 'batch-validator' && (
            <section className="settings-section" aria-labelledby="settings-batch-validator-title">
              <h2 id="settings-batch-validator-title">Batch Validator 설정</h2>
              <p className="settings-placeholder">
                Batch Validator 설정 항목은 추후 추가될 예정입니다.
              </p>
            </section>
          )}

          {activeSection === 'extensions' && (
            <section className="settings-section ext-section" aria-labelledby="settings-extensions-title">
              <header className="ext-section-header">
                <h2 id="settings-extensions-title" className="ext-section-title">
                  Extensions
                  <span className="ext-section-count">{allPlugins.length}</span>
                </h2>
                <p className="ext-section-subtitle">
                  XML Editor에서 동작하는 보조 기능을 켜고 끌 수 있습니다. 각 확장은 적용 가능한 문서
                  컨텍스트에서만 동작합니다.
                </p>
              </header>

              {allPlugins.length === 0 ? (
                <p className="settings-placeholder">등록된 확장이 없습니다.</p>
              ) : (
                <ul className="ext-list">
                  {allPlugins.map((plugin) => {
                    const enabled = plugins.enabled[plugin.id] !== false
                    const expanded = expandedPluginIds.has(plugin.id)
                    const detailsId = `plugin-details-${plugin.id}`
                    const initials = getPluginInitials(plugin.name)
                    const accent = getPluginAccent(plugin.id)

                    return (
                      <li
                        key={plugin.id}
                        className={`ext-row${expanded ? ' is-expanded' : ''}${enabled ? '' : ' is-disabled'}`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className="ext-row-summary"
                          aria-expanded={expanded}
                          aria-controls={detailsId}
                          onClick={() => togglePluginExpanded(plugin.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              togglePluginExpanded(plugin.id)
                            }
                          }}
                        >
                          <span
                            className="ext-row-icon"
                            style={{ background: accent.gradient, color: accent.fg }}
                            aria-hidden="true"
                          >
                            {initials}
                          </span>

                          <div className="ext-row-body">
                            <div className="ext-row-title">
                              <span className="ext-row-name">{plugin.name}</span>
                              <span className="ext-row-version">v{plugin.version}</span>
                            </div>
                            <p className="ext-row-description">{plugin.description}</p>
                            <div className="ext-row-meta">
                              <span className="ext-row-publisher">{plugin.author}</span>
                              <span className="ext-row-meta-sep">·</span>
                              <code className="ext-row-id">{plugin.id}</code>
                            </div>
                          </div>

                          <div
                            className="ext-row-actions"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={`ext-action-btn${enabled ? '' : ' is-primary'}`}
                              onClick={() => updatePluginEnabled(plugin.id, !enabled)}
                              aria-pressed={enabled}
                            >
                              {enabled ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </div>

                        {expanded && (
                          <div id={detailsId} className="ext-detail">
                            <div className="ext-detail-header">
                              <span className="ext-detail-tab is-active">Details</span>
                            </div>

                            <div className="ext-detail-body">
                              {plugin.detailedDescription && (
                                <article className="ext-detail-section">
                                  <h3 className="ext-detail-section-title">Description</h3>
                                  <MarkdownLite
                                    className="ext-detail-prose"
                                    source={plugin.detailedDescription}
                                  />
                                </article>
                              )}

                              {plugin.preview && (
                                <article className="ext-detail-section">
                                  <h3 className="ext-detail-section-title">Preview</h3>
                                  <div className="ext-preview-grid">
                                    <div className="ext-preview-cell">
                                      <header className="ext-preview-header">
                                        <span className="ext-preview-kind">
                                          {plugin.preview.inputLabel ?? 'Input'}
                                        </span>
                                        {plugin.preview.input.label ? (
                                          <span className="ext-preview-source">
                                            {plugin.preview.input.label}
                                          </span>
                                        ) : null}
                                      </header>
                                      <pre className="ext-preview-block">
                                        <code>{plugin.preview.input.body}</code>
                                      </pre>
                                    </div>
                                    <div className="ext-preview-cell">
                                      <header className="ext-preview-header">
                                        <span className="ext-preview-kind">
                                          {plugin.preview.outputLabel ?? 'Output'}
                                        </span>
                                        {plugin.preview.output.label ? (
                                          <span className="ext-preview-source">
                                            {plugin.preview.output.label}
                                          </span>
                                        ) : null}
                                      </header>
                                      <pre className="ext-preview-block">
                                        <code>{plugin.preview.output.body}</code>
                                      </pre>
                                    </div>
                                  </div>
                                </article>
                              )}

                              <article className="ext-detail-section">
                                <h3 className="ext-detail-section-title">More info</h3>
                                <dl className="ext-meta-grid">
                                  <div>
                                    <dt>Identifier</dt>
                                    <dd>
                                      <code>{plugin.id}</code>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Version</dt>
                                    <dd>{plugin.version}</dd>
                                  </div>
                                  <div>
                                    <dt>Publisher</dt>
                                    <dd>{plugin.author}</dd>
                                  </div>
                                  <div>
                                    <dt>Status</dt>
                                    <dd>
                                      <span
                                        className={`ext-status-badge${enabled ? ' is-on' : ' is-off'}`}
                                      >
                                        {enabled ? 'Enabled' : 'Disabled'}
                                      </span>
                                    </dd>
                                  </div>
                                </dl>
                              </article>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
