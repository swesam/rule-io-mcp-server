import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

export function registerTagTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_list_tags',
    'List all tags in your Rule.io account. Tags trigger automations and segment subscribers. Returns each tag with its numeric ID (needed for automation setup).',
    {},
    async () => {
      try {
        const response = await client.getTags();
        const tags = (response as { data?: Array<{ id: number; name: string }> }).data ?? [];
        return jsonResult(tags);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_find_tag',
    "Find a tag's numeric ID by name. You need tag IDs to set up automation triggers. Returns the tag ID or a not-found message.",
    { name: z.string().describe('Tag name to look up (exact match)') },
    async ({ name }) => {
      try {
        const id = await client.getTagIdByName(name);
        if (id === null) {
          return textResult(
            `Tag "${name}" not found. Use rule_list_tags to see all available tags.`
          );
        }
        return jsonResult({ id, name });
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
