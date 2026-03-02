import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js'

import { createServer } from '../../server'

function parseToolJson(result: { content: Array<{ type: string; text?: string }> }) {
  const first = result.content[0]
  if (!first || first.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Expected text content from tool response')
  }

  return JSON.parse(first.text)
}

describe('MCP tool surface', () => {
  let server: ReturnType<typeof createServer>
  let client: Client

  beforeEach(async () => {
    server = createServer()
    client = new Client({ name: 'mcp-tool-surface-test', version: '0.0.0' })

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  })

  afterEach(async () => {
    await Promise.allSettled([client.close(), server.close()])
  })

  it('lists upload tools so clients can discover them', async () => {
    const response = await client.request(
      {
        method: 'tools/list',
        params: {},
      },
      ListToolsResultSchema
    )

    const names = response.tools.map((tool) => tool.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'validate_ooxml',
        'analyze_ooxml_structure',
        'get_ooxml_part',
        'init_ooxml_upload',
        'append_ooxml_upload_chunk',
        'complete_ooxml_upload',
        'delete_ooxml_uploaded_file',
      ])
    )
  })

  it('dispatches upload tool calls end-to-end', async () => {
    const init = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'init_ooxml_upload',
          arguments: {
            file_name: 'sample.docx',
            content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        },
      },
      CallToolResultSchema
    )
    const initPayload = parseToolJson(init)
    expect(initPayload.sessionId).toBeTypeOf('string')

    const chunk = Buffer.from('dummy-ooxml-content', 'utf-8').toString('base64')
    const append = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'append_ooxml_upload_chunk',
          arguments: {
            session_id: initPayload.sessionId,
            chunk_base64: chunk,
          },
        },
      },
      CallToolResultSchema
    )
    const appendPayload = parseToolJson(append)
    expect(appendPayload.totalBytes).toBeGreaterThan(0)

    const complete = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'complete_ooxml_upload',
          arguments: {
            session_id: initPayload.sessionId,
          },
        },
      },
      CallToolResultSchema
    )
    const completePayload = parseToolJson(complete)
    expect(completePayload.fileRef).toBeTypeOf('string')

    const del = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'delete_ooxml_uploaded_file',
          arguments: {
            file_ref: completePayload.fileRef,
          },
        },
      },
      CallToolResultSchema
    )
    const deletePayload = parseToolJson(del)
    expect(deletePayload.deleted).toBe(true)
  })
})
