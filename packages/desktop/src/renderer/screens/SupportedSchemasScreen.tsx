import { useEffect, useMemo, useState } from 'react'
import { HomeNavigationButton } from '../components/HomeNavigationButton'
import { WindowTopBar } from '../components/layout/WindowTopBar'

interface SupportedSchemasScreenProps {
  onNavigateHome: () => void
}

interface SupportedSchemaNamespaceEntry {
  category: string
  schemaName: string
  namespaceUri: string
  specType: 'Strict' | 'Transitional' | 'Other'
}

export function SupportedSchemasScreen({ onNavigateHome }: SupportedSchemasScreenProps) {
  const [schemas, setSchemas] = useState<SupportedSchemaNamespaceEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadSupportedSchemas = async () => {
      setIsLoading(true)
      setLoadError(null)

      try {
        const result = await window.electronAPI.getSupportedSchemaList()
        if (cancelled) return

        if (!Array.isArray(result)) {
          setSchemas([])
          setLoadError('지원 스키마 목록 형식이 올바르지 않습니다. 앱을 다시 실행해 주세요.')
          return
        }

        setSchemas(result)
      } catch {
        if (cancelled) return

        setSchemas([])
        setLoadError('지원 스키마 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSupportedSchemas()

    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    const strictCount = schemas.filter((schema) => schema.specType === 'Strict').length
    const transitionalCount = schemas.filter((schema) => schema.specType === 'Transitional').length
    const otherCount = schemas.filter((schema) => schema.specType === 'Other').length

    return {
      totalCount: schemas.length,
      strictCount,
      transitionalCount,
      otherCount,
    }
  }, [schemas])

  return (
    <div className="supported-schemas-screen">
      <WindowTopBar
        className="toolbar"
        leading={<HomeNavigationButton onNavigateHome={onNavigateHome} />}
        center={<span className="app-title">지원 스키마 목록</span>}
      />

      <main className="supported-schemas-content" aria-labelledby="supported-schemas-title">
        <section className="supported-schemas-intro">
          <h1 id="supported-schemas-title">지원하는 OOXML 스키마/네임스페이스</h1>
          <p>
            현재 검증 엔진에 탑재된 실제 스키마를 기반으로, 인식 가능한 네임스페이스 목록을
            표시합니다.
          </p>
        </section>

        <section className="supported-schemas-summary" aria-label="지원 스키마 요약">
          <span>총 {summary.totalCount}개 네임스페이스</span>
          <span>Strict {summary.strictCount}개</span>
          <span>Transitional {summary.transitionalCount}개</span>
          {summary.otherCount > 0 ? <span>기타 {summary.otherCount}개</span> : null}
        </section>

        {isLoading ? (
          <p className="supported-schemas-state" role="status" aria-live="polite">
            지원 스키마 목록을 불러오는 중입니다...
          </p>
        ) : null}

        {!isLoading && loadError ? (
          <p className="supported-schemas-state supported-schemas-state--error" role="alert">
            {loadError}
          </p>
        ) : null}

        {!isLoading && !loadError && schemas.length === 0 ? (
          <p className="supported-schemas-state">표시할 지원 스키마가 없습니다.</p>
        ) : null}

        {!isLoading && !loadError && schemas.length > 0 ? (
          <div className="supported-schemas-table-wrapper">
            <table className="supported-schemas-table">
              <thead>
                <tr>
                  <th scope="col">구분</th>
                  <th scope="col">스키마</th>
                  <th scope="col">스펙 타입</th>
                  <th scope="col">네임스페이스 URI</th>
                </tr>
              </thead>
              <tbody>
                {schemas.map((schema) => (
                  <tr
                    key={`${schema.category}:${schema.schemaName}:${schema.namespaceUri}:${schema.specType}`}
                  >
                    <td>{schema.category}</td>
                    <td>{schema.schemaName}</td>
                    <td>{schema.specType}</td>
                    <td>
                      <code>{schema.namespaceUri}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  )
}
