import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.stubEnv('RULE_IO_API_KEY', '');
    vi.stubEnv('RULE_IO_DEBUG', '');
    vi.stubEnv('RULE_IO_FIELD_GROUP_PREFIX', '');
    vi.stubEnv('RULE_IO_BASE_URL_V2', '');
    vi.stubEnv('RULE_IO_BASE_URL_V3', '');
    // Delete them so loadConfig sees them as unset
    delete process.env.RULE_IO_API_KEY;
    delete process.env.RULE_IO_DEBUG;
    delete process.env.RULE_IO_FIELD_GROUP_PREFIX;
    delete process.env.RULE_IO_BASE_URL_V2;
    delete process.env.RULE_IO_BASE_URL_V3;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when RULE_IO_API_KEY is missing', () => {
    expect(() => loadConfig()).toThrow(/RULE_IO_API_KEY environment variable is required/);
  });

  it('returns correct config with only RULE_IO_API_KEY set (defaults)', () => {
    process.env.RULE_IO_API_KEY = 'test-key-123';
    const config = loadConfig();

    expect(config).toEqual({
      apiKey: 'test-key-123',
      debug: false,
      fieldGroupPrefix: 'Order',
      baseUrlV2: undefined,
      baseUrlV3: undefined,
    });
  });

  it('sets debug=true when RULE_IO_DEBUG=true', () => {
    process.env.RULE_IO_API_KEY = 'test-key';
    process.env.RULE_IO_DEBUG = 'true';
    const config = loadConfig();

    expect(config.debug).toBe(true);
  });

  it('sets debug=false when RULE_IO_DEBUG is not "true"', () => {
    process.env.RULE_IO_API_KEY = 'test-key';
    process.env.RULE_IO_DEBUG = 'yes';
    const config = loadConfig();

    expect(config.debug).toBe(false);
  });

  it('uses custom fieldGroupPrefix from env', () => {
    process.env.RULE_IO_API_KEY = 'test-key';
    process.env.RULE_IO_FIELD_GROUP_PREFIX = 'CustomPrefix';
    const config = loadConfig();

    expect(config.fieldGroupPrefix).toBe('CustomPrefix');
  });

  it('uses custom baseUrlV2 and baseUrlV3 from env', () => {
    process.env.RULE_IO_API_KEY = 'test-key';
    process.env.RULE_IO_BASE_URL_V2 = 'https://custom-v2.example.com';
    process.env.RULE_IO_BASE_URL_V3 = 'https://custom-v3.example.com';
    const config = loadConfig();

    expect(config.baseUrlV2).toBe('https://custom-v2.example.com');
    expect(config.baseUrlV3).toBe('https://custom-v3.example.com');
  });
});
