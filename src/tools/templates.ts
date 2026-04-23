import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RuleApiError, type RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

// Helper: resolve template_id for a message by checking its dynamic sets
async function resolveTemplateIdForMessage(client: RuleClient, messageId: number): Promise<number | null> {
  const dynamicSets = await client.listDynamicSets({ message_id: messageId });
  if (dynamicSets.data && dynamicSets.data.length > 0) {
    // Return the first template_id found
    return dynamicSets.data[0].template_id ?? null;
  }
  return null;
}

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
          // Cast: Zod accepts loose JSON for RCML; structural validation deferred to Rule.io API
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

  server.tool(
    'rule_find_template_usage',
    'Find campaigns and automations that use a given template. Expensive on large accounts — fetches all campaigns and automations, then resolves their messages. Consider caching.',
    {
      id: z.number().describe('Template ID'),
    },
    async ({ id }) => {
      try {
        const campaigns: Array<{ id: number; name: string; subject?: string; status?: string }> = [];
        const automations: Array<{ id: number; name: string; active?: boolean; trigger_type?: string }> = [];
        const partialErrors: Array<{
          kind: 'campaign' | 'automation';
          id: number;
          message_id?: number;
          error: string;
        }> = [];

        let campaignsScanned = 0;
        let automationsScanned = 0;

        // List all campaigns with pagination
        let campaignPage = 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const campaignList = await client.listCampaigns({ page: campaignPage, per_page: 100 });
          if (!campaignList.data || campaignList.data.length === 0) break;

          for (const campaign of campaignList.data) {
            campaignsScanned += 1;
            if (!campaign.id) continue;

            try {
              // List messages for this campaign
              const messages = await client.listMessages({
                id: campaign.id,
                dispatcher_type: 'campaign',
              });

              if (messages.data && messages.data.length > 0) {
                for (const message of messages.data) {
                  if (!message.id) continue;

                  try {
                    const templateId = await resolveTemplateIdForMessage(client, message.id);
                    if (templateId === id) {
                      campaigns.push({
                        id: campaign.id,
                        name: campaign.name,
                        subject: message.subject,
                        status: campaign.status?.toString(),
                      });
                      break; // Found the template for this campaign, no need to check other messages
                    }
                  } catch (error) {
                    partialErrors.push({
                      kind: 'campaign',
                      id: campaign.id,
                      message_id: message.id,
                      error: error instanceof Error ? error.message : String(error),
                    });
                  }
                }
              }
            } catch (error) {
              partialErrors.push({
                kind: 'campaign',
                id: campaign.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Check if there are more pages
          if (!campaignList.data || campaignList.data.length < 100) break;
          campaignPage += 1;
        }

        // List all automations with pagination
        let automationPage = 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const automationList = await client.listAutomations({ page: automationPage, per_page: 100 });
          if (!automationList.data || automationList.data.length === 0) break;

          for (const automation of automationList.data) {
            automationsScanned += 1;
            if (!automation.id) continue;

            try {
              // List messages for this automation (dispatcher_type is 'automail')
              const messages = await client.listMessages({
                id: automation.id,
                dispatcher_type: 'automail',
              });

              if (messages.data && messages.data.length > 0) {
                for (const message of messages.data) {
                  if (!message.id) continue;

                  try {
                    const templateId = await resolveTemplateIdForMessage(client, message.id);
                    if (templateId === id) {
                      automations.push({
                        id: automation.id,
                        name: automation.name,
                        active: automation.active,
                        trigger_type: automation.trigger?.type,
                      });
                      break; // Found the template for this automation, no need to check other messages
                    }
                  } catch (error) {
                    partialErrors.push({
                      kind: 'automation',
                      id: automation.id,
                      message_id: message.id,
                      error: error instanceof Error ? error.message : String(error),
                    });
                  }
                }
              }
            } catch (error) {
              partialErrors.push({
                kind: 'automation',
                id: automation.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Check if there are more pages
          if (!automationList.data || automationList.data.length < 100) break;
          automationPage += 1;
        }

        const result: Record<string, unknown> = {
          template_id: id,
          campaigns,
          automations,
          scanned: {
            campaigns: campaignsScanned,
            automations: automationsScanned,
          },
        };

        if (partialErrors.length > 0) {
          result.partial_errors = partialErrors;
        }

        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
