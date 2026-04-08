import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult, errorResult } from '../util/errors.js';
import { sectionsSchema, buildSectionsFromBlocks } from '../util/content-blocks.js';
import { automationUrl } from '../util/urls.js';

export function registerAutomationTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_create_automation_email',
    'Create a complete email automation in one step. This sets up an automation, message, template, and dynamic set — equivalent to 4 separate API calls. WARNING: Not idempotent — each call creates a new automation. Do not retry on timeout without first checking rule_list_automations for duplicates. Provide a trigger tag name, email subject, and either an RCML template document OR a brand_style_id with sections to auto-generate one. If any step fails, previously created resources are automatically cleaned up. Always show the dashboard link from the response to the user.',
    {
      name: z.string().describe('Automation name (shown in Rule.io dashboard)'),
      trigger_tag: z
        .string()
        .describe(
          'Tag name that triggers this automation. The tag must already exist — use rule_list_tags to see available tags.'
        ),
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
      description: z.string().optional().describe('Description of this automation'),
      preheader: z.string().optional().describe('Preview text shown in email inbox'),
      from_name: z.string().optional().describe('Sender display name'),
      from_email: z.string().optional().describe('Sender email address'),
      reply_to: z.string().optional().describe('Reply-to email address'),
      sendout_type: z
        .enum(['marketing', 'transactional'])
        .optional()
        .default('transactional')
        .describe(
          'Email type: "marketing" for campaigns/newsletters, "transactional" for order confirmations etc. (default: transactional)'
        ),
    },
    async ({
      name,
      trigger_tag,
      subject,
      template,
      brand_style_id,
      sections,
      description,
      preheader,
      from_name,
      from_email,
      reply_to,
      sendout_type,
    }) => {
      try {
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

        // Resolve tag name to ID
        const tagId = await client.getTagIdByName(trigger_tag);
        if (tagId === null) {
          return errorResult(
            `Tag "${trigger_tag}" not found. Use rule_list_tags to see available tags, or create the tag in Rule.io first.`
          );
        }

        const config: Parameters<typeof client.createAutomationEmail>[0] = {
          name,
          description,
          triggerType: 'tag',
          triggerValue: trigger_tag,
          subject,
          preheader,
          fromName: from_name,
          fromEmail: from_email,
          replyTo: reply_to,
          sendoutType: sendout_type === 'marketing' ? 1 : 2,
        };

        if (template) {
          config.template = template as unknown as Parameters<typeof client.createAutomationEmail>[0]['template'];
        } else {
          config.brandStyleId = brand_style_id;
          if (sections) {
            config.sections = buildSectionsFromBlocks(sections) as Parameters<typeof client.createAutomationEmail>[0]['sections'];
          }
        }

        const result = await client.createAutomationEmail(config);

        const url = automationUrl(result.automationId, result.messageId);
        return jsonResult({
          success: true,
          automation_id: result.automationId,
          message_id: result.messageId,
          template_id: result.templateId,
          dynamic_set_id: result.dynamicSetId,
        }, url);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_list_automations',
    'List email automations in your Rule.io account. Returns automation name, status, and trigger info.',
    {
      active: z
        .boolean()
        .optional()
        .describe('Filter by active status (true = active, false = paused)'),
      query: z.string().optional().describe('Search by automation name'),
      page: z.number().optional().default(1).describe('Page number (default: 1)'),
      per_page: z.number().optional().default(25).describe('Results per page (default: 25)'),
    },
    async ({ active, query, page, per_page }) => {
      try {
        const result = await client.listAutomations({
          active,
          query,
          page,
          per_page,
        });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_get_automation',
    'Get detailed information about a specific automation by ID. Returns trigger, message, and status information.',
    {
      id: z.number().describe('Automation ID'),
    },
    async ({ id }) => {
      try {
        const result = await client.getAutomation(id);
        if (!result) {
          return textResult(`Automation ${id} not found.`);
        }
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_update_automation',
    'Update an existing automation. Can change its active status, trigger, or sendout type.',
    {
      id: z.number().describe('Automation ID to update'),
      active: z.boolean().optional().describe('Set automation active (true) or paused (false)'),
      sendout_type: z
        .enum(['marketing', 'transactional'])
        .optional()
        .describe('Change email type'),
      trigger_type: z
        .enum(['tag', 'segment'])
        .optional()
        .describe('Trigger type'),
      trigger_id: z.number().optional().describe('Tag or segment ID for the trigger'),
    },
    async ({ id, active, sendout_type, trigger_type, trigger_id }) => {
      try {
        const hasTriggerType = trigger_type !== undefined;
        const hasTriggerId = trigger_id !== undefined;
        if (hasTriggerType !== hasTriggerId) {
          return errorResult('trigger_type and trigger_id must be provided together.');
        }

        const update: Record<string, unknown> = {};
        if (active !== undefined) update.active = active;
        if (sendout_type) update.sendout_type = sendout_type === 'marketing' ? 1 : 2;
        if (hasTriggerType && hasTriggerId) {
          update.trigger = { type: trigger_type!.toUpperCase(), id: trigger_id };
        }

        const result = await client.updateAutomation(id, update);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_delete_automation',
    'Delete an automation by ID. This permanently removes the automation and stops any future triggers.',
    {
      id: z.number().describe('Automation ID to delete'),
    },
    async ({ id }) => {
      try {
        const result = await client.deleteAutomation(id);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
