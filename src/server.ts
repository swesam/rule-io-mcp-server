import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RuleClient } from 'rule-io-sdk';
import type { ServerConfig } from './config.js';
import { registerTagTools } from './tools/tags.js';
import { registerSubscriberTools } from './tools/subscribers.js';
import { registerAutomationTools } from './tools/automations.js';
import { registerCampaignTools } from './tools/campaigns.js';
import { registerTemplateTools } from './tools/templates.js';
import { registerAnalyticsTools } from './tools/analytics.js';
import { registerAdminTools } from './tools/admin.js';
import { registerResources } from './resources/index.js';

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: 'rule-io',
    version: '0.1.0',
  });

  const client = new RuleClient({
    apiKey: config.apiKey,
    debug: config.debug,
    fieldGroupPrefix: config.fieldGroupPrefix,
    baseUrlV2: config.baseUrlV2,
    baseUrlV3: config.baseUrlV3,
  });

  // Register all tools
  registerTagTools(server, client);
  registerSubscriberTools(server, client);
  registerAutomationTools(server, client);
  registerCampaignTools(server, client);
  registerTemplateTools(server, client);
  registerAnalyticsTools(server, client);
  registerAdminTools(server, client);

  // Register resources
  registerResources(server, client);

  return server;
}
