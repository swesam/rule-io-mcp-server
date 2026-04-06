import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerCampaignTools } from '../../tools/campaigns.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  createCampaign: ReturnType<typeof vi.fn>;
  listCampaigns: ReturnType<typeof vi.fn>;
  getCampaign: ReturnType<typeof vi.fn>;
  updateCampaign: ReturnType<typeof vi.fn>;
  scheduleCampaign: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    createCampaign: vi.fn(),
    listCampaigns: vi.fn(),
    getCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    scheduleCampaign: vi.fn(),
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
  });
});
