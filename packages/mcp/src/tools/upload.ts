import { uploadStore } from './upload-store'

export interface InitUploadInput {
  file_name?: string
  content_type?: string
}

export interface InitUploadOutput {
  sessionId: string
  expiresAt: string
}

export interface AppendUploadChunkInput {
  session_id: string
  chunk_base64: string
}

export interface AppendUploadChunkOutput {
  receivedBytes: number
  totalBytes: number
}

export interface CompleteUploadInput {
  session_id: string
}

export interface CompleteUploadOutput {
  fileRef: string
  size: number
  sha256: string
  expiresAt: string
  fileName?: string
  contentType?: string
}

export interface DeleteUploadedFileInput {
  file_ref: string
}

export interface DeleteUploadedFileOutput {
  deleted: boolean
}

export function initUpload(input: InitUploadInput): InitUploadOutput {
  return uploadStore.initUpload(input.file_name, input.content_type)
}

export function appendUploadChunk(input: AppendUploadChunkInput): AppendUploadChunkOutput {
  return uploadStore.appendChunk(input.session_id, input.chunk_base64)
}

export function completeUpload(input: CompleteUploadInput): CompleteUploadOutput {
  return uploadStore.completeUpload(input.session_id)
}

export function deleteUploadedFile(input: DeleteUploadedFileInput): DeleteUploadedFileOutput {
  return uploadStore.deleteFile(input.file_ref)
}

export const initUploadTool = {
  name: 'init_ooxml_upload',
  description: 'Creates an upload session for chunked OOXML file uploads',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_name: {
        type: 'string',
        description: 'Optional original file name',
      },
      content_type: {
        type: 'string',
        description: 'Optional MIME content type',
      },
    },
  },
}

export const appendUploadChunkTool = {
  name: 'append_ooxml_upload_chunk',
  description: 'Appends a base64 encoded chunk into an existing upload session',
  inputSchema: {
    type: 'object' as const,
    properties: {
      session_id: {
        type: 'string',
        description: 'Upload session ID from init_ooxml_upload',
      },
      chunk_base64: {
        type: 'string',
        description: 'Base64 encoded binary chunk',
      },
    },
    required: ['session_id', 'chunk_base64'],
  },
}

export const completeUploadTool = {
  name: 'complete_ooxml_upload',
  description: 'Finalizes upload session and returns reusable file_ref',
  inputSchema: {
    type: 'object' as const,
    properties: {
      session_id: {
        type: 'string',
        description: 'Upload session ID from init_ooxml_upload',
      },
    },
    required: ['session_id'],
  },
}

export const deleteUploadedFileTool = {
  name: 'delete_ooxml_uploaded_file',
  description: 'Deletes an uploaded file_ref from temporary store',
  inputSchema: {
    type: 'object' as const,
    properties: {
      file_ref: {
        type: 'string',
        description: 'file_ref returned by complete_ooxml_upload',
      },
    },
    required: ['file_ref'],
  },
}
