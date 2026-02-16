export function normalizePartPath(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

export function shouldValidateXmlPart(path: string, contentType: string): boolean {
  if (!contentType.includes('xml')) return false

  const normalizedPath = normalizePartPath(path)

  // Relationship parts are validated separately by OPC semantics.
  if (normalizedPath.includes('/_rels/')) return false

  // customXml root data isn't validated against OOXML schemas.
  if (normalizedPath.startsWith('/customXml/') && !normalizedPath.includes('itemProps'))
    return false

  return true
}
