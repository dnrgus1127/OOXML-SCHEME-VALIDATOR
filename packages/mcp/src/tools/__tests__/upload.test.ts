import { describe, expect, it } from 'vitest'
import { appendUploadChunk, completeUpload, deleteUploadedFile, initUpload } from '../upload'
import { resolveFileBuffer } from '../file-input'
import { UploadStore } from '../upload-store'

describe('ooxml upload session tools', () => {
  it('청크 업로드를 완료하면 file_ref로 파일을 다시 조회할 수 있다', () => {
    const init = initUpload({ file_name: 'sample.xlsx' })
    const payload = Buffer.from('dummy-ooxml-content', 'utf-8')

    const append = appendUploadChunk({
      session_id: init.sessionId,
      chunk_base64: payload.toString('base64'),
    })

    expect(append.receivedBytes).toBe(payload.length)

    const completed = completeUpload({ session_id: init.sessionId })
    const resolved = resolveFileBuffer({ file_ref: completed.fileRef })

    expect(completed.size).toBe(payload.length)
    expect(completed.fileName).toBe('sample.xlsx')
    expect(resolved.equals(payload)).toBe(true)

    const deleted = deleteUploadedFile({ file_ref: completed.fileRef })
    expect(deleted.deleted).toBe(true)
  })

  it('디코딩 전에 예상 크기 검증으로 maxChunkSize 초과 청크를 차단한다', () => {
    const original = process.env.OOXML_MCP_MAX_UPLOAD_CHUNK_SIZE_BYTES
    process.env.OOXML_MCP_MAX_UPLOAD_CHUNK_SIZE_BYTES = '4'

    try {
      const store = new UploadStore()
      const session = store.initUpload('oversized.bin')
      const fiveBytesPayload = Buffer.from('abcde', 'utf-8').toString('base64')

      expect(() => store.appendChunk(session.sessionId, fiveBytesPayload)).toThrow(
        'Chunk exceeds max chunk size (4 bytes)'
      )
    } finally {
      if (original === undefined) {
        delete process.env.OOXML_MCP_MAX_UPLOAD_CHUNK_SIZE_BYTES
      } else {
        process.env.OOXML_MCP_MAX_UPLOAD_CHUNK_SIZE_BYTES = original
      }
    }
  })
})
