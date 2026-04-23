import { vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuleClient } from 'rule-io-sdk';

export type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

export interface ToolRegistration {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

/**
 * Register tools on a throwaway McpServer, spy on `.tool()` calls,
 * and return a map of { toolName -> handler } so tests can call
 * handlers directly without going through MCP transport.
 */
export function registerAndCapture(
  registerFn: (server: McpServer, client: RuleClient) => void,
  client: RuleClient
): Record<string, ToolHandler> {
  const handlers: Record<string, ToolHandler> = {};
  const registrations = registerAndCaptureMeta(registerFn, client);
  for (const [name, reg] of Object.entries(registrations)) {
    handlers[name] = reg.handler;
  }
  return handlers;
}

/**
 * Like {@link registerAndCapture} but also returns the description and
 * raw input schema each tool was registered with. Use in tests that
 * need to assert on metadata (e.g. description drift guards).
 */
export function registerAndCaptureMeta(
  registerFn: (server: McpServer, client: RuleClient) => void,
  client: RuleClient
): Record<string, ToolRegistration> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const toolSpy = vi.spyOn(server, 'tool');
  registerFn(server, client);

  const registrations: Record<string, ToolRegistration> = {};
  for (const call of toolSpy.mock.calls) {
    const name = call[0] as string;
    registrations[name] = {
      description: call[1] as string,
      inputSchema: call[2] as Record<string, unknown>,
      handler: call[call.length - 1] as ToolHandler,
    };
  }
  return registrations;
}
