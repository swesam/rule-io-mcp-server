import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerAdminTools } from '../../tools/admin.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  listBrandStyles: ReturnType<typeof vi.fn>;
  getBrandStyle: ReturnType<typeof vi.fn>;
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
    getBrandStyle: vi.fn(),
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

  describe('rule_get_brand_style', () => {
    it('returns full brand style details', async () => {
      const style = {
        id: 1,
        name: 'Default',
        colours: [{ type: 'accent', hex: '#FF6600', brightness: 180 }],
        fonts: [{ type: 'title', name: 'Inter', origin: 'google' }],
        images: [{ type: 'logo', public_path: 'https://example.com/logo.png' }],
        links: [{ type: 'website', link: 'https://example.com' }],
      };
      mocks.getBrandStyle.mockResolvedValue(style);

      const result = await handlers['rule_get_brand_style']({ id: 1 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(style);
      expect(mocks.getBrandStyle).toHaveBeenCalledWith(1);
    });

    it('returns error when brand style not found', async () => {
      mocks.getBrandStyle.mockResolvedValue(null);

      const result = await handlers['rule_get_brand_style']({ id: 999 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('returns error on API failure', async () => {
      mocks.getBrandStyle.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_get_brand_style']({ id: 1 });

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

    it('creates brand style with colours, fonts, and links', async () => {
      const created = { id: 4, name: 'Custom' };
      mocks.createBrandStyleManually.mockResolvedValue(created);

      const result = await handlers['rule_manage_brand_style']({
        action: 'create_manual',
        name: 'Custom',
        colours: [{ type: 'accent', hex: '#FF0000', brightness: 200 }],
        fonts: [{ type: 'title', name: 'Inter', origin: 'google' }],
        links: [{ type: 'website', link: 'https://example.com' }],
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.createBrandStyleManually).toHaveBeenCalledWith({
        name: 'Custom',
        colours: [{ type: 'accent', hex: '#FF0000', brightness: 200 }],
        fonts: [{ type: 'title', name: 'Inter', origin: 'google' }],
        links: [{ type: 'website', link: 'https://example.com' }],
      });
    });

    it('creates brand style with description and is_default', async () => {
      const created = { id: 5, name: 'WithMeta' };
      mocks.createBrandStyleManually.mockResolvedValue(created);

      const result = await handlers['rule_manage_brand_style']({
        action: 'create_manual',
        name: 'WithMeta',
        description: 'Test description',
        is_default: false,
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.createBrandStyleManually).toHaveBeenCalledWith({
        name: 'WithMeta',
        description: 'Test description',
        is_default: false,
      });
    });

    it('updates brand style with colours and fonts', async () => {
      const updated = { id: 1, name: 'Updated' };
      mocks.updateBrandStyle.mockResolvedValue(updated);

      const result = await handlers['rule_manage_brand_style']({
        action: 'update',
        id: 1,
        name: 'Updated',
        colours: [{ type: 'brand', hex: '#00FF00', brightness: 150 }],
        fonts: [{ type: 'body', name: 'Roboto', origin: 'google' }],
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.updateBrandStyle).toHaveBeenCalledWith(1, {
        name: 'Updated',
        colours: [{ type: 'brand', hex: '#00FF00', brightness: 150 }],
        fonts: [{ type: 'body', name: 'Roboto', origin: 'google' }],
      });
    });

    it('updates brand style with description and is_default false', async () => {
      const updated = { id: 1, name: 'Same' };
      mocks.updateBrandStyle.mockResolvedValue(updated);

      const result = await handlers['rule_manage_brand_style']({
        action: 'update',
        id: 1,
        description: 'New desc',
        is_default: false,
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.updateBrandStyle).toHaveBeenCalledWith(1, {
        description: 'New desc',
        is_default: false,
      });
    });
  });

  describe('rule_suppress_subscribers', () => {
    it('suppresses subscribers successfully', async () => {
      const response = { queued: 2 };
      mocks.createSuppressions.mockResolvedValue(response);

      const subscribers = [{ email: 'a@test.com' }, { email: 'b@test.com' }];
      const result = await handlers['rule_suppress_subscribers']({ subscribers });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(response);
      expect(mocks.createSuppressions).toHaveBeenCalledWith({ subscribers });
    });

    it('returns error on API failure', async () => {
      mocks.createSuppressions.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_suppress_subscribers']({
        subscribers: [{ email: 'a@test.com' }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_unsuppress_subscribers', () => {
    it('unsuppresses subscribers successfully', async () => {
      const response = { queued: 1 };
      mocks.deleteSuppressions.mockResolvedValue(response);

      const subscribers = [{ email: 'a@test.com' }];
      const result = await handlers['rule_unsuppress_subscribers']({ subscribers });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(response);
      expect(mocks.deleteSuppressions).toHaveBeenCalledWith({ subscribers });
    });
  });
});
