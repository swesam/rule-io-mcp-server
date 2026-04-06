import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

export function registerAutomationTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_create_automation_email',
    'Create a complete email automation in one step. This sets up an automail, message, template, and dynamic set — equivalent to 4 separate API calls. Provide a trigger tag name, email subject, and RCML template document. If any step fails, previously created resources are automatically cleaned up.',
    {
      name: z.string().describe('Automation name (shown in Rule.io dashboard)'),
      trigger_tag: z
        .string()
        .describe(
          'Tag name that triggers this automation. The tag must already exist — use rule_list_tags to see available tags.'
        ),
      subject: z.string().describe('Email subject line'),
      template: z
        .record(z.any())
        .describe('RCML document object for the email template content'),
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
      description,
      preheader,
      from_name,
      from_email,
      reply_to,
      sendout_type,
    }) => {
      try {
        // Resolve tag name to ID
        const tagId = await client.getTagIdByName(trigger_tag);
        if (tagId === null) {
          return textResult(
            `Tag "${trigger_tag}" not found. Use rule_list_tags to see available tags, or create the tag in Rule.io first.`
          );
        }

        const result = await client.createAutomationEmail({
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
          template: template as Parameters<typeof client.createAutomationEmail>[0]['template'],
        });

        return jsonResult({
          success: true,
          automail_id: result.automailId,
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
    'rule_list_automails',
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
        const result = await client.listAutomails({
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
    'rule_get_automail',
    'Get detailed information about a specific automation by ID. Returns trigger, message, and status information.',
    {
      id: z.number().describe('Automail ID'),
    },
    async ({ id }) => {
      try {
        const result = await client.getAutomail(id);
        if (!result) {
          return textResult(`Automail ${id} not found.`);
        }
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_update_automail',
    'Update an existing automation. Can change its active status, trigger, or sendout type.',
    {
      id: z.number().describe('Automail ID to update'),
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
        const update: Record<string, unknown> = {};
        if (active !== undefined) update.active = active;
        if (sendout_type) update.sendout_type = sendout_type === 'marketing' ? 1 : 2;
        if (trigger_type && trigger_id) {
          update.trigger = { type: trigger_type.toUpperCase(), id: trigger_id };
        }

        const result = await client.updateAutomail(id, update);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
