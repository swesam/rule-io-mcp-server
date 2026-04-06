import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

export function registerAdminTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_list_brand_styles',
    'List all brand styles in your Rule.io account. Brand styles define the visual identity (colors, fonts, logo) applied to email templates.',
    {},
    async () => {
      try {
        const result = await client.listBrandStyles();
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_manage_brand_style',
    'Create, update, or delete a brand style. Use "create_from_domain" to automatically extract branding from a website URL, "create_manual" to set colors/fonts/logo directly, "update" to modify, or "delete" to remove.',
    {
      action: z
        .enum(['create_from_domain', 'create_manual', 'update', 'delete'])
        .describe('Operation to perform'),
      id: z
        .number()
        .optional()
        .describe('Brand style ID (required for update and delete)'),
      domain: z
        .string()
        .optional()
        .describe('Website URL to extract branding from (for create_from_domain)'),
      name: z.string().optional().describe('Brand style name'),
    },
    async ({ action, id, domain, name }) => {
      try {
        switch (action) {
          case 'create_from_domain': {
            if (!domain) {
              return textResult('domain is required for create_from_domain action.');
            }
            const result = await client.createBrandStyleFromDomain({ domain });
            return jsonResult(result);
          }
          case 'create_manual': {
            if (!name) {
              return textResult('name is required for create_manual action.');
            }
            const result = await client.createBrandStyleManually({
              name,
            });
            return jsonResult(result);
          }
          case 'update': {
            if (!id) {
              return textResult('id is required for update action.');
            }
            const update: Record<string, unknown> = {};
            if (name) update.name = name;
            const result = await client.updateBrandStyle(id, update);
            return jsonResult(result);
          }
          case 'delete': {
            if (!id) {
              return textResult('id is required for delete action.');
            }
            const result = await client.deleteBrandStyle(id);
            return jsonResult(result);
          }
        }
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_suppress_subscribers',
    'Suppress subscribers from receiving emails. This is an async operation processed in the background (max 1000 per call).',
    {
      subscribers: z
        .array(
          z.object({
            email: z.string().optional().describe('Subscriber email'),
            phone_number: z.string().optional().describe('Subscriber phone number'),
          })
        )
        .describe('Subscribers to suppress'),
    },
    async ({ subscribers }) => {
      try {
        const result = await client.createSuppressions({ subscribers });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_unsuppress_subscribers',
    'Remove suppression from subscribers, allowing them to receive emails again. Async operation (max 1000 per call).',
    {
      subscribers: z
        .array(
          z.object({
            email: z.string().optional().describe('Subscriber email'),
            phone_number: z.string().optional().describe('Subscriber phone number'),
          })
        )
        .describe('Subscribers to unsuppress'),
    },
    async ({ subscribers }) => {
      try {
        const result = await client.deleteSuppressions({ subscribers });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
