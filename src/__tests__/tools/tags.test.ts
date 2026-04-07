import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerTagTools } from '../../tools/tags.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

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

describe('tag tools', () => {
  let mocks: ReturnType<typeof createMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(registerTagTools, mocks.client);
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
