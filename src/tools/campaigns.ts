import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult, errorResult } from '../util/errors.js';
import { buildSectionsFromBlocks } from '../util/content-blocks.js';
import { createCampaignEmailBaseSchema, createCampaignEmailSchema } from './schemas.js';

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
    'rule_create_campaign_email',
    'Create a complete campaign email in one step. This sets up a campaign, message, template, and dynamic set — equivalent to 4 separate API calls. WARNING: Not idempotent — each call creates a new campaign. Do not retry on timeout without first checking rule_list_campaigns for duplicates. Provide a subject, recipients (tags/segments/subscribers), and either an RCML template document OR a brand_style_id with sections to auto-generate one. If any step fails, previously created resources are automatically cleaned up.',
    createCampaignEmailBaseSchema.shape,
    async ({
      name,
      subject,
      template,
      brand_style_id,
      sections,
      tags,
      segments,
      subscribers,
      preheader,
      from_name,
      from_email,
      reply_to,
      sendout_type,
    }) => {
      try {
        // Validate XOR constraint (template vs brand_style_id) via the
        // refined schema — the MCP tool registration uses .shape which
        // cannot carry superRefine, so we enforce it here at runtime.
        // We use xorResult.data below so that defaults/transforms from the
        // base schema (e.g. sectionsSchema normalisation) are applied.
        const xorResult = createCampaignEmailSchema.safeParse({
          name, subject, template, brand_style_id, sections,
          tags, segments, subscribers, preheader,
          from_name, from_email, reply_to, sendout_type,
        });
        if (!xorResult.success) {
          const uniqueMessages = [...new Set(xorResult.error.issues.map((i) => i.message))];
          return errorResult(uniqueMessages.join(' '));
        }

        const validated = xorResult.data;

        const hasRecipients =
          (validated.tags && validated.tags.length > 0) ||
          (validated.segments && validated.segments.length > 0) ||
          (validated.subscribers && validated.subscribers.length > 0);
        if (!hasRecipients) {
          return errorResult(
            'At least one recipient is required: provide "tags", "segments", or "subscribers". Use rule_list_tags or rule_list_segments to find tag/segment IDs, or rule_get_subscriber (by email) to find subscriber IDs.'
          );
        }

        const config: Parameters<typeof client.createCampaignEmail>[0] = {
          name: validated.name,
          subject: validated.subject,
          preheader: validated.preheader,
          fromName: validated.from_name,
          fromEmail: validated.from_email,
          replyTo: validated.reply_to,
          sendoutType: validated.sendout_type === 'transactional' ? 2 : 1,
          tags: validated.tags,
          segments: validated.segments,
          subscribers: validated.subscribers,
        };

        if (validated.template) {
          config.template = validated.template as unknown as Parameters<typeof client.createCampaignEmail>[0]['template'];
        } else {
          config.brandStyleId = validated.brand_style_id;
          if (validated.sections) {
            config.sections = buildSectionsFromBlocks(validated.sections) as Parameters<typeof client.createCampaignEmail>[0]['sections'];
          }
        }

        const result = await client.createCampaignEmail(config);

        return jsonResult({
          success: true,
          campaign_id: result.campaignId,
          message_id: result.messageId,
          template_id: result.templateId,
          dynamic_set_id: result.dynamicSetId,
        });
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_delete_campaign',
    'Delete a campaign by ID. This permanently removes the campaign.',
    {
      id: z.number().describe('Campaign ID to delete'),
    },
    async ({ id }) => {
      try {
        const result = await client.deleteCampaign(id);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_copy_campaign',
    'Duplicate an existing campaign. Returns the new campaign copy with a new ID.',
    {
      id: z.number().describe('Campaign ID to copy'),
    },
    async ({ id }) => {
      try {
        const result = await client.copyCampaign(id);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_list_segments',
    'List available segments for campaign targeting. Segments are predefined subscriber groups based on filters/rules.',
    {
      page: z.number().optional().default(1).describe('Page number (default: 1)'),
      per_page: z.number().optional().default(25).describe('Results per page (default: 25)'),
    },
    async ({ page, per_page }) => {
      try {
        const result = await client.listSegments({ page, per_page });
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
          return errorResult(
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
