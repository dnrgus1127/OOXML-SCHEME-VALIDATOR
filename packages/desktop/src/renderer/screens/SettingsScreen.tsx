import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../stores/settings'
import { normalizeShortcut } from '../utils/shortcuts'

interface SettingsScreenProps {
  onClose: () => void
}

type SettingsSection = 'general' | 'xml-editor' | 'batch-validator'

interface ShortcutHelpItem {
  action: string
  shortcut: string
  isCustomizable?: boolean
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
  const { xmlEditor, updateXmlEditorSettings } = useSettingsStore()
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [shortcutInput, setShortcutInput] = useState(xmlEditor.revalidateShortcut)
  const [shortcutError, setShortcutError] = useState<string | null>(null)

  const sections = useMemo(
    () => [
      { id: 'general' as const, label: '기본' },
      { id: 'xml-editor' as const, label: 'XML Editor' },
      { id: 'batch-validator' as const, label: 'Batch Validator' },
    ],
    []
  )

  useEffect(() => {
    setShortcutInput(xmlEditor.revalidateShortcut)
  }, [xmlEditor.revalidateShortcut])

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
        </main>
      </div>
    </div>
  )
}
