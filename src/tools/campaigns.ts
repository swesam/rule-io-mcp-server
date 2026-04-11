import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult, errorResult } from '../util/errors.js';
import { sectionsSchema, buildSectionsFromBlocks } from '../util/content-blocks.js';

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
    {
      name: z.string().describe('Campaign name (shown in Rule.io dashboard)'),
      subject: z.string().describe('Email subject line'),
      template: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Full RCML document object for advanced use. Most callers should use brand_style_id + sections instead. Provide this OR brand_style_id, not both.'
        ),
      brand_style_id: z
        .number()
        .optional()
        .describe(
          'Brand style ID to auto-generate an editor-compatible RCML template. Use rule_list_brand_styles to find available styles. Provide this OR template, not both.'
        ),
      sections: sectionsSchema.optional(),
      tags: z
        .array(
          z.object({
            id: z.number().describe('Tag ID'),
            negative: z
              .boolean()
              .optional()
              .default(false)
              .describe('If true, excludes subscribers with this tag'),
          })
        )
        .optional()
        .describe(
          'Tags to target as recipients. Use rule_list_tags to find tag IDs.'
        ),
      segments: z
        .array(
          z.object({
            id: z.number().describe('Segment ID'),
            negative: z
              .boolean()
              .optional()
              .default(false)
              .describe('If true, excludes subscribers in this segment'),
          })
        )
        .optional()
        .describe(
          'Segments to target as recipients. Use rule_list_segments to find segment IDs.'
        ),
      subscribers: z
        .array(z.number())
        .optional()
        .describe('Specific subscriber IDs to target'),
      preheader: z.string().optional().describe('Preview text shown in email inbox'),
      from_name: z.string().optional().describe('Sender display name'),
      from_email: z.string().optional().describe('Sender email address'),
      reply_to: z.string().optional().describe('Reply-to email address'),
      sendout_type: z
        .enum(['marketing', 'transactional'])
        .optional()
        .default('marketing')
        .describe(
          'Email type: "marketing" for campaigns/newsletters (default), "transactional" for order confirmations etc.'
        ),
    },
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
        const hasRecipients =
          (tags && tags.length > 0) ||
          (segments && segments.length > 0) ||
          (subscribers && subscribers.length > 0);
        if (!hasRecipients) {
          return errorResult(
            'At least one recipient is required: provide "tags", "segments", or "subscribers". Use rule_list_tags or rule_list_segments to find tag/segment IDs, or rule_get_subscriber (by email) to find subscriber IDs.'
          );
        }
        if (!template && !brand_style_id) {
          return errorResult(
            'Provide either "template" (RCML document) or "brand_style_id" to generate a template.'
          );
        }
        if (template && brand_style_id) {
          return errorResult(
            'Provide either "template" or "brand_style_id", not both.'
          );
        }

        const config: Parameters<typeof client.createCampaignEmail>[0] = {
          name,
          subject,
          preheader,
          fromName: from_name,
          fromEmail: from_email,
          replyTo: reply_to,
          sendoutType: sendout_type === 'transactional' ? 2 : 1,
          tags,
          segments,
          subscribers,
        };

        if (template) {
          // Cast: Zod accepts loose JSON for RCML; structural validation deferred to Rule.io API
          config.template = template as unknown as Parameters<typeof client.createCampaignEmail>[0]['template'];
        } else {
          config.brandStyleId = brand_style_id;
          if (sections) {
            // Cast: Zod accepts loose JSON for RCML; structural validation deferred to Rule.io API
            config.sections = buildSectionsFromBlocks(sections) as Parameters<typeof client.createCampaignEmail>[0]['sections'];
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
