import { randomUUID, createHash } from 'crypto'

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024
const DEFAULT_MAX_CHUNK_SIZE = 5 * 1024 * 1024
const DEFAULT_TTL_MS = 30 * 60 * 1000

interface UploadSession {
  id: string
  fileName?: string
  contentType?: string
  createdAt: number
  expiresAt: number
  chunks: Buffer[]
  size: number
  completed: boolean
  fileRef?: string
}

interface StoredFile {
  fileRef: string
  buffer: Buffer
  fileName?: string
  contentType?: string
  size: number
  sha256: string
  createdAt: number
  expiresAt: number
}

function getNumericEnv(name: string, fallback: number): number {
  const value = process.env[name]
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeBase64(base64: string): string {
  return base64.replace(/\s+/g, '')
}

function estimateDecodedSizeFromBase64(base64: string): number {
  const normalized = normalizeBase64(base64)

  if (normalized.length === 0) return 0
  if (normalized.length % 4 !== 0) {
    throw new Error('Chunk is invalid base64')
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error('Chunk is invalid base64')
  }

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.floor((normalized.length / 4) * 3 - padding)
}

export class UploadStore {
  private readonly sessions = new Map<string, UploadSession>()
  private readonly files = new Map<string, StoredFile>()

  private readonly maxFileSize = getNumericEnv(
    'OOXML_MCP_MAX_UPLOAD_SIZE_BYTES',
    DEFAULT_MAX_FILE_SIZE
  )
  private readonly maxChunkSize = getNumericEnv(
    'OOXML_MCP_MAX_UPLOAD_CHUNK_SIZE_BYTES',
    DEFAULT_MAX_CHUNK_SIZE
  )
  private readonly ttlMs = getNumericEnv('OOXML_MCP_UPLOAD_TTL_MS', DEFAULT_TTL_MS)

  private purgeExpired(): void {
    const now = Date.now()

    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId)
      }
    }

    for (const [fileRef, file] of this.files) {
      if (file.expiresAt <= now) {
        this.files.delete(fileRef)
      }
    }
  }

  initUpload(fileName?: string, contentType?: string): { sessionId: string; expiresAt: string } {
    this.purgeExpired()

    const sessionId = randomUUID()
    const now = Date.now()
    const expiresAt = now + this.ttlMs

    this.sessions.set(sessionId, {
      id: sessionId,
      fileName,
      contentType,
      createdAt: now,
      expiresAt,
      chunks: [],
      size: 0,
      completed: false,
    })

    return {
      sessionId,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  appendChunk(
    sessionId: string,
    chunkBase64: string
  ): { receivedBytes: number; totalBytes: number } {
    this.purgeExpired()

    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Upload session not found or expired')
    }
    if (session.completed) {
      throw new Error('Upload session is already completed')
    }

    const estimatedBytes = estimateDecodedSizeFromBase64(chunkBase64)
    if (estimatedBytes > this.maxChunkSize) {
      throw new Error(`Chunk exceeds max chunk size (${this.maxChunkSize} bytes)`)
    }

    const chunk = Buffer.from(normalizeBase64(chunkBase64), 'base64')
    if (chunk.length === 0) {
      throw new Error('Chunk is empty or invalid base64')
    }
    if (chunk.length > this.maxChunkSize) {
      throw new Error(`Chunk exceeds max chunk size (${this.maxChunkSize} bytes)`)
    }

    const nextSize = session.size + chunk.length
    if (nextSize > this.maxFileSize) {
      throw new Error(`Upload exceeds max file size (${this.maxFileSize} bytes)`)
    }

    session.chunks.push(chunk)
    session.size = nextSize

    return {
      receivedBytes: chunk.length,
      totalBytes: session.size,
    }
  }

  completeUpload(sessionId: string): {
    fileRef: string
    size: number
    sha256: string
    expiresAt: string
    fileName?: string
    contentType?: string
  } {
    this.purgeExpired()

    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Upload session not found or expired')
    }
    if (session.completed) {
      throw new Error('Upload session is already completed')
    }
    if (session.size === 0) {
      throw new Error('Upload has no data')
    }

    const buffer = Buffer.concat(session.chunks)
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    const fileRef = `upload:${randomUUID()}`
    const expiresAt = Date.now() + this.ttlMs

    this.files.set(fileRef, {
      fileRef,
      buffer,
      fileName: session.fileName,
      contentType: session.contentType,
      size: buffer.length,
      sha256,
      createdAt: Date.now(),
      expiresAt,
    })

    session.completed = true
    session.fileRef = fileRef
    this.sessions.delete(sessionId)

    return {
      fileRef,
      size: buffer.length,
      sha256,
      expiresAt: new Date(expiresAt).toISOString(),
      fileName: session.fileName,
      contentType: session.contentType,
    }
  }

  getFileBuffer(fileRef: string): Buffer {
    this.purgeExpired()

    const file = this.files.get(fileRef)
    if (!file) {
      throw new Error('file_ref not found or expired')
    }

    return file.buffer
  }

  deleteFile(fileRef: string): { deleted: boolean } {
    this.purgeExpired()
    return { deleted: this.files.delete(fileRef) }
  }
}

export const uploadStore = new UploadStore()
