import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient, RuleBrandStyleCreateRequest } from 'rule-io-sdk';
import { handleRuleError, jsonResult, errorResult } from '../util/errors.js';

const subscriberIdentifier = z
  .object({
    email: z.string().email().optional().describe('Subscriber email'),
    phone_number: z.string().optional().describe('Subscriber phone number'),
  })
  .refine(
    ({ email, phone_number }) => Boolean(email || phone_number),
    'Each subscriber must include at least one of email or phone_number'
  );

const colourSchema = z.object({
  type: z
    .enum(['accent', 'dark', 'light', 'brand', 'side'])
    .describe('Colour role: accent (buttons), dark (text), light (fallback bg), brand (primary), side (body bg)'),
  hex: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Hex colour must be in the format #RGB or #RRGGBB')
    .describe('Hex colour value, e.g. "#FF6600"'),
  brightness: z.number().int().min(0).max(255).describe('Brightness value 0-255'),
});

const fontSchema = z.object({
  type: z.enum(['title', 'body']).describe('Font role: title (headings) or body (paragraphs)'),
  name: z.string().describe('Font display name, e.g. "Inter"'),
  origin: z
    .enum(['google', 'system'])
    .describe('Font source: google (Google Fonts) or system (system font stack). Custom font uploads are not supported via MCP.'),
  origin_id: z.string().optional().describe('Font identifier at origin (e.g. Google Fonts ID)'),
  weights: z.array(z.string()).optional().describe('Available weights, e.g. ["400", "700"]'),
});

const linkSchema = z.object({
  type: z
    .enum([
      'instagram', 'facebook', 'twitter', 'github', 'youtube',
      'linkedin', 'crunchbase', 'website', 'pinterest', 'tiktok',
    ])
    .describe('Social link type'),
  link: z.string().describe('Full URL'),
});

export function registerAdminTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_list_brand_styles',
    'List all brand styles in your Rule.io account. Returns summary info (id, name, is_default). Use rule_get_brand_style to inspect full details (colours, fonts, logo, links).',
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
    'rule_get_brand_style',
    'Get full details of a brand style including colours, fonts, images (logo), and social links. Use this to inspect the visual identity before generating templates.',
    {
      id: z.number().describe('Brand style ID'),
    },
    async ({ id }) => {
      try {
        const result = await client.getBrandStyle(id);
        if (!result) {
          return errorResult(`Brand style with id ${id} not found.`);
        }
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_manage_brand_style',
    'Create, update, or delete a brand style. Use "create_from_domain" to automatically extract branding from a website URL, "create_manual" to set colours/fonts/links directly, "update" to modify visual properties, or "delete" to remove. Note: image/logo uploads are not supported — use create_from_domain or the Rule.io UI for logos.',
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
      description: z.string().optional().describe('Brand style description'),
      is_default: z.boolean().optional().describe('Set as the default brand style'),
      colours: z
        .array(colourSchema)
        .optional()
        .describe('Brand colours (for create_manual and update)'),
      fonts: z
        .array(fontSchema)
        .optional()
        .describe('Brand fonts — Google or system fonts only (for create_manual and update)'),
      links: z
        .array(linkSchema)
        .optional()
        .describe('Social media / website links (for create_manual and update)'),
    },
    async ({ action, id, domain, name, description, is_default, colours, fonts, links }) => {
      try {
        switch (action) {
          case 'create_from_domain': {
            if (!domain) {
              return errorResult('domain is required for create_from_domain action.');
            }
            const result = await client.createBrandStyleFromDomain({ domain });
            return jsonResult(result);
          }
          case 'create_manual': {
            if (!name) {
              return errorResult('name is required for create_manual action.');
            }
            const request: RuleBrandStyleCreateRequest = { name };
            if (description !== undefined) request.description = description;
            if (is_default !== undefined) request.is_default = is_default;
            if (colours !== undefined) request.colours = colours;
            if (fonts !== undefined) request.fonts = fonts;
            if (links !== undefined) request.links = links;
            const result = await client.createBrandStyleManually(request);
            return jsonResult(result);
          }
          case 'update': {
            if (id === undefined) {
              return errorResult('id is required for update action.');
            }
            const update: Record<string, unknown> = {};
            if (name !== undefined) update.name = name;
            if (description !== undefined) update.description = description;
            if (is_default !== undefined) update.is_default = is_default;
            if (colours !== undefined) update.colours = colours;
            if (fonts !== undefined) update.fonts = fonts;
            if (links !== undefined) update.links = links;
            const result = await client.updateBrandStyle(id, update);
            return jsonResult(result);
          }
          case 'delete': {
            if (id === undefined) {
              return errorResult('id is required for delete action.');
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
        .array(subscriberIdentifier)
        .describe('Subscribers to suppress (each must have email or phone_number)'),
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
        .array(subscriberIdentifier)
        .describe('Subscribers to unsuppress (each must have email or phone_number)'),
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
