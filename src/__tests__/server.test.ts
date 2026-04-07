import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock rule-io-sdk so we don't need a real API key
vi.mock('rule-io-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('rule-io-sdk')>();
  class MockRuleClient {
    constructor(_config: Record<string, unknown>) {
      // No-op: tool registration is lazy, no API calls at construction time
    }
  }
  return {
    ...actual,
    RuleClient: MockRuleClient,
  };
});

import { createServer } from '../server.js';

const EXPECTED_TOOLS = [
  // tags
  'rule_list_tags',
  'rule_find_tag',
  // campaigns
  'rule_create_campaign',
  'rule_create_campaign_email',
  'rule_list_campaigns',
  'rule_get_campaign',
  'rule_update_campaign',
  'rule_delete_campaign',
  'rule_copy_campaign',
  'rule_list_segments',
  'rule_schedule_campaign',
  // templates
  'rule_create_template',
  'rule_list_templates',
  'rule_render_template',
  'rule_get_template',
  'rule_delete_template',
  // automations
  'rule_create_automation_email',
  'rule_list_automations',
  'rule_get_automation',
  'rule_update_automation',
  'rule_delete_automation',
  // admin
  'rule_list_brand_styles',
  'rule_get_brand_style',
  'rule_manage_brand_style',
  'rule_suppress_subscribers',
  'rule_unsuppress_subscribers',
  // analytics
  'rule_get_analytics',
  'rule_export_data',
  // subscribers
  'rule_create_subscriber',
  'rule_get_subscriber',
  'rule_delete_subscriber',
  'rule_manage_subscriber_tags',
  'rule_bulk_manage_tags',
  'rule_set_subscriber_fields',
  'rule_block_subscribers',
] as const;

describe('createServer', () => {
  let toolSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toolSpy = vi.spyOn(McpServer.prototype, 'tool');
  });

  afterEach(() => {
    toolSpy.mockRestore();
  });

  it('creates server without throwing', () => {
    const server = createServer({
      apiKey: 'test-key',
      debug: false,
      fieldGroupPrefix: 'Booking',
    });

    expect(server).toBeDefined();
  });

  it('accepts all config options', () => {
    const server = createServer({
      apiKey: 'test-key',
      debug: true,
      fieldGroupPrefix: 'Custom',
      baseUrlV2: 'https://v2.example.com',
      baseUrlV3: 'https://v3.example.com',
    });

    expect(server).toBeDefined();
  });

  it('registers all 35 expected tools', () => {
    createServer({
      apiKey: 'test-key',
      debug: false,
      fieldGroupPrefix: 'Booking',
    });

    const registeredNames = toolSpy.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );

    expect(registeredNames).toHaveLength(EXPECTED_TOOLS.length);

    for (const name of EXPECTED_TOOLS) {
      expect(registeredNames).toContain(name);
    }
  });
});
