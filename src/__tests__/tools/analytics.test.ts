import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

  describe('tool descriptions', () => {
    it('rule_get_analytics description lists every valid object_type from the schema', () => {
      const server = new McpServer({ name: 'test', version: '0.0.1' });
      const toolSpy = vi.spyOn(server, 'tool');
      registerAnalyticsTools(server, mocks.asClient);

      const toolCall = toolSpy.mock.calls.find((call) => call[0] === 'rule_get_analytics');
      expect(toolCall).toBeTruthy();
      if (!toolCall) return;

      const description = toolCall[1];
      const inputSchema = toolCall[2] as unknown as {
        object_type: { options: readonly string[] };
      };

      expect(typeof description).toBe('string');
      const objectTypes = inputSchema.object_type.options;
      expect(objectTypes.length).toBeGreaterThan(0);

      for (const objectType of objectTypes) {
        expect(description).toContain(objectType);
      }
    });
  });

  describe('rule_get_analytics', () => {
    it('returns per-object analytics with required params', async () => {
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
        object_type: 'CAMPAIGN',
        object_ids: ['123'],
        metrics: ['open'],
        message_type: 'email',
      });

      expect(mocks.getAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          object_type: 'CAMPAIGN',
          object_ids: ['123'],
          metrics: ['open'],
          message_type: 'email',
        }),
      );
    });

    it('returns error when required params are missing', async () => {
      const result = await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('object_type');
      expect(result.content[0].text).toContain('object_ids');
      expect(result.content[0].text).toContain('metrics');
      expect(mocks.getAnalytics).not.toHaveBeenCalled();
    });

    it('returns error when object_ids or metrics are empty arrays', async () => {
      const result = await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        object_type: 'CAMPAIGN',
        object_ids: [],
        metrics: [],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('non-empty');
      expect(mocks.getAnalytics).not.toHaveBeenCalled();
    });

    it('returns error on API failure', async () => {
      mocks.getAnalytics.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_get_analytics']({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        object_type: 'CAMPAIGN',
        object_ids: ['123'],
        metrics: ['open'],
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
      expect(mocks.exportStatistics).not.toHaveBeenCalled();
      expect(mocks.exportSubscribers).not.toHaveBeenCalled();
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
      expect(mocks.exportDispatchers).not.toHaveBeenCalled();
      expect(mocks.exportSubscribers).not.toHaveBeenCalled();
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
      expect(mocks.exportDispatchers).not.toHaveBeenCalled();
      expect(mocks.exportStatistics).not.toHaveBeenCalled();
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
      expect(mocks.exportDispatchers).not.toHaveBeenCalled();
      expect(mocks.exportSubscribers).not.toHaveBeenCalled();
    });

    it('returns isError on API failure', async () => {
      mocks.exportDispatchers.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_export_data']({
        type: 'dispatchers',
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });
});
