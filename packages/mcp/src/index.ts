#!/usr/bin/env node
/**
 * @ooxml/mcp
 *
 * MCP (Model Context Protocol) server for OOXML document validation
 *
 * Provides tools for AI agents to:
 * - validate_ooxml: Validate OOXML documents against XSD schemas
 * - analyze_ooxml_structure: Analyze document structure and parts
 * - get_ooxml_part: Retrieve specific part content
 * - init/append/complete/delete upload tools: Manage chunked temporary file uploads
 */

export { createServer, runServer } from './server.js'
export {
  validateOoxml,
  validateOoxmlTool,
  analyzeOoxmlStructure,
  analyzeOoxmlStructureTool,
  getOoxmlPart,
  getOoxmlPartTool,
} from './tools/index.js'

// Run server if executed directly
import { runServer } from './server.js'

runServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
