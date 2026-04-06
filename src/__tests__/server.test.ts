import { describe, it, expect, vi } from 'vitest';

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

import { createServer } from '../server';

describe('createServer', () => {
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
});
