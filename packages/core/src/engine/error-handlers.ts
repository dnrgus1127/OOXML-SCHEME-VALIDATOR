import type { Facet } from '../types'
import type { RuntimeValidationContext } from '../runtime'
import { formatMessage } from '../i18n/format'

export type ErrorCallback = (code: string, message: string, value?: string) => void

export interface ValidationErrorHandler {
  pushError: ErrorCallback
  pushFacetError(facet: Facet, value: string): void
  currentPath(): string
}

export function createErrorHandler(context: RuntimeValidationContext): ValidationErrorHandler {
  return {
    pushError(code: string, message: string, value?: string): void {
      context.errors.push({
        code,
        message,
        path: this.currentPath(),
        value,
      })

      if (context.options.failFast) {
        throw new Error(message)
      }
    },

    pushFacetError(facet: Facet, value: string): void {
      const code = facet.type === 'enumeration' ? 'INVALID_ENUM_VALUE' : 'INVALID_VALUE'
      const messageKey = facet.type === 'enumeration' ? 'VALUE.INVALID_ENUM' : 'VALUE.INVALID_FACET'
      this.pushError(code, formatMessage(messageKey, facet.type), value)
    },

    currentPath(): string {
      const parts = context.elementStack.map((frame) => frame.elementName)
      return `/${parts.join('/')}`
    },
  }
}
