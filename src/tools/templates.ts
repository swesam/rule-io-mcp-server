import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RuleApiError, type RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

/**
 * Systemic errors (auth, rate limit) should abort the scan — continuing
 * would burn API calls on subsequent items that will also fail and
 * surface as a misleading "successful" partial response.
 */
function isSystemicRuleApiError(error: unknown): boolean {
  return error instanceof RuleApiError && (error.isAuthError() || error.isRateLimited());
}

/**
 * Build the error fields for a partial_errors entry. Returns both a
 * human-readable `error` string and, for RuleApiError, a separate
 * `status_code` number so callers can distinguish 4xx from 5xx without
 * parsing the message text.
 */
function toPartialErrorFields(
  error: unknown,
): { error: string; status_code?: number } {
  if (error instanceof RuleApiError) {
    return {
      error: `Rule.io API error (${error.statusCode}): ${error.message}`,
      status_code: error.statusCode,
    };
  }
  return { error: error instanceof Error ? error.message : String(error) };
}

// Helper: resolve template_id for a message by checking its dynamic sets.
// Scans every dynamic set returned for the message and returns the first
// one that carries a non-null template_id, since earlier entries can have
// template_id undefined while later entries carry the real value.
async function resolveTemplateIdForMessage(client: RuleClient, messageId: number): Promise<number | null> {
  const dynamicSets = await client.listDynamicSets({ message_id: messageId });
  if (!dynamicSets.data || dynamicSets.data.length === 0) {
    return null;
  }
  for (const dynamicSet of dynamicSets.data) {
    if (dynamicSet.template_id != null) {
      return dynamicSet.template_id;
    }
  }
  return null;
}

type UsageKind = 'campaign' | 'automation';

interface DispatcherLike {
  id?: number;
}

interface MessageLike {
  id?: number;
  subject?: string;
}

interface PartialError {
  kind: UsageKind;
  id: number;
  message_id?: number;
  /** HTTP status code when the underlying failure is a RuleApiError. */
  status_code?: number;
  error: string;
}

interface CampaignOwner {
  kind: 'campaign';
  id: number;
  name?: string;
  subject?: string;
  status?: string;
}

interface AutomationOwner {
  kind: 'automation';
  id: number;
  name?: string;
  active?: boolean;
  trigger_type?: string;
}

type TemplateOwner = CampaignOwner | AutomationOwner;

interface ScanDispatchersOptions<D extends DispatcherLike, R> {
  kind: UsageKind;
  templateId: number;
  /** Fetch one page of dispatchers (1-indexed). Returns `{ data }` shape. */
  listPage: (page: number, perPage: number) => Promise<{ data?: D[] }>;
  /** Value passed as `dispatcher_type` when listing messages for each item. */
  dispatcherType: 'campaign' | 'automail';
  /** Project the dispatcher + matching message into the usage-result item. */
  toResult: (dispatcher: D, message: MessageLike) => R;
}

/**
 * Paginate `listPage` and, for each dispatcher, resolve whether any of its
 * messages reference `templateId`. Each template has at most one owning
 * campaign or automation (the reverse is not required — a dispatcher may
 * exist without a template), so the scan stops at the first match — inner
 * message loop, outer dispatcher loop, and the page loop all terminate.
 * Returns the match (or `null`) and the number of dispatchers scanned;
 * per-item failures are appended to the shared `partialErrors` array
 * rather than aborting the scan.
 */
async function scanDispatchersForTemplate<D extends DispatcherLike, R>(
  client: RuleClient,
  options: ScanDispatchersOptions<D, R>,
  partialErrors: PartialError[],
): Promise<{ match: R | null; scanned: number }> {
  const { kind, templateId, listPage, dispatcherType, toResult } = options;
  const PER_PAGE = 100;

  let match: R | null = null;
  let scanned = 0;
  let page = 1;

  pageLoop: while (true) {
    const result = await listPage(page, PER_PAGE);
    if (!result.data || result.data.length === 0) break;

    for (const dispatcher of result.data) {
      if (dispatcher.id == null) continue;
      scanned += 1;

      try {
        const messages = await client.listMessages({
          id: dispatcher.id,
          dispatcher_type: dispatcherType,
        });
        if (!messages.data || messages.data.length === 0) continue;

        for (const message of messages.data) {
          if (message.id == null) continue;
          try {
            const resolvedTemplateId = await resolveTemplateIdForMessage(client, message.id);
            if (resolvedTemplateId === templateId) {
              match = toResult(dispatcher, message);
              break pageLoop;
            }
          } catch (error) {
            // Auth / rate-limit failures are systemic — continuing would
            // hammer the API and return a misleading "successful" response.
            // Let them bubble up so handleRuleError produces a proper
            // error result. Other RuleApiErrors record statusCode for debugging.
            if (isSystemicRuleApiError(error)) throw error;
            partialErrors.push({
              kind,
              id: dispatcher.id,
              message_id: message.id,
              ...toPartialErrorFields(error),
            });
          }
        }
      } catch (error) {
        if (isSystemicRuleApiError(error)) throw error;
        partialErrors.push({
          kind,
          id: dispatcher.id,
          ...toPartialErrorFields(error),
        });
      }
    }

    if (result.data.length < PER_PAGE) break;
    page += 1;
  }

  return { match, scanned };
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
    'Find the single campaign or automation that owns a given template. Returns { owner: null } if the template is unused (including orphaned templates pending Rule.io\'s CRON cleanup). Rule.io has no direct template→owner endpoint, so this scans dispatchers in order (campaigns first, then automations) and stops at the first match. Typical accounts: one full dispatcher list is scanned. Worst case (unowned template): full scan of both lists.',
    {
      id: z.number().describe('Template ID'),
    },
    async ({ id }) => {
      try {
        const partialErrors: PartialError[] = [];

        const { match: campaignOwner, scanned: campaignsScanned } = await scanDispatchersForTemplate(
          client,
          {
            kind: 'campaign',
            templateId: id,
            listPage: (page, per_page) => client.listCampaigns({ page, per_page }),
            dispatcherType: 'campaign',
            toResult: (campaign, message): CampaignOwner => ({
              kind: 'campaign',
              id: campaign.id as number,
              name: campaign.name,
              subject: message.subject,
              status: campaign.status?.toString(),
            }),
          },
          partialErrors,
        );

        let owner: TemplateOwner | null = campaignOwner;
        let automationsScanned = 0;

        // Each template has at most one owner, so a campaign match rules out
        // any automation match — skip the automations pass entirely.
        if (!owner) {
          const { match: automationOwner, scanned } = await scanDispatchersForTemplate(
            client,
            {
              kind: 'automation',
              templateId: id,
              listPage: (page, per_page) => client.listAutomations({ page, per_page }),
              dispatcherType: 'automail',
              toResult: (automation, _message): AutomationOwner => ({
                kind: 'automation',
                id: automation.id as number,
                name: automation.name,
                active: automation.active,
                trigger_type: automation.trigger?.type,
              }),
            },
            partialErrors,
          );
          owner = automationOwner;
          automationsScanned = scanned;
        }

        const result: Record<string, unknown> = {
          template_id: id,
          owner,
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
