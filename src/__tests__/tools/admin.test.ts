import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerAdminTools } from '../../tools/admin.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  listBrandStyles: ReturnType<typeof vi.fn>;
  createBrandStyleFromDomain: ReturnType<typeof vi.fn>;
  createBrandStyleManually: ReturnType<typeof vi.fn>;
  updateBrandStyle: ReturnType<typeof vi.fn>;
  deleteBrandStyle: ReturnType<typeof vi.fn>;
  createSuppressions: ReturnType<typeof vi.fn>;
  deleteSuppressions: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    listBrandStyles: vi.fn(),
    createBrandStyleFromDomain: vi.fn(),
    createBrandStyleManually: vi.fn(),
    updateBrandStyle: vi.fn(),
    deleteBrandStyle: vi.fn(),
    createSuppressions: vi.fn(),
    deleteSuppressions: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

describe('admin tools', () => {
  let mocks: MockClient;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(registerAdminTools, mocks.asClient);
  });

  describe('rule_list_brand_styles', () => {
    it('returns brand styles on success', async () => {
      const styles = [
        { id: 1, name: 'Default', primary_color: '#000000' },
        { id: 2, name: 'Summer', primary_color: '#FF6600' },
      ];
      mocks.listBrandStyles.mockResolvedValue(styles);

      const result = await handlers['rule_list_brand_styles']({});

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(styles);
    });

    it('returns error on API failure', async () => {
      mocks.listBrandStyles.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_list_brand_styles']({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_manage_brand_style', () => {
    it('returns error when update action is missing id', async () => {
      const result = await handlers['rule_manage_brand_style']({
        action: 'update',
        name: 'New Name',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('id is required for update');
    });

    it('returns error when delete action is missing id', async () => {
      const result = await handlers['rule_manage_brand_style']({
        action: 'delete',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('id is required for delete');
    });

    it('creates brand style from domain', async () => {
      const created = { id: 3, name: 'Auto', domain: 'example.com' };
      mocks.createBrandStyleFromDomain.mockResolvedValue(created);

      const result = await handlers['rule_manage_brand_style']({
        action: 'create_from_domain',
        domain: 'example.com',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(created);
    });

    it('returns error when create_from_domain is missing domain', async () => {
      const result = await handlers['rule_manage_brand_style']({
        action: 'create_from_domain',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('domain is required');
    });
  });
});
