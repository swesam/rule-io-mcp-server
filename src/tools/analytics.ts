import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { errorResult, handleRuleError, jsonResult } from '../util/errors.js';

const OBJECT_TYPES = [
  'AB_TEST',
  'CAMPAIGN',
  'AUTOMAIL',
  'TRANSACTIONAL_NAME',
  'JOURNEY',
] as const;

export const METRICS = [
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

export const MESSAGE_TYPES = ['email', 'text_message'] as const;

/** Append ' 00:00:00' when only a YYYY-MM-DD date is provided (Rule.io API requires datetime). */
function normaliseDateFrom(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date} 00:00:00` : date;
}

/** Append ' 23:59:59' when only a YYYY-MM-DD date is provided (Rule.io API requires datetime). */
function normaliseDateTo(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date} 23:59:59` : date;
}

export function registerAnalyticsTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_get_analytics',
    'Get per-object email or text-message performance metrics. Requires object_type + object_ids + metrics to specify what to query. Set object_type to CAMPAIGN or AUTOMAIL as appropriate, and use rule_list_campaigns or rule_list_automations to find IDs first. For an account-wide summary without object IDs, use rule_export_data with type "statistics" instead.',
    {
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      object_type: z
        .enum(OBJECT_TYPES)
        .describe('Type of object to query'),
      object_ids: z
        .array(z.string())
        .min(1)
        .describe('IDs of the objects to query (as strings)'),
      metrics: z
        .array(z.enum(METRICS))
        .min(1)
        .describe('Metrics to retrieve'),
      message_type: z
        .enum(MESSAGE_TYPES)
        .optional()
        .describe('Filter by message type (email or text_message)'),
    },
    async ({ date_from, date_to, object_type, object_ids, metrics, message_type }) => {
      try {
        if (!object_type || !object_ids?.length || !metrics?.length) {
          return errorResult(
            'object_type, object_ids (non-empty), and metrics (non-empty) are all required. For account-wide summaries use rule_export_data with type "statistics".',
          );
        }
        const result = await client.getAnalytics({
          date_from,
          date_to,
          object_type,
          object_ids,
          metrics: [...metrics],
          message_type,
        });
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
      date_from: z.string().describe('Start date — YYYY-MM-DD (auto-expanded to 00:00:00) or YYYY-MM-DD HH:mm:ss'),
      date_to: z
        .string()
        .describe('End date — YYYY-MM-DD (auto-expanded to 23:59:59) or YYYY-MM-DD HH:mm:ss. For dispatchers, max 1-day range.'),
      next_page_token: z
        .string()
        .optional()
        .describe('Token from previous export for pagination (statistics only)'),
    },
    async ({ type, date_from, date_to, next_page_token }) => {
      try {
        const from = normaliseDateFrom(date_from);
        const to = normaliseDateTo(date_to);
        let result;
        switch (type) {
          case 'dispatchers':
            result = await client.exportDispatchers({ date_from: from, date_to: to });
            break;
          case 'statistics':
            result = await client.exportStatistics({
              date_from: from,
              date_to: to,
              next_page_token,
            });
            break;
          case 'subscribers':
            result = await client.exportSubscribers({ date_from: from, date_to: to });
            break;
        }
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
