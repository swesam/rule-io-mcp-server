import { vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuleClient } from 'rule-io-sdk';

export type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

/**
 * Register tools on a throwaway McpServer, spy on `.tool()` calls,
 * and return a map of { toolName -> handler } so tests can call
 * handlers directly without going through MCP transport.
 */
export function registerAndCapture(
  registerFn: (server: McpServer, client: RuleClient) => void,
  client: RuleClient
): Record<string, ToolHandler> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const toolSpy = vi.spyOn(server, 'tool');
  registerFn(server, client);

  const handlers: Record<string, ToolHandler> = {};
  for (const call of toolSpy.mock.calls) {
    const name = call[0] as string;
    handlers[name] = call[call.length - 1] as ToolHandler;
  }
  return handlers;
}
