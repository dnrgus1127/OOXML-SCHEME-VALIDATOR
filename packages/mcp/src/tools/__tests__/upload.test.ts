import { describe, expect, it } from 'vitest'
import { appendUploadChunk, completeUpload, deleteUploadedFile, initUpload } from '../upload'
import { resolveFileBuffer } from '../file-input'

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
})
