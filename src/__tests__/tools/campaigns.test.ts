import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerCampaignTools } from '../../tools/campaigns.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  createCampaign: ReturnType<typeof vi.fn>;
  createCampaignEmail: ReturnType<typeof vi.fn>;
  listCampaigns: ReturnType<typeof vi.fn>;
  getCampaign: ReturnType<typeof vi.fn>;
  updateCampaign: ReturnType<typeof vi.fn>;
  deleteCampaign: ReturnType<typeof vi.fn>;
  copyCampaign: ReturnType<typeof vi.fn>;
  scheduleCampaign: ReturnType<typeof vi.fn>;
  listSegments: ReturnType<typeof vi.fn>;
  getAnalytics: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    createCampaign: vi.fn(),
    createCampaignEmail: vi.fn(),
    listCampaigns: vi.fn(),
    getCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    deleteCampaign: vi.fn(),
    copyCampaign: vi.fn(),
    scheduleCampaign: vi.fn(),
    listSegments: vi.fn(),
    getAnalytics: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

describe('campaign tools', () => {
  let mocks: MockClient;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(registerCampaignTools, mocks.asClient);
  });

  describe('rule_create_campaign', () => {
    it('creates a campaign and returns result', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      mocks.createCampaign.mockResolvedValue(campaign);

      const result = await handlers['rule_create_campaign']({
        name: 'Summer Sale',
        sendout_type: 'marketing',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(campaign);
      expect(mocks.createCampaign).toHaveBeenCalledWith({
        name: 'Summer Sale',
        message_type: 1,
        sendout_type: 1,
      });
    });

    it('returns error on API failure', async () => {
      mocks.createCampaign.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_create_campaign']({
        name: 'Fail Campaign',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_schedule_campaign', () => {
    it('returns validation error when scheduling without datetime', async () => {
      const result = await handlers['rule_schedule_campaign']({
        id: 1,
        action: 'schedule',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('datetime is required');
    });

    it('sends immediately with send_now action', async () => {
      const scheduled = { success: true };
      mocks.scheduleCampaign.mockResolvedValue(scheduled);

      const result = await handlers['rule_schedule_campaign']({
        id: 1,
        action: 'send_now',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(scheduled);
      expect(mocks.scheduleCampaign).toHaveBeenCalledWith(1, {
        type: 'now',
        datetime: undefined,
      });
    });

    it('returns isError on API failure', async () => {
      mocks.scheduleCampaign.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_schedule_campaign']({
        id: 1,
        action: 'send_now',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_list_campaigns', () => {
    it('returns campaign list', async () => {
      const campaigns = { data: [{ id: 1, name: 'Summer Sale' }], total: 1 };
      mocks.listCampaigns.mockResolvedValue(campaigns);

      const result = await handlers['rule_list_campaigns']({ page: 1, per_page: 25 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(campaigns);
      expect(mocks.listCampaigns).toHaveBeenCalledWith({ page: 1, per_page: 25 });
    });

    it('returns isError on API failure', async () => {
      mocks.listCampaigns.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_list_campaigns']({ page: 1, per_page: 25 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_get_campaign', () => {
    it('returns campaign detail', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      mocks.getCampaign.mockResolvedValue(campaign);

      const result = await handlers['rule_get_campaign']({ id: 1 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(campaign);
    });

    it('returns not-found text when campaign is null', async () => {
      mocks.getCampaign.mockResolvedValue(null);

      const result = await handlers['rule_get_campaign']({ id: 999 });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Campaign 999 not found');
    });

    it('returns isError on API failure', async () => {
      mocks.getCampaign.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_get_campaign']({ id: 1 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });

    it('returns campaign with analytics when include_analytics is provided', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      const analytics = {
        data: [
          { id: '1', metrics: [{ metric: 'open', value: 150 }, { metric: 'click', value: 42 }] },
        ],
      };
      mocks.getCampaign.mockResolvedValue(campaign);
      mocks.getAnalytics.mockResolvedValue(analytics);

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open', 'click'],
        },
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({
        ...campaign,
        analytics: [{ metric: 'open', value: 150 }, { metric: 'click', value: 42 }],
      });
      expect(mocks.getAnalytics).toHaveBeenCalledWith({
        date_from: '2025-01-01 00:00:00',
        date_to: '2025-01-31 23:59:59',
        object_type: 'CAMPAIGN',
        object_ids: ['1'],
        metrics: ['open', 'click'],
        message_type: undefined,
      });
    });

    it('passes through full datetime strings unchanged', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      mocks.getCampaign.mockResolvedValue(campaign);
      mocks.getAnalytics.mockResolvedValue({ data: [] });

      await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01 08:00:00',
          date_to: '2025-01-31 18:30:00',
          metrics: ['open'],
        },
      });

      expect(mocks.getAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2025-01-01 08:00:00',
          date_to: '2025-01-31 18:30:00',
        }),
      );
    });

    it('returns campaign with analytics_error when analytics call fails', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      mocks.getCampaign.mockResolvedValue(campaign);
      mocks.getAnalytics.mockRejectedValue(new Error('Analytics unavailable'));

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open'],
        },
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({
        ...campaign,
        analytics: [],
        analytics_error: 'Unexpected error: Analytics unavailable',
      });
    });

    it('sanitises RuleApiError into the same message handleRuleError would emit', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      mocks.getCampaign.mockResolvedValue(campaign);
      mocks.getAnalytics.mockRejectedValue(new RuleApiError('Unauthorized', 401));

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open'],
        },
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({
        ...campaign,
        analytics: [],
        analytics_error: 'Authentication failed. Check your RULE_IO_API_KEY environment variable.',
      });
    });

    it('includes message_type when provided in include_analytics', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      const analytics = { data: [{ id: '1', metrics: [] }] };
      mocks.getCampaign.mockResolvedValue(campaign);
      mocks.getAnalytics.mockResolvedValue(analytics);

      await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open'],
          message_type: 'email',
        },
      });

      expect(mocks.getAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          message_type: 'email',
        })
      );
    });

    it('returns empty analytics array when analytics data is missing', async () => {
      const campaign = { id: 1, name: 'Summer Sale', status: 'draft' };
      const analytics = { data: [] };
      mocks.getCampaign.mockResolvedValue(campaign);
      mocks.getAnalytics.mockResolvedValue(analytics);

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open'],
        },
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.analytics).toEqual([]);
    });

    it('adds analytics_warnings when the campaign is SMS and open metrics were requested', async () => {
      // getCampaign returns RuleCampaignResponse — campaign lives under `data`.
      const campaignResponse = {
        data: {
          id: 1,
          name: 'SMS Blast',
          message_type: { value: 2, key: 'text_message', description: 'SMS' },
        },
      };
      mocks.getCampaign.mockResolvedValue(campaignResponse);
      mocks.getAnalytics.mockResolvedValue({ data: [{ id: '1', metrics: [] }] });

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open_uniq', 'click_uniq'],
        },
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.analytics_warnings).toEqual([
        { field: 'open_uniq', note: expect.stringContaining('SMS') },
      ]);
    });

    it('does not add analytics_warnings when SMS campaign requests only click metrics', async () => {
      const campaignResponse = {
        data: {
          id: 1,
          name: 'SMS Blast',
          message_type: { value: 2, key: 'text_message', description: 'SMS' },
        },
      };
      mocks.getCampaign.mockResolvedValue(campaignResponse);
      mocks.getAnalytics.mockResolvedValue({ data: [{ id: '1', metrics: [] }] });

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['click_uniq', 'sent'],
        },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.analytics_warnings).toBeUndefined();
    });

    it('detects SMS message_type on the flatter campaign shape (no data wrapper)', async () => {
      // Some older / partial responses surface message_type at the top level
      // rather than under `data`. The handler must handle both shapes so SMS
      // warnings are not silently dropped when the wrapper is absent.
      const flatCampaign = {
        id: 1,
        name: 'SMS Blast',
        message_type: { value: 2, key: 'text_message', description: 'SMS' },
      };
      mocks.getCampaign.mockResolvedValue(flatCampaign);
      mocks.getAnalytics.mockResolvedValue({ data: [{ id: '1', metrics: [] }] });

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open_uniq'],
        },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.analytics_warnings).toEqual([
        { field: 'open_uniq', note: expect.stringContaining('SMS') },
      ]);
    });

    it('does not add analytics_warnings when the campaign is an email', async () => {
      const campaignResponse = {
        data: {
          id: 1,
          name: 'Email Newsletter',
          message_type: { value: 1, key: 'email', description: 'Email' },
        },
      };
      mocks.getCampaign.mockResolvedValue(campaignResponse);
      mocks.getAnalytics.mockResolvedValue({ data: [{ id: '1', metrics: [] }] });

      const result = await handlers['rule_get_campaign']({
        id: 1,
        include_analytics: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          metrics: ['open', 'open_uniq'],
        },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.analytics_warnings).toBeUndefined();
    });
  });

  describe('rule_update_campaign', () => {
    it('updates a campaign', async () => {
      const updated = { id: 1, name: 'Winter Sale' };
      mocks.updateCampaign.mockResolvedValue(updated);

      const result = await handlers['rule_update_campaign']({ id: 1, name: 'Winter Sale' });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(updated);
    });

    it('returns isError on API failure', async () => {
      mocks.updateCampaign.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_update_campaign']({ id: 1, name: 'Fail' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_create_campaign_email', () => {
    it('creates campaign email with template', async () => {
      mocks.createCampaignEmail.mockResolvedValue({
        campaignId: 10,
        messageId: 20,
        templateId: 30,
        dynamicSetId: 40,
      });

      const result = await handlers['rule_create_campaign_email']({
        name: 'Newsletter',
        subject: 'April Update',
        template: { body: [] },
        tags: [{ id: 5, negative: false }],
        sendout_type: 'marketing',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({
        success: true,
        campaign_id: 10,
        message_id: 20,
        template_id: 30,
        dynamic_set_id: 40,
      });
    });

    it('creates campaign email with brand_style_id', async () => {
      mocks.createCampaignEmail.mockResolvedValue({
        campaignId: 11,
        messageId: 21,
        templateId: 31,
        dynamicSetId: 41,
      });

      const result = await handlers['rule_create_campaign_email']({
        name: 'Branded Campaign',
        subject: 'Hello!',
        brand_style_id: 42,
        tags: [{ id: 1, negative: false }],
        sendout_type: 'marketing',
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.createCampaignEmail).toHaveBeenCalledWith(
        expect.objectContaining({ brandStyleId: 42 })
      );
    });

    it('creates campaign email with brand_style_id and sections', async () => {
      mocks.createCampaignEmail.mockResolvedValue({
        campaignId: 12,
        messageId: 22,
        templateId: 32,
        dynamicSetId: 42,
      });

      const result = await handlers['rule_create_campaign_email']({
        name: 'Spring Sale',
        subject: 'Spring deals!',
        brand_style_id: 42,
        sections: [
          { type: 'heading', text: 'Spring Sale' },
          { type: 'text', text: 'Check out our deals' },
          { type: 'button', text: 'Shop Now', url: 'https://example.com/shop' },
        ],
        tags: [{ id: 1, negative: false }],
        sendout_type: 'marketing',
      });

      expect(result.isError).toBeUndefined();
      const call = mocks.createCampaignEmail.mock.calls[0][0];
      expect(call.brandStyleId).toBe(42);
      // Sections should be converted to RCML — array of rc-section objects
      expect(call.sections).toHaveLength(1);
      expect(call.sections[0].tagName).toBe('rc-section');
      expect(call.sections[0].children[0].tagName).toBe('rc-column');
      expect(call.sections[0].children[0].children).toHaveLength(3);
      expect(call.sections[0].children[0].children[0].tagName).toBe('rc-heading');
      expect(call.sections[0].children[0].children[1].tagName).toBe('rc-text');
      expect(call.sections[0].children[0].children[2].tagName).toBe('rc-button');
    });

    it('ignores sections when template is provided', async () => {
      mocks.createCampaignEmail.mockResolvedValue({
        campaignId: 13,
        messageId: 23,
        templateId: 33,
        dynamicSetId: 43,
      });

      const result = await handlers['rule_create_campaign_email']({
        name: 'Template Campaign',
        subject: 'Hello!',
        template: { body: [] },
        sections: [{ type: 'heading', text: 'Ignored' }],
        tags: [{ id: 1, negative: false }],
        sendout_type: 'marketing',
      });

      expect(result.isError).toBeUndefined();
      const call = mocks.createCampaignEmail.mock.calls[0][0];
      expect(call.template).toEqual({ body: [] });
      expect(call.sections).toBeUndefined();
    });

    it('returns error when no recipients provided', async () => {
      const result = await handlers['rule_create_campaign_email']({
        name: 'No Recipients',
        subject: 'Hello!',
        brand_style_id: 42,
        sendout_type: 'marketing',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('At least one recipient');
    });

    it('returns error when neither template nor brand_style_id provided', async () => {
      const result = await handlers['rule_create_campaign_email']({
        name: 'Bad Campaign',
        subject: 'Hello!',
        tags: [{ id: 1, negative: false }],
        sendout_type: 'marketing',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Provide exactly one');
    });

    it('returns error when both template and brand_style_id provided', async () => {
      const result = await handlers['rule_create_campaign_email']({
        name: 'Bad Campaign',
        subject: 'Hello!',
        template: { body: [] },
        brand_style_id: 42,
        tags: [{ id: 1, negative: false }],
        sendout_type: 'marketing',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not both');
    });

    it('handles API error', async () => {
      mocks.createCampaignEmail.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_create_campaign_email']({
        name: 'Fail',
        subject: 'Hello!',
        template: { body: [] },
        tags: [{ id: 1, negative: false }],
        sendout_type: 'marketing',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('rule_delete_campaign', () => {
    it('deletes a campaign', async () => {
      mocks.deleteCampaign.mockResolvedValue({ success: true });

      const result = await handlers['rule_delete_campaign']({ id: 1 });

      expect(result.isError).toBeUndefined();
      expect(mocks.deleteCampaign).toHaveBeenCalledWith(1);
    });

    it('handles API error', async () => {
      mocks.deleteCampaign.mockRejectedValue(new RuleApiError('Not Found', 404));

      const result = await handlers['rule_delete_campaign']({ id: 999 });

      expect(result.isError).toBe(true);
    });
  });

  describe('rule_copy_campaign', () => {
    it('copies a campaign and returns the new copy', async () => {
      const copy = { data: { id: 2, name: 'Summer Sale (Copy)' } };
      mocks.copyCampaign.mockResolvedValue(copy);

      const result = await handlers['rule_copy_campaign']({ id: 1 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(copy);
      expect(mocks.copyCampaign).toHaveBeenCalledWith(1);
    });

    it('returns isError on API failure', async () => {
      mocks.copyCampaign.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_copy_campaign']({ id: 1 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_list_segments', () => {
    it('returns segment list', async () => {
      const segments = { data: [{ id: 1, name: 'VIP Customers' }], total: 1 };
      mocks.listSegments.mockResolvedValue(segments);

      const result = await handlers['rule_list_segments']({ page: 1, per_page: 25 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(segments);
    });

    it('returns isError on API failure', async () => {
      mocks.listSegments.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_list_segments']({ page: 1, per_page: 25 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });
});
