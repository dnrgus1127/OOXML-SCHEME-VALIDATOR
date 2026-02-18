const MODIFIER_ORDER = ['CmdOrCtrl', 'Cmd', 'Ctrl', 'Alt', 'Shift'] as const
type Modifier = (typeof MODIFIER_ORDER)[number]

const MODIFIER_ALIASES: Record<string, Modifier> = {
  cmdorctrl: 'CmdOrCtrl',
  cmd: 'Cmd',
  command: 'Cmd',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
}

const SPECIAL_KEY_ALIASES: Record<string, string> = {
  enter: 'Enter',
  return: 'Enter',
  escape: 'Escape',
  esc: 'Escape',
  tab: 'Tab',
  space: 'Space',
  spacebar: 'Space',
}

interface ParsedShortcut {
  modifiers: Set<Modifier>
  key: string
}

function normalizeKeyToken(token: string): string | null {
  const trimmed = token.trim()
  if (!trimmed) return null

  if (trimmed.length === 1) {
    return trimmed.toUpperCase()
  }

  const fKeyMatch = /^f([1-9]|1[0-2])$/i.exec(trimmed)
  if (fKeyMatch) {
    return `F${fKeyMatch[1]}`
  }

  const alias = SPECIAL_KEY_ALIASES[trimmed.toLowerCase()]
  return alias ?? null
}

function parseShortcut(rawShortcut: string): ParsedShortcut | null {
  const normalized = rawShortcut.trim()
  if (!normalized) return null

  const parts = normalized.split('+').map((part) => part.trim())
  if (parts.some((part) => !part)) return null

  const modifiers = new Set<Modifier>()
  let key: string | null = null

  for (const token of parts) {
    const lower = token.toLowerCase()
    const modifier = MODIFIER_ALIASES[lower]

    if (modifier) {
      modifiers.add(modifier)
      continue
    }

    if (key) return null

    const normalizedKey = normalizeKeyToken(token)
    if (!normalizedKey) return null
    key = normalizedKey
  }

  if (!key) return null
  if (modifiers.size === 0) return null

  return { modifiers, key }
}

function normalizeEventKey(key: string): string | null {
  if (key.length === 1) {
    return key.toUpperCase()
  }

  const normalized = SPECIAL_KEY_ALIASES[key.toLowerCase()]
  if (normalized) return normalized

  if (key === ' ') return 'Space'

  const fKeyMatch = /^F([1-9]|1[0-2])$/.exec(key.toUpperCase())
  if (fKeyMatch) {
    return fKeyMatch[0]
  }

  return key === 'Tab' || key === 'Enter' || key === 'Escape' ? key : null
}

export function normalizeShortcut(rawShortcut: string): string | null {
  const parsed = parseShortcut(rawShortcut)
  if (!parsed) return null

  const sortedModifiers = MODIFIER_ORDER.filter((modifier) => parsed.modifiers.has(modifier))
  return [...sortedModifiers, parsed.key].join('+')
}

export function matchesShortcut(event: KeyboardEvent, rawShortcut: string): boolean {
  const parsed = parseShortcut(rawShortcut)
  if (!parsed) return false

  const isMac = navigator.platform.includes('Mac')
  const requiredMeta = parsed.modifiers.has('Cmd') || (parsed.modifiers.has('CmdOrCtrl') && isMac)
  const requiredCtrl = parsed.modifiers.has('Ctrl') || (parsed.modifiers.has('CmdOrCtrl') && !isMac)
  const requiredAlt = parsed.modifiers.has('Alt')
  const requiredShift = parsed.modifiers.has('Shift')

  if (event.metaKey !== requiredMeta) return false
  if (event.ctrlKey !== requiredCtrl) return false
  if (event.altKey !== requiredAlt) return false
  if (event.shiftKey !== requiredShift) return false

  const eventKey = normalizeEventKey(event.key)
  if (!eventKey) return false

  return eventKey === parsed.key
}
