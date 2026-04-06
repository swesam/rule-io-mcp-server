import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerTagTools } from '../../tools/tags';

function createMockClient(): {
  client: RuleClient;
  getTags: ReturnType<typeof vi.fn>;
  getTagIdByName: ReturnType<typeof vi.fn>;
} {
  const getTags = vi.fn();
  const getTagIdByName = vi.fn();
  const client = { getTags, getTagIdByName } as unknown as RuleClient;
  return { client, getTags, getTagIdByName };
}

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function registerAndCapture(mockClient: RuleClient): Record<string, ToolHandler> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const toolSpy = vi.spyOn(server, 'tool');
  registerTagTools(server, mockClient);

  const handlers: Record<string, ToolHandler> = {};
  for (const call of toolSpy.mock.calls) {
    const name = call[0] as string;
    // Handler is the last argument
    handlers[name] = call[call.length - 1] as ToolHandler;
  }
  return handlers;
}

describe('tag tools', () => {
  let mocks: ReturnType<typeof createMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(mocks.client);
  });

  describe('rule_list_tags', () => {
    it('returns tag array on success', async () => {
      const tags = [
        { id: 1, name: 'welcome' },
        { id: 2, name: 'vip' },
      ];
      mocks.getTags.mockResolvedValue({ data: tags });

      const result = await handlers['rule_list_tags']({});

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(tags);
    });

    it('returns empty array when response has no data', async () => {
      mocks.getTags.mockResolvedValue({});

      const result = await handlers['rule_list_tags']({});

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([]);
    });

    it('returns error on API failure', async () => {
      mocks.getTags.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_list_tags']({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_find_tag', () => {
    it('returns tag id and name when found', async () => {
      mocks.getTagIdByName.mockResolvedValue(42);

      const result = await handlers['rule_find_tag']({ name: 'welcome' });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ id: 42, name: 'welcome' });
    });

    it('returns text message (not isError) when tag not found', async () => {
      mocks.getTagIdByName.mockResolvedValue(null);

      const result = await handlers['rule_find_tag']({ name: 'nonexistent' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Tag "nonexistent" not found');
      expect(result.content[0].text).toContain('rule_list_tags');
    });

    it('returns error on API failure', async () => {
      mocks.getTagIdByName.mockRejectedValue(new RuleApiError('Unauthorized', 401));

      const result = await handlers['rule_find_tag']({ name: 'test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication failed');
    });
  });
});
