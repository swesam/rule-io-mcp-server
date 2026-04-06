import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult } from '../util/errors.js';

export function registerAnalyticsTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_get_analytics',
    'Get performance metrics for campaigns or automations. Provide a date range and optionally filter by object type, IDs, and specific metrics (opens, clicks, bounces, etc.).',
    {
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      object_type: z
        .string()
        .optional()
        .describe('Object type to query (e.g. "automail", "campaign")'),
      object_ids: z
        .array(z.string())
        .optional()
        .describe('IDs of the objects to query (as strings)'),
      metrics: z
        .array(z.string())
        .optional()
        .describe('Metrics to retrieve (e.g. "opens", "clicks", "bounces")'),
    },
    async ({ date_from, date_to, object_type, object_ids, metrics }) => {
      try {
        const result =
          object_type && object_ids && metrics
            ? await client.getAnalytics({ date_from, date_to, object_type, object_ids, metrics } as Parameters<typeof client.getAnalytics>[0])
            : await client.getAnalytics({ date_from, date_to });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_export_data',
    'Export data from Rule.io. Supports exporting dispatchers, statistics, or subscribers for a date range. Large exports use pagination via next_page_token.',
    {
      type: z
        .enum(['dispatchers', 'statistics', 'subscribers'])
        .describe('Type of data to export'),
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z
        .string()
        .describe('End date (YYYY-MM-DD). For dispatchers, max 1-day range.'),
      next_page_token: z
        .string()
        .optional()
        .describe('Token from previous export for pagination (statistics only)'),
    },
    async ({ type, date_from, date_to, next_page_token }) => {
      try {
        let result;
        switch (type) {
          case 'dispatchers':
            result = await client.exportDispatchers({ date_from, date_to });
            break;
          case 'statistics':
            result = await client.exportStatistics({
              date_from,
              date_to,
              next_page_token,
            });
            break;
          case 'subscribers':
            result = await client.exportSubscribers({ date_from, date_to });
            break;
        }
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
