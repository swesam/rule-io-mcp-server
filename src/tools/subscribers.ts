import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { RuleClient } from 'rule-io-sdk';
import { handleRuleError, jsonResult, textResult } from '../util/errors.js';

export function registerSubscriberTools(server: McpServer, client: RuleClient): void {
  server.tool(
    'rule_create_subscriber',
    'Create a new subscriber in Rule.io. Provide an email and optionally a phone number, language, and status.',
    {
      email: z.string().email().describe('Subscriber email address'),
      phone_number: z.string().optional().describe('Phone number (E.164 format preferred)'),
      language: z.string().optional().describe('Two-letter language code (e.g. "en", "sv")'),
      status: z
        .enum(['ACTIVE', 'BLOCKED', 'PENDING'])
        .optional()
        .describe('Subscriber status (default: ACTIVE)'),
    },
    async ({ email, phone_number, language, status }) => {
      try {
        const result = await client.createSubscriberV3({
          email,
          phone_number,
          language,
          status,
        });
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_get_subscriber',
    'Get a subscriber by email. Returns their profile info, all custom fields, and all tags in a single response.',
    {
      email: z.string().email().describe('Subscriber email address'),
    },
    async ({ email }) => {
      try {
        const [subscriber, fields, tags] = await Promise.all([
          client.getSubscriber(email),
          client.getSubscriberFields(email),
          client.getSubscriberTags(email),
        ]);

        if (!subscriber) {
          return textResult(`Subscriber "${email}" not found.`);
        }

        return jsonResult({
          subscriber,
          fields,
          tags,
        });
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_delete_subscriber',
    'Delete a subscriber from Rule.io. Can identify by email, ID, phone number, or custom identifier.',
    {
      subscriber: z.string().describe('Subscriber identifier (email, ID, or phone number)'),
      identified_by: z
        .enum(['email', 'id', 'phone_number', 'custom_identifier'])
        .optional()
        .default('email')
        .describe('How the subscriber is identified (default: email)'),
    },
    async ({ subscriber, identified_by }) => {
      try {
        const result = await client.deleteSubscriberV3(subscriber, identified_by);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_manage_subscriber_tags',
    'Add or remove tags from a single subscriber. When adding tags, you can optionally trigger automations associated with those tags.',
    {
      subscriber: z.string().describe('Subscriber identifier (email, ID, or phone number)'),
      identified_by: z
        .enum(['email', 'id', 'phone_number', 'custom_identifier'])
        .optional()
        .default('email')
        .describe('How the subscriber is identified (default: email)'),
      action: z.enum(['add', 'remove']).describe('"add" to add tags, "remove" to remove a tag'),
      tags: z
        .array(z.string())
        .describe('Tag names to add or remove (remove only supports one tag at a time)'),
      trigger_automation: z
        .enum(['force', 'reset'])
        .optional()
        .describe(
          'When adding tags: "force" always triggers automations, "reset" re-triggers with delay reset. Omit to not trigger.'
        ),
    },
    async ({ subscriber, identified_by, action, tags, trigger_automation }) => {
      try {
        if (action === 'add') {
          const result = await client.addSubscriberTagsV3(
            subscriber,
            { tags, automation: trigger_automation },
            identified_by
          );
          return jsonResult(result);
        } else {
          // Remove supports one tag at a time — loop through
          const results = [];
          for (const tag of tags) {
            const result = await client.removeSubscriberTagV3(subscriber, tag, identified_by);
            results.push({ tag, result });
          }
          return jsonResult(results);
        }
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );

  server.tool(
    'rule_bulk_manage_tags',
    'Add or remove tags for multiple subscribers at once. This is an async operation — Rule.io processes it in the background (max 1000 subscribers per call).',
    {
      action: z.enum(['add', 'remove']).describe('"add" to add tags, "remove" to remove tags'),
      tags: z.array(z.string()).describe('Tag names to add or remove'),
      subscribers: z
        .array(
          z.object({
            email: z.string().email().optional().describe('Subscriber email'),
            phone_number: z.string().optional().describe('Subscriber phone number'),
          })
        )
        .describe('Subscribers to modify (provide email or phone_number for each)'),
      trigger_automation: z
        .enum(['force', 'reset'])
        .optional()
        .describe('Only for "add": "force" always triggers, "reset" re-triggers with delay reset'),
    },
    async ({ action, tags, subscribers, trigger_automation }) => {
      try {
        const request = { tags, subscribers, automation: trigger_automation };
        const result =
          action === 'add'
            ? await client.bulkAddTags(request)
            : await client.bulkRemoveTags(request);
        return jsonResult(result);
      } catch (error) {
        return handleRuleError(error);
      }
    }
  );
}
