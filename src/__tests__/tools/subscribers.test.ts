import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerSubscriberTools } from '../../tools/subscribers.js';

interface MockClient {
  createSubscriberV3: ReturnType<typeof vi.fn>;
  getSubscriber: ReturnType<typeof vi.fn>;
  getSubscriberFields: ReturnType<typeof vi.fn>;
  getSubscriberTags: ReturnType<typeof vi.fn>;
  deleteSubscriberV3: ReturnType<typeof vi.fn>;
  addSubscriberTagsV3: ReturnType<typeof vi.fn>;
  removeSubscriberTagV3: ReturnType<typeof vi.fn>;
  bulkAddTags: ReturnType<typeof vi.fn>;
  bulkRemoveTags: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    createSubscriberV3: vi.fn(),
    getSubscriber: vi.fn(),
    getSubscriberFields: vi.fn(),
    getSubscriberTags: vi.fn(),
    deleteSubscriberV3: vi.fn(),
    addSubscriberTagsV3: vi.fn(),
    removeSubscriberTagV3: vi.fn(),
    bulkAddTags: vi.fn(),
    bulkRemoveTags: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function registerAndCapture(client: RuleClient): Record<string, ToolHandler> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const toolSpy = vi.spyOn(server, 'tool');
  registerSubscriberTools(server, client);

  const handlers: Record<string, ToolHandler> = {};
  for (const call of toolSpy.mock.calls) {
    const name = call[0] as string;
    handlers[name] = call[call.length - 1] as ToolHandler;
  }
  return handlers;
}

describe('subscriber tools', () => {
  let mocks: ReturnType<typeof createMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(mocks.asClient);
  });

  describe('rule_create_subscriber', () => {
    it('creates subscriber and returns result', async () => {
      const created = { id: 'sub-1', email: 'test@example.com', status: 'ACTIVE' };
      mocks.createSubscriberV3.mockResolvedValue(created);

      const result = await handlers['rule_create_subscriber']({
        email: 'test@example.com',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(created);
      expect(mocks.createSubscriberV3).toHaveBeenCalledWith({
        email: 'test@example.com',
        phone_number: undefined,
        language: undefined,
        status: undefined,
      });
    });
  });

  describe('rule_get_subscriber', () => {
    it('combines 3 API calls and returns combined data', async () => {
      const subscriber = { id: 1, email: 'test@example.com' };
      const fields = { name: 'Test User' };
      const tags = ['welcome', 'vip'];

      mocks.getSubscriber.mockResolvedValue(subscriber);
      mocks.getSubscriberFields.mockResolvedValue(fields);
      mocks.getSubscriberTags.mockResolvedValue(tags);

      const result = await handlers['rule_get_subscriber']({
        email: 'test@example.com',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ subscriber, fields, tags });
    });

    it('returns not found message when subscriber is null', async () => {
      mocks.getSubscriber.mockResolvedValue(null);
      mocks.getSubscriberFields.mockResolvedValue(null);
      mocks.getSubscriberTags.mockResolvedValue(null);

      const result = await handlers['rule_get_subscriber']({
        email: 'missing@example.com',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Subscriber "missing@example.com" not found');
    });

    it('returns error on API failure', async () => {
      mocks.getSubscriber.mockRejectedValue(new RuleApiError('Server Error', 500));
      mocks.getSubscriberFields.mockRejectedValue(new RuleApiError('Server Error', 500));
      mocks.getSubscriberTags.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_get_subscriber']({
        email: 'test@example.com',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('rule_delete_subscriber', () => {
    it('deletes subscriber and returns result', async () => {
      const deleteResult = { success: true };
      mocks.deleteSubscriberV3.mockResolvedValue(deleteResult);

      const result = await handlers['rule_delete_subscriber']({
        subscriber: 'test@example.com',
        identified_by: 'email',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(deleteResult);
      expect(mocks.deleteSubscriberV3).toHaveBeenCalledWith('test@example.com', 'email');
    });
  });

  describe('rule_manage_subscriber_tags', () => {
    it('adds tags to subscriber', async () => {
      const addResult = { success: true };
      mocks.addSubscriberTagsV3.mockResolvedValue(addResult);

      const result = await handlers['rule_manage_subscriber_tags']({
        subscriber: 'test@example.com',
        identified_by: 'email',
        action: 'add',
        tags: ['welcome', 'vip'],
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(addResult);
      expect(mocks.addSubscriberTagsV3).toHaveBeenCalledWith(
        'test@example.com',
        { tags: ['welcome', 'vip'], automation: undefined },
        'email'
      );
    });

    it('removes tags one at a time', async () => {
      mocks.removeSubscriberTagV3
        .mockResolvedValueOnce({ removed: 'tag-a' })
        .mockResolvedValueOnce({ removed: 'tag-b' });

      const result = await handlers['rule_manage_subscriber_tags']({
        subscriber: 'test@example.com',
        identified_by: 'email',
        action: 'remove',
        tags: ['tag-a', 'tag-b'],
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([
        { tag: 'tag-a', result: { removed: 'tag-a' } },
        { tag: 'tag-b', result: { removed: 'tag-b' } },
      ]);
      expect(mocks.removeSubscriberTagV3).toHaveBeenCalledTimes(2);
    });
  });

  describe('rule_bulk_manage_tags', () => {
    it('bulk adds tags', async () => {
      const bulkResult = { queued: true };
      mocks.bulkAddTags.mockResolvedValue(bulkResult);

      const result = await handlers['rule_bulk_manage_tags']({
        action: 'add',
        tags: ['promo'],
        subscribers: [{ email: 'a@example.com' }],
        trigger_automation: 'force',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(bulkResult);
      expect(mocks.bulkAddTags).toHaveBeenCalledWith({
        tags: ['promo'],
        subscribers: [{ email: 'a@example.com' }],
        automation: 'force',
      });
    });

    it('bulk removes tags', async () => {
      const bulkResult = { queued: true };
      mocks.bulkRemoveTags.mockResolvedValue(bulkResult);

      const result = await handlers['rule_bulk_manage_tags']({
        action: 'remove',
        tags: ['old-tag'],
        subscribers: [{ email: 'b@example.com' }],
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.bulkRemoveTags).toHaveBeenCalled();
    });
  });
});
