import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

export function registerTemplateTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_create_template',
    'Create an RCML email template linked to a message. Template names must be unique in Rule.io — a timestamp is automatically appended to avoid conflicts.',
    {
      name: z.string().describe('Template name'),
      message_id: z.number().describe('Message ID to link this template to'),
      template: z.record(z.any()).describe('RCML document object for the email content'),
    },
    async ({ name, message_id, template }) => {
      try {
        const uniqueName = `${name} - ${Date.now()}`;
        const result = await client.createTemplate({
          name: uniqueName,
          message_id,
          message_type: 'email',
          template: template as Parameters<typeof client.createTemplate>[0]['template'],
        });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_list_templates',
    'List available email templates. Returns template IDs, names, and linked message IDs.',
    {
      page: z.number().optional().default(1).describe('Page number (default: 1)'),
      per_page: z.number().optional().default(25).describe('Results per page (default: 25)'),
    },
    async ({ page, per_page }) => {
      try {
        const result = await client.listTemplates({ page, per_page });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_render_template',
    'Render a template to HTML. Optionally provide a subscriber ID to substitute merge tags (e.g. {{Booking.FirstName}}) with real subscriber data.',
    {
      id: z.number().describe('Template ID to render'),
      subscriber_id: z
        .number()
        .optional()
        .describe('Subscriber ID for merge tag substitution'),
    },
    async ({ id, subscriber_id }) => {
      try {
        const html = await client.renderTemplate(id, {
          subscriber_id,
        });
        if (html === null) {
          return textResult(`Template ${id} not found.`);
        }
        return textResult(html);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
