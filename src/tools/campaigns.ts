import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

export function registerCampaignTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_create_campaign',
    'Create a new one-off email campaign. Campaigns are for sending to a list/segment at a specific time, unlike automations which trigger on subscriber actions.',
    {
      name: z.string().optional().describe('Campaign name (shown in Rule.io dashboard)'),
      sendout_type: z
        .enum(['marketing', 'transactional'])
        .optional()
        .default('marketing')
        .describe('Email type (default: marketing)'),
    },
    async ({ name, sendout_type }) => {
      try {
        const result = await client.createCampaign({
          name,
          message_type: 1, // email
          sendout_type: sendout_type === 'transactional' ? 2 : 1,
        });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_list_campaigns',
    'List email campaigns. Campaigns are one-off sends (vs automations which are triggered by subscriber actions).',
    {
      page: z.number().optional().default(1).describe('Page number (default: 1)'),
      per_page: z.number().optional().default(25).describe('Results per page (default: 25)'),
    },
    async ({ page, per_page }) => {
      try {
        const result = await client.listCampaigns({ page, per_page });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_get_campaign',
    'Get detailed information about a specific campaign by ID.',
    {
      id: z.number().describe('Campaign ID'),
    },
    async ({ id }) => {
      try {
        const result = await client.getCampaign(id);
        if (!result) {
          return textResult(`Campaign ${id} not found.`);
        }
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_update_campaign',
    'Update a campaign. Can change name, recipients, or sendout type.',
    {
      id: z.number().describe('Campaign ID to update'),
      name: z.string().optional().describe('New campaign name'),
      sendout_type: z
        .enum(['marketing', 'transactional'])
        .optional()
        .describe('Change email type'),
    },
    async ({ id, name, sendout_type }) => {
      try {
        const update: Record<string, unknown> = {};
        if (name) update.name = name;
        if (sendout_type) update.sendout_type = sendout_type === 'transactional' ? 2 : 1;

        const result = await client.updateCampaign(id, update);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_schedule_campaign',
    'Schedule, send immediately, or cancel scheduling for a campaign. Use "send_now" to send immediately, "schedule" to send at a specific time, or "cancel" to cancel a scheduled send.',
    {
      id: z.number().describe('Campaign ID'),
      action: z
        .enum(['send_now', 'schedule', 'cancel'])
        .describe('"send_now" to send immediately, "schedule" for a future time, "cancel" to cancel'),
      datetime: z
        .string()
        .optional()
        .describe('Datetime for scheduled send, e.g. "2025-06-15 10:00:00" (required when action is "schedule")'),
    },
    async ({ id, action, datetime }) => {
      try {
        if (action === 'schedule' && !datetime) {
          return textResult(
            'datetime is required when action is "schedule". Provide a datetime string like "2025-06-15 10:00:00".'
          );
        }

        const result = await client.scheduleCampaign(id, {
          type: action === 'send_now' ? 'now' : action === 'cancel' ? null : 'schedule',
          datetime,
        });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
