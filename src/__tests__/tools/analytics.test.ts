import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerAnalyticsTools } from '../../tools/analytics.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  getAnalytics: ReturnType<typeof vi.fn>;
  exportDispatchers: ReturnType<typeof vi.fn>;
  exportStatistics: ReturnType<typeof vi.fn>;
  exportSubscribers: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    getAnalytics: vi.fn(),
    exportDispatchers: vi.fn(),
    exportStatistics: vi.fn(),
    exportSubscribers: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

describe('analytics tools', () => {
  let mocks: MockClient;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(registerAnalyticsTools, mocks.asClient);
  });

  describe('rule_get_analytics', () => {
    it('returns analytics data for a date range', async () => {
      const analytics = { opens: 150, clicks: 42, bounces: 3 };
      mocks.getAnalytics.mockResolvedValue(analytics);

      const result = await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(analytics);
      expect(mocks.getAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2025-01-01',
          date_to: '2025-01-31',
        }),
      );
    });

    it('returns per-object analytics with full query params', async () => {
      const analytics = {
        data: [
          { id: '910092', metrics: [{ metric: 'open', value: 150 }, { metric: 'click', value: 42 }] },
        ],
      };
      mocks.getAnalytics.mockResolvedValue(analytics);

      const result = await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        object_type: 'CAMPAIGN',
        object_ids: ['910092'],
        metrics: ['open', 'click'],
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(analytics);
      expect(mocks.getAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          object_type: 'CAMPAIGN',
          object_ids: ['910092'],
          metrics: ['open', 'click'],
        }),
      );
    });

    it('passes message_type when provided', async () => {
      mocks.getAnalytics.mockResolvedValue({ data: [] });

      await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        message_type: 'email',
      });

      expect(mocks.getAnalytics).toHaveBeenCalledWith({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        message_type: 'email',
      });
    });

    it('returns error when only a subset of grouped params is provided', async () => {
      const result = await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        object_type: 'CAMPAIGN',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('must all be provided together');
      expect(mocks.getAnalytics).not.toHaveBeenCalled();
    });

    it('returns error on API failure', async () => {
      mocks.getAnalytics.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_export_data', () => {
    it('exports dispatchers and normalises date-only strings to datetime', async () => {
      const exported = { data: [{ id: 1, sent: 100 }] };
      mocks.exportDispatchers.mockResolvedValue(exported);

      const result = await handlers['rule_export_data']({
        type: 'dispatchers',
        date_from: '2025-01-01',
        date_to: '2025-01-01',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(exported);
      expect(mocks.exportDispatchers).toHaveBeenCalledWith({
        date_from: '2025-01-01 00:00:00',
        date_to: '2025-01-01 23:59:59',
      });
    });

    it('exports statistics and normalises date-only strings to datetime', async () => {
      const exported = { data: [{ date: '2025-01-01', opens: 150 }] };
      mocks.exportStatistics.mockResolvedValue(exported);

      const result = await handlers['rule_export_data']({
        type: 'statistics',
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(exported);
      expect(mocks.exportStatistics).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2025-01-01 00:00:00',
          date_to: '2025-01-31 23:59:59',
        }),
      );
    });

    it('exports subscribers and normalises date-only strings to datetime', async () => {
      const exported = { data: [{ id: 1, email: 'subscriber@example.com' }] };
      mocks.exportSubscribers.mockResolvedValue(exported);

      const result = await handlers['rule_export_data']({
        type: 'subscribers',
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(exported);
      expect(mocks.exportSubscribers).toHaveBeenCalledWith({
        date_from: '2025-01-01 00:00:00',
        date_to: '2025-01-31 23:59:59',
      });
    });

    it('passes through full datetime strings unchanged', async () => {
      mocks.exportStatistics.mockResolvedValue({ data: [] });

      await handlers['rule_export_data']({
        type: 'statistics',
        date_from: '2025-01-01 08:00:00',
        date_to: '2025-01-31 18:30:00',
      });

      expect(mocks.exportStatistics).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2025-01-01 08:00:00',
          date_to: '2025-01-31 18:30:00',
        }),
      );
    });
  });
});
