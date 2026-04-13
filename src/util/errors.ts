import { RuleApiError, RuleConfigError } from 'rule-io-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function handleRuleError(error: unknown): CallToolResult {
  if (error instanceof RuleApiError) {
    if (error.isAuthError()) {
      return {
        content: [
          {
            type: 'text',
            text: 'Authentication failed. Check your RULE_IO_API_KEY environment variable.',
          },
        ],
        isError: true,
      };
    }

    if (error.isRateLimited()) {
      return {
        content: [
          {
            type: 'text',
            text: 'Rate limited by Rule.io API. Please wait a moment and retry.',
          },
        ],
        isError: true,
      };
    }

    if (error.isValidationError() && error.validationErrors) {
      const details = Object.entries(error.validationErrors)
        .map(([field, msgs]) => `  ${field}: ${msgs.join(', ')}`)
        .join('\n');
      return {
        content: [
          {
            type: 'text',
            text: `Validation error:\n${details}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Rule.io API error (${error.statusCode}): ${error.message}`,
        },
      ],
      isError: true,
    };
  }

  if (error instanceof RuleConfigError) {
    return {
      content: [
        {
          type: 'text',
          text: `Configuration error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
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
