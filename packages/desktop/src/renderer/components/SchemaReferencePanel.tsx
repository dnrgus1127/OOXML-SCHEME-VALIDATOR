export interface OoxmlPartSchemaReference {
  partPath: string
  namespaces: string[]
  schemaLocations: string[]
  xsdSchemaNames: string[]
  supportedSchemaNames: string[]
}

export interface OoxmlSchemaReferenceSummary {
  namespaces: string[]
  schemaLocations: string[]
  xsdSchemaNames: string[]
  supportedSchemaNames: string[]
  parts: OoxmlPartSchemaReference[]
}

interface SchemaReferencePanelProps {
  summary: OoxmlSchemaReferenceSummary | null
  isLoading: boolean
  error: string | null
}

function renderList(items: string[], emptyMessage: string) {
  if (items.length === 0) {
    return <p className="schema-ref-empty">{emptyMessage}</p>
  }

  return (
    <ul className="schema-ref-list">
      {items.map((item) => (
        <li key={item}>
          <code>{item}</code>
        </li>
      ))}
    </ul>
  )
}

export function SchemaReferencePanel({ summary, isLoading, error }: SchemaReferencePanelProps) {
  return (
    <section className="schema-reference-panel" aria-labelledby="schema-reference-title">
      <div className="schema-reference-header">
        <h3 id="schema-reference-title">문서 참조 스키마 정보</h3>
      </div>

      {isLoading ? (
        <p className="schema-ref-state">문서 스키마 참조를 분석하는 중입니다...</p>
      ) : null}

      {!isLoading && error ? (
        <p className="schema-ref-state schema-ref-state--error">{error}</p>
      ) : null}

      {!isLoading && !error && summary ? (
        <div className="schema-ref-content">
          <div className="schema-ref-summary">
            <span>네임스페이스 {summary.namespaces.length}개</span>
            <span>XSD 파일 {summary.xsdSchemaNames.length}개</span>
            <span>지원 스키마명 {summary.supportedSchemaNames.length}개</span>
          </div>

          <div className="schema-ref-section">
            <h4>네임스페이스</h4>
            {renderList(summary.namespaces, '참조된 네임스페이스가 없습니다.')}
          </div>

          <div className="schema-ref-section">
            <h4>XSD 파일명</h4>
            {renderList(summary.xsdSchemaNames, '참조된 XSD 파일명이 없습니다.')}
          </div>
        </div>
      ) : null}
    </section>
  )
}
