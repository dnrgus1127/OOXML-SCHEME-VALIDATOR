/**
 * MCP Server for OOXML Validation
 *
 * Provides tools for AI agents to validate and analyze OOXML documents.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import {
  validateOoxml,
  validateOoxmlTool,
  analyzeOoxmlStructure,
  analyzeOoxmlStructureTool,
  getOoxmlPart,
  getOoxmlPartTool,
} from './tools/index.js'

const SERVER_NAME = 'ooxml-validator'
const SERVER_VERSION = '0.1.0'

export function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        validateOoxmlTool,
        analyzeOoxmlStructureTool,
        getOoxmlPartTool,
      ],
    }
  })

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'validate_ooxml': {
          const result = await validateOoxml(args as any)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        }

        case 'analyze_ooxml_structure': {
          const result = await analyzeOoxmlStructure(args as any)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        }

        case 'get_ooxml_part': {
          const result = await getOoxmlPart(args as any)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: message }),
          },
        ],
        isError: true,
      }
    }
  })

  return server
}

export async function runServer(): Promise<void> {
  const server = createServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)

  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`)
}
