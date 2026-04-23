import { RuleApiError, RuleConfigError } from 'rule-io-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Convert an unknown error into a user-oriented, sanitized message string.
 * Use this when surfacing an error as a field in a larger successful
 * response (e.g. additive analytics that failed). For tool-level failures,
 * use {@link handleRuleError} instead, which wraps this in a CallToolResult.
 */
export function formatRuleErrorMessage(error: unknown): string {
  if (error instanceof RuleApiError) {
    if (error.isAuthError()) {
      return 'Authentication failed. Check your RULE_IO_API_KEY environment variable.';
    }
    if (error.isRateLimited()) {
      return 'Rate limited by Rule.io API. Please wait a moment and retry.';
    }
    if (error.isValidationError() && error.validationErrors) {
      const details = Object.entries(error.validationErrors)
        .map(([field, msgs]) => `  ${field}: ${msgs.join(', ')}`)
        .join('\n');
      return `Validation error:\n${details}`;
    }
    return `Rule.io API error (${error.statusCode}): ${error.message}`;
  }

  if (error instanceof RuleConfigError) {
    return `Configuration error: ${error.message}`;
  }

  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

export function handleRuleError(error: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: formatRuleErrorMessage(error) }],
    isError: true,
  };
}

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

export function errorResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}
