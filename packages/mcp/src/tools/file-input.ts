import { readFileSync } from 'fs'
import { uploadStore } from './upload-store'

export interface FileInput {
  file_path?: string
  file_base64?: string
  file_ref?: string
}

export function resolveFileBuffer(input: FileInput): Buffer {
  if (input.file_path) {
    try {
      return readFileSync(input.file_path)
    } catch {
      throw new Error(`Failed to read file: ${input.file_path}`)
    }
  }

  if (input.file_base64) {
    return Buffer.from(input.file_base64, 'base64')
  }

  if (input.file_ref) {
    return uploadStore.getFileBuffer(input.file_ref)
  }

  throw new Error('One of file_path, file_base64, or file_ref must be provided')
}
