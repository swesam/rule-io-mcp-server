import { describe, it, expect } from 'vitest';
import {
  createSubscriberSchema,
  manageSubscriberTagsSchema,
  createCampaignEmailSchema,
} from '../../tools/schemas.js';

// ---------------------------------------------------------------------------
// rule_create_subscriber
// ---------------------------------------------------------------------------
describe('createSubscriberSchema', () => {
  it('accepts valid email-only input', () => {
    const result = createSubscriberSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts full input with all optional fields', () => {
    const result = createSubscriberSchema.safeParse({
      email: 'user@example.com',
      phone_number: '+46701234567',
      language: 'sv',
      status: 'ACTIVE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = createSubscriberSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = createSubscriberSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string email', () => {
    const result = createSubscriberSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status enum value', () => {
    const result = createSubscriberSchema.safeParse({
      email: 'user@example.com',
      status: 'DELETED',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid status values', () => {
    for (const status of ['ACTIVE', 'BLOCKED', 'PENDING']) {
      const result = createSubscriberSchema.safeParse({ email: 'a@b.com', status });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// rule_manage_subscriber_tags
// ---------------------------------------------------------------------------
describe('manageSubscriberTagsSchema', () => {
  it('accepts valid add action with tags', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      action: 'add',
      tags: ['newsletter', 'vip'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid remove action with tags', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      action: 'remove',
      tags: ['old-tag'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional identified_by and trigger_automation', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: '12345',
      identified_by: 'id',
      action: 'add',
      tags: ['promo'],
      trigger_automation: 'force',
    });
    expect(result.success).toBe(true);
  });

  it('defaults identified_by to email when omitted', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      action: 'add',
      tags: ['tag1'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identified_by).toBe('email');
    }
  });

  it('rejects missing subscriber', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      action: 'add',
      tags: ['tag1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing action', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      tags: ['tag1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action value', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      action: 'delete',
      tags: ['tag1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing tags', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      action: 'add',
    });
    expect(result.success).toBe(false);
  });

  it('rejects tags with non-string elements', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      action: 'add',
      tags: [123, true],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid identified_by value', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      identified_by: 'username',
      action: 'add',
      tags: ['tag1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid trigger_automation value', () => {
    const result = manageSubscriberTagsSchema.safeParse({
      subscriber: 'user@example.com',
      action: 'add',
      tags: ['tag1'],
      trigger_automation: 'always',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rule_create_campaign_email
// ---------------------------------------------------------------------------
describe('createCampaignEmailSchema', () => {
  const validBase = {
    name: 'Spring Sale',
    subject: '50% off everything!',
    brand_style_id: 42,
    tags: [{ id: 1 }],
  };

  it('accepts valid input with brand_style_id and tag recipients', () => {
    const result = createCampaignEmailSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('accepts valid input with template instead of brand_style_id', () => {
    const result = createCampaignEmailSchema.safeParse({
      name: 'Campaign',
      subject: 'Hello',
      template: { doc: 'rcml-content' },
      subscribers: [101, 102],
    });
    expect(result.success).toBe(true);
  });

  it('accepts segment recipients', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      tags: undefined,
      segments: [{ id: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts subscriber ID recipients', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      tags: undefined,
      subscribers: [10, 20, 30],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name: _, ...noName } = validBase;
    const result = createCampaignEmailSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects missing subject', () => {
    const { subject: _, ...noSubject } = validBase;
    const result = createCampaignEmailSchema.safeParse(noSubject);
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric brand_style_id', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      brand_style_id: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects tags with non-numeric id', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      tags: [{ id: 'not-a-number' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects subscribers with non-numeric elements', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      subscribers: ['email@example.com'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sendout_type', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      sendout_type: 'promotional',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all optional email fields', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      preheader: 'Don\'t miss out!',
      from_name: 'Store',
      from_email: 'noreply@store.com',
      reply_to: 'support@store.com',
      sendout_type: 'transactional',
    });
    expect(result.success).toBe(true);
  });

  it('accepts sections with brand_style_id', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      sections: [
        { type: 'heading', text: 'Big Sale' },
        { type: 'text', text: 'Body copy here' },
        { type: 'button', text: 'Shop Now', url: 'https://example.com' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('defaults sendout_type to marketing', () => {
    const result = createCampaignEmailSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sendout_type).toBe('marketing');
    }
  });

  it('accepts negative flag on tags', () => {
    const result = createCampaignEmailSchema.safeParse({
      ...validBase,
      tags: [
        { id: 1, negative: false },
        { id: 2, negative: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects providing both template and brand_style_id', () => {
    const result = createCampaignEmailSchema.safeParse({
      name: 'Campaign',
      subject: 'Hello',
      template: { doc: 'rcml-content' },
      brand_style_id: 42,
      tags: [{ id: 1 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('template');
      expect(paths).toContain('brand_style_id');
    }
  });

  it('rejects providing neither template nor brand_style_id', () => {
    const result = createCampaignEmailSchema.safeParse({
      name: 'Campaign',
      subject: 'Hello',
      tags: [{ id: 1 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('template');
      expect(paths).toContain('brand_style_id');
    }
  });
});
