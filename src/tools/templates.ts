import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RuleApiError, type RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

export function registerTemplateTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_create_template',
    'Create an RCML email template linked to a message. If the name is already taken, a timestamp suffix is appended automatically.',
    {
      name: z.string().describe('Template name'),
      message_id: z.number().describe('Message ID to link this template to'),
      content: z.record(z.string(), z.unknown()).describe('RCML document object for the email content'),
    },
    async ({ name, message_id, content }) => {
      try {
        const templatePayload = {
          name,
          message_id,
          message_type: 'email' as const,
          template: content as unknown as Parameters<typeof client.createTemplate>[0]['template'],
        };
        try {
          const result = await client.createTemplate(templatePayload);
          return jsonResult(result);
        } catch (error) {
          // Retry with timestamp only if the name field specifically failed
          if (
            error instanceof RuleApiError &&
            error.isValidationError() &&
            error.validationErrors?.name
          ) {
            templatePayload.name = `${name} - ${Date.now()}`;
            const result = await client.createTemplate(templatePayload);
            return jsonResult(result);
          }
          throw error;
        }
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

  server.tool(
    'rule_get_template',
    'Get detailed information about a specific template by ID. Returns the template name, linked message, and RCML content.',
    {
      id: z.number().describe('Template ID'),
    },
    async ({ id }) => {
      try {
        const result = await client.getTemplate(id);
        if (!result) {
          return textResult(`Template ${id} not found.`);
        }
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_delete_template',
    'Delete a template by ID. This permanently removes the template.',
    {
      id: z.number().describe('Template ID to delete'),
    },
    async ({ id }) => {
      try {
        const result = await client.deleteTemplate(id);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
