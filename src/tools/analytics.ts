import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { errorResult, formatRuleErrorMessage, handleRuleError, jsonResult } from '../util/errors.js';

const OBJECT_TYPES = [
  'AB_TEST',
  'CAMPAIGN',
  'AUTOMAIL',
  'TRANSACTIONAL_NAME',
  'JOURNEY',
] as const;

const OBJECT_TYPE_GUIDANCE: Record<(typeof OBJECT_TYPES)[number], string> = {
  CAMPAIGN: 'one-off sends; use rule_list_campaigns for IDs',
  AUTOMAIL: 'triggered automation emails; use rule_list_automations for IDs',
  AB_TEST: 'A/B tested sends',
  TRANSACTIONAL_NAME: 'named transactional sends',
  JOURNEY: 'multi-step journey messages',
};

const OBJECT_TYPE_DESCRIPTION = OBJECT_TYPES.map(
  (type) => `${type} (${OBJECT_TYPE_GUIDANCE[type]})`,
).join(', ');

const GET_ANALYTICS_DESCRIPTION =
  'Get per-object email or text-message performance metrics. Requires object_type + object_ids + metrics to specify what to query. ' +
  `Set object_type to one of: ${OBJECT_TYPE_DESCRIPTION}. ` +
  'For an account-wide summary without object IDs, use rule_export_data with type "statistics" instead.';

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
export function normaliseDateFrom(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date} 00:00:00` : date;
}

/** Append ' 23:59:59' when only a YYYY-MM-DD date is provided (Rule.io API requires datetime). */
export function normaliseDateTo(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date} 23:59:59` : date;
}

/**
 * Shared Zod schema shape for the optional include_analytics param on
 * rule_get_campaign / rule_get_automation. Spread into the tool's
 * input schema (`include_analytics: includeAnalyticsSchema.optional()`).
 */
export const includeAnalyticsSchema = z
  .object({
    date_from: z
      .string()
      .describe('Start date — YYYY-MM-DD (auto-expanded to 00:00:00) or YYYY-MM-DD HH:mm:ss'),
    date_to: z
      .string()
      .describe('End date — YYYY-MM-DD (auto-expanded to 23:59:59) or YYYY-MM-DD HH:mm:ss'),
    metrics: z.array(z.enum(METRICS)).min(1).describe('Metrics to retrieve'),
    message_type: z
      .enum(MESSAGE_TYPES)
      .optional()
      .describe('Filter by message type (email or text_message)'),
  });

export type IncludeAnalyticsParams = z.infer<typeof includeAnalyticsSchema>;

type AnalyticsMergeObjectType = 'CAMPAIGN' | 'AUTOMAIL';

interface AnalyticsMergeSuccess {
  analytics: unknown[];
}
interface AnalyticsMergeFailure {
  analytics: [];
  analytics_error: string;
}
export type AnalyticsMergeResult = AnalyticsMergeSuccess | AnalyticsMergeFailure;

/**
 * Fetch analytics for a single object and return fields to merge into
 * a tool response. On success: `{ analytics }`. On failure: `{ analytics: [],
 * analytics_error }`, sanitised via formatRuleErrorMessage so auth /
 * rate-limit / validation errors match the main error path. Dates are
 * normalised the same way rule_get_analytics normalises them.
 */
export async function fetchAnalyticsFor(
  client: RuleClient,
  objectType: AnalyticsMergeObjectType,
  id: number,
  params: IncludeAnalyticsParams,
): Promise<AnalyticsMergeResult> {
  try {
    const response = await client.getAnalytics({
      date_from: normaliseDateFrom(params.date_from),
      date_to: normaliseDateTo(params.date_to),
      object_type: objectType,
      object_ids: [String(id)],
      metrics: [...params.metrics],
      message_type: params.message_type,
    });
    return { analytics: response.data?.[0]?.metrics ?? [] };
  } catch (error) {
    return {
      analytics: [],
      analytics_error: formatRuleErrorMessage(error),
    };
  }
}

export function registerAnalyticsTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_get_analytics',
    GET_ANALYTICS_DESCRIPTION,
    {
      date_from: z
        .string()
        .describe('Start date — YYYY-MM-DD (auto-expanded to 00:00:00) or YYYY-MM-DD HH:mm:ss'),
      date_to: z
        .string()
        .describe('End date — YYYY-MM-DD (auto-expanded to 23:59:59) or YYYY-MM-DD HH:mm:ss'),
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
          date_from: normaliseDateFrom(date_from),
          date_to: normaliseDateTo(date_to),
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
