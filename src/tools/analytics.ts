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
    'Get email or text-message performance metrics. Call with just date_from and date_to for an account-wide summary (returns totals for all sends in the period — no object IDs needed). For a per-object breakdown, also provide object_type + object_ids + metrics (all three required together). Use rule_list_campaigns (object_type CAMPAIGN) or rule_list_automations (object_type AUTOMAIL) to find IDs first.',
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
          return errorResult(
            'object_type, object_ids, and metrics must all be provided together. You cannot provide only a subset.',
          );
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
