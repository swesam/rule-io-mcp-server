import { z } from 'zod';
import { sectionsSchema } from '../util/content-blocks.js';

// ---------------------------------------------------------------------------
// Extracted tool input schemas — importable for direct .safeParse() testing
// ---------------------------------------------------------------------------

/** Schema for rule_create_subscriber tool inputs. */
export const createSubscriberSchema = z.object({
  email: z.string().email().describe('Subscriber email address'),
  phone_number: z.string().optional().describe('Phone number (E.164 format preferred)'),
  language: z.string().optional().describe('Two-letter language code (e.g. "en", "sv")'),
  status: z
    .enum(['ACTIVE', 'BLOCKED', 'PENDING'])
    .optional()
    .describe('Subscriber status (default: ACTIVE)'),
});

/** Schema for rule_manage_subscriber_tags tool inputs. */
export const manageSubscriberTagsSchema = z.object({
  subscriber: z.string().describe('Subscriber identifier (email, ID, or phone number)'),
  identified_by: z
    .enum(['email', 'id', 'phone_number', 'custom_identifier'])
    .optional()
    .default('email')
    .describe('How the subscriber is identified (default: email)'),
  action: z.enum(['add', 'remove']).describe('"add" to add tags, "remove" to remove a tag'),
  tags: z
    .array(z.string())
    .describe('Tag names to add or remove. When removing, tags are removed one at a time sequentially.'),
  trigger_automation: z
    .enum(['force', 'reset'])
    .optional()
    .describe(
      'When adding tags: "force" always triggers automations, "reset" re-triggers with delay reset. Omit to not trigger.'
    ),
});

/** Schema for rule_create_campaign_email tool inputs. */
export const createCampaignEmailSchema = z.object({
  name: z.string().describe('Campaign name (shown in Rule.io dashboard)'),
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
  tags: z
    .array(
      z.object({
        id: z.number().describe('Tag ID'),
        negative: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, excludes subscribers with this tag'),
      })
    )
    .optional()
    .describe(
      'Tags to target as recipients. Use rule_list_tags to find tag IDs.'
    ),
  segments: z
    .array(
      z.object({
        id: z.number().describe('Segment ID'),
        negative: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, excludes subscribers in this segment'),
      })
    )
    .optional()
    .describe(
      'Segments to target as recipients. Use rule_list_segments to find segment IDs.'
    ),
  subscribers: z
    .array(z.number())
    .optional()
    .describe('Specific subscriber IDs to target'),
  preheader: z.string().optional().describe('Preview text shown in email inbox'),
  from_name: z.string().optional().describe('Sender display name'),
  from_email: z.string().optional().describe('Sender email address'),
  reply_to: z.string().optional().describe('Reply-to email address'),
  sendout_type: z
    .enum(['marketing', 'transactional'])
    .optional()
    .default('marketing')
    .describe(
      'Email type: "marketing" for campaigns/newsletters (default), "transactional" for order confirmations etc.'
    ),
});
