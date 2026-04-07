import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult } from '../util/errors.js';

const OBJECT_TYPES = [
  'AB_TEST',
  'CAMPAIGN',
  'AUTOMAIL',
  'TRANSACTIONAL_NAME',
  'JOURNEY',
] as const;

const METRICS = [
  'open',
  'open_uniq',
  'sent',
  'delivered',
  'click',
  'click_uniq',
  'total_bounce',
  'soft_bounce',
  'hard_bounce',
  'unsubscribe',
  'spam',
] as const;

const MESSAGE_TYPES = ['email', 'text_message'] as const;

export function registerAnalyticsTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_get_analytics',
    'Get performance metrics for campaigns or automations. Provide a date range for a summary, or add object_type + object_ids + metrics for detailed per-object stats. When querying specific objects, all three parameters (object_type, object_ids, metrics) are required together.',
    {
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      object_type: z
        .enum(OBJECT_TYPES)
        .optional()
        .describe(
          'Type of object to query. Required together with object_ids and metrics.',
        ),
      object_ids: z
        .array(z.string())
        .min(1)
        .optional()
        .describe(
          'IDs of the objects to query (as strings). Required together with object_type and metrics.',
        ),
      metrics: z
        .array(z.enum(METRICS))
        .min(1)
        .optional()
        .describe(
          'Metrics to retrieve. Required together with object_type and object_ids.',
        ),
      message_type: z
        .enum(MESSAGE_TYPES)
        .optional()
        .describe('Filter by message type (email or text_message)'),
    },
    async ({ date_from, date_to, object_type, object_ids, metrics, message_type }) => {
      try {
        const hasObjectType = object_type !== undefined;
        const hasObjectIds = object_ids !== undefined;
        const hasMetrics = metrics !== undefined;
        if ((hasObjectType || hasObjectIds || hasMetrics) && !(hasObjectType && hasObjectIds && hasMetrics)) {
          return {
            isError: true as const,
            content: [{
              type: 'text' as const,
              text: 'object_type, object_ids, and metrics must all be provided together. You cannot provide only a subset.',
            }],
          };
        }
        const result =
          object_type && object_ids && metrics
            ? await client.getAnalytics({
                date_from,
                date_to,
                object_type,
                object_ids,
                metrics: [...metrics],
                message_type,
              })
            : await client.getAnalytics({ date_from, date_to, message_type });
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
