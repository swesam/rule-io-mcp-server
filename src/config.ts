export interface ServerConfig {
  apiKey: string;
  debug: boolean;
  fieldGroupPrefix: string;
  baseUrlV2?: string;
  baseUrlV3?: string;
}

export function loadConfig(): ServerConfig {
  const apiKey = process.env.RULE_IO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RULE_IO_API_KEY environment variable is required. ' +
        'Set it in your MCP client config or shell environment.'
    );
  }

  return {
    apiKey,
    debug: process.env.RULE_IO_DEBUG === 'true',
    fieldGroupPrefix: process.env.RULE_IO_FIELD_GROUP_PREFIX ?? 'Booking',
    baseUrlV2: process.env.RULE_IO_BASE_URL_V2,
    baseUrlV3: process.env.RULE_IO_BASE_URL_V3,
  };
}
