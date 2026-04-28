import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerSubscriberTools } from '../../tools/subscribers.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

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
  blockSubscribers: ReturnType<typeof vi.fn>;
  unblockSubscribers: ReturnType<typeof vi.fn>;
  createCustomFieldData: ReturnType<typeof vi.fn>;
  listSubscribersByTagIds: ReturnType<typeof vi.fn>;
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
    blockSubscribers: vi.fn(),
    unblockSubscribers: vi.fn(),
    createCustomFieldData: vi.fn(),
    listSubscribersByTagIds: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

describe('subscriber tools', () => {
  let mocks: ReturnType<typeof createMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(registerSubscriberTools, mocks.asClient);
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

    it('returns isError on API failure', async () => {
      mocks.createSubscriberV3.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_create_subscriber']({
        email: 'test@example.com',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
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

    it('returns isError on API failure', async () => {
      mocks.deleteSubscriberV3.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_delete_subscriber']({
        subscriber: 'test@example.com',
        identified_by: 'email',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
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

    it('returns isError on API failure', async () => {
      mocks.addSubscriberTagsV3.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_manage_subscriber_tags']({
        subscriber: 'test@example.com',
        identified_by: 'email',
        action: 'add',
        tags: ['welcome'],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
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

    it('returns isError on API failure', async () => {
      mocks.bulkAddTags.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_bulk_manage_tags']({
        action: 'add',
        tags: ['promo'],
        subscribers: [{ email: 'a@example.com' }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_set_subscriber_fields', () => {
    it('sets custom field data on a subscriber', async () => {
      mocks.createCustomFieldData.mockResolvedValue({ success: true });

      const result = await handlers['rule_set_subscriber_fields']({
        subscriber_id: 42,
        groups: [
          {
            group: 'Order',
            values: [
              { field: 'OrderNumber', value: 'ORD-123' },
              { field: 'Status', value: 'confirmed' },
            ],
          },
        ],
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.createCustomFieldData).toHaveBeenCalledWith(42, {
        groups: [
          {
            group: 'Order',
            create_if_not_exists: true,
            historical: undefined,
            values: [
              { field: 'OrderNumber', create_if_not_exists: true, value: 'ORD-123' },
              { field: 'Status', create_if_not_exists: true, value: 'confirmed' },
            ],
          },
        ],
      });
    });

    it('handles API error', async () => {
      mocks.createCustomFieldData.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_set_subscriber_fields']({
        subscriber_id: 42,
        groups: [{ group: 'Order', values: [{ field: 'Ref', value: 'X' }] }],
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('rule_block_subscribers', () => {
    it('blocks subscribers', async () => {
      mocks.blockSubscribers.mockResolvedValue({ success: true });

      const result = await handlers['rule_block_subscribers']({
        action: 'block',
        subscribers: [{ email: 'spam@example.com' }],
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.blockSubscribers).toHaveBeenCalledWith([{ email: 'spam@example.com' }]);
    });

    it('unblocks subscribers', async () => {
      mocks.unblockSubscribers.mockResolvedValue({ success: true });

      const result = await handlers['rule_block_subscribers']({
        action: 'unblock',
        subscribers: [{ email: 'restored@example.com' }],
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.unblockSubscribers).toHaveBeenCalledWith([{ email: 'restored@example.com' }]);
    });

    it('handles API error', async () => {
      mocks.blockSubscribers.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_block_subscribers']({
        action: 'block',
        subscribers: [{ email: 'test@example.com' }],
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('rule_list_subscribers_by_tag', () => {
    it('returns matched subscribers and pagination cursor', async () => {
      const sdkResult = {
        subscribers: [
          { id: 1, email: 'a@example.com', tags: [{ id: 10 }, { id: 20 }] },
          { id: 2, email: 'b@example.com', tags: [{ id: 10 }, { id: 20 }] },
        ],
        matched: 2,
        scanned: 100,
        next_page: 2,
      };
      mocks.listSubscribersByTagIds.mockResolvedValue(sdkResult);

      const result = await handlers['rule_list_subscribers_by_tag']({
        tag_ids: [10, 20],
        limit: 100,
        page: 1,
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(sdkResult);
      expect(mocks.listSubscribersByTagIds).toHaveBeenCalledWith({
        tag_ids: [10, 20],
        limit: 100,
        page: 1,
      });
    });

    it('returns empty matches with null next_page at end of pagination', async () => {
      mocks.listSubscribersByTagIds.mockResolvedValue({
        subscribers: [],
        matched: 0,
        scanned: 37,
        next_page: null,
      });

      const result = await handlers['rule_list_subscribers_by_tag']({
        tag_ids: [10],
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.matched).toBe(0);
      expect(parsed.next_page).toBeNull();
    });

    it('passes optional limit and page through when omitted', async () => {
      // Handlers are captured directly — Zod defaults (100, 1) are applied
      // by the MCP SDK at input-parse time, which is bypassed here. The
      // schema-level defaults are exercised in schemas.test.ts.
      mocks.listSubscribersByTagIds.mockResolvedValue({
        subscribers: [],
        matched: 0,
        scanned: 0,
        next_page: null,
      });

      await handlers['rule_list_subscribers_by_tag']({
        tag_ids: [42],
      });

      expect(mocks.listSubscribersByTagIds).toHaveBeenCalledWith({
        tag_ids: [42],
        limit: undefined,
        page: undefined,
      });
    });

    it('returns isError on API failure', async () => {
      mocks.listSubscribersByTagIds.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_list_subscribers_by_tag']({
        tag_ids: [10],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });
});
