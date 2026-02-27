import { HomeNavigationButton } from '../components/HomeNavigationButton'
import { WindowTopBar } from '../components/layout/WindowTopBar'

interface SupportedSchemasScreenProps {
  onNavigateHome: () => void
}

interface SupportedSchemaEntry {
  category: string
  schemaName: string
  strictNamespace: string
  transitionalNamespace?: string
  description: string
}

const SUPPORTED_SCHEMAS: SupportedSchemaEntry[] = [
  {
    category: '문서 본문',
    schemaName: 'SpreadsheetML',
    strictNamespace: 'http://purl.oclc.org/ooxml/spreadsheetml/main',
    transitionalNamespace: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    description: 'XLSX 워크북 및 워크시트 본문 검증',
  },
  {
    category: '문서 본문',
    schemaName: 'WordprocessingML',
    strictNamespace: 'http://purl.oclc.org/ooxml/wordprocessingml/main',
    transitionalNamespace: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    description: 'DOCX 문서 본문 및 스타일 검증',
  },
  {
    category: '문서 본문',
    schemaName: 'PresentationML',
    strictNamespace: 'http://purl.oclc.org/ooxml/presentationml/main',
    transitionalNamespace: 'http://schemas.openxmlformats.org/presentationml/2006/main',
    description: 'PPTX 프레젠테이션 슬라이드 검증',
  },
  {
    category: '공통 구성요소',
    schemaName: 'DrawingML',
    strictNamespace: 'http://purl.oclc.org/ooxml/drawingml/main',
    transitionalNamespace: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    description: '도형/차트/드로잉 공통 구조 검증',
  },
  {
    category: '패키지 메타데이터',
    schemaName: 'OPC Relationships',
    strictNamespace: 'http://purl.oclc.org/ooxml/package/relationships',
    transitionalNamespace: 'http://schemas.openxmlformats.org/package/2006/relationships',
    description: '패키지 내부 파트 간 참조 관계 검증',
  },
  {
    category: '패키지 메타데이터',
    schemaName: 'OPC Content Types',
    strictNamespace: 'http://purl.oclc.org/ooxml/package/content-types',
    transitionalNamespace: 'http://schemas.openxmlformats.org/package/2006/content-types',
    description: '파트별 MIME Content-Type 선언 검증',
  },
]

export function SupportedSchemasScreen({ onNavigateHome }: SupportedSchemasScreenProps) {
  return (
    <div className="supported-schemas-screen">
      <WindowTopBar
        className="toolbar"
        leading={<HomeNavigationButton onNavigateHome={onNavigateHome} />}
        center={<span className="app-title">지원 스키마 목록</span>}
      />

      <main className="supported-schemas-content" aria-labelledby="supported-schemas-title">
        <section className="supported-schemas-intro">
          <h1 id="supported-schemas-title">지원하는 OOXML 스키마</h1>
          <p>
            현재 검증 엔진은 아래 스키마를 중심으로 Strict/Transitional 네임스페이스를
            인식합니다.
          </p>
        </section>

        <div className="supported-schemas-table-wrapper">
          <table className="supported-schemas-table">
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col">스키마</th>
                <th scope="col">Strict 네임스페이스</th>
                <th scope="col">Transitional 네임스페이스</th>
                <th scope="col">설명</th>
              </tr>
            </thead>
            <tbody>
              {SUPPORTED_SCHEMAS.map((schema) => (
                <tr key={schema.schemaName}>
                  <td>{schema.category}</td>
                  <td>{schema.schemaName}</td>
                  <td>
                    <code>{schema.strictNamespace}</code>
                  </td>
                  <td>
                    {schema.transitionalNamespace ? (
                      <code>{schema.transitionalNamespace}</code>
                    ) : (
                      <span className="supported-schemas-empty">-</span>
                    )}
                  </td>
                  <td>{schema.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
