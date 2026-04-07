import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuleClient } from 'rule-io-sdk';

function resourceContent(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function resourceError(uri: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json' as const,
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
  };
}

function parseId(id: string | string[]): number | null {
  const num = Number(Array.isArray(id) ? id[0] : id);
  return Number.isFinite(num) ? num : null;
}

export function registerResources(server: McpServer, client: RuleClient): void {
  server.resource('tags', 'rule://tags', async (uri) => {
    try {
      const response = await client.getTags();
      return resourceContent(uri.href, response);
    } catch (error) {
      return resourceError(uri.href, error);
    }
  });

  server.resource('brand-styles', 'rule://brand-styles', async (uri) => {
    try {
      const response = await client.listBrandStyles();
      return resourceContent(uri.href, response);
    } catch (error) {
      return resourceError(uri.href, error);
    }
  });

  server.resource(
    'automation',
    new ResourceTemplate('rule://automations/{id}', { list: undefined }),
    async (uri, { id }) => {
      try {
        const numId = parseId(id);
        if (numId === null) {
          return resourceError(uri.href, `Invalid automation ID: "${id}"`);
        }
        const automation = await client.getAutomation(numId);
        return resourceContent(uri.href, automation ?? { error: 'Not found' });
      } catch (error) {
        return resourceError(uri.href, error);
      }
    }
  );

  server.resource(
    'campaign',
    new ResourceTemplate('rule://campaigns/{id}', { list: undefined }),
    async (uri, { id }) => {
      try {
        const numId = parseId(id);
        if (numId === null) {
          return resourceError(uri.href, `Invalid campaign ID: "${id}"`);
        }
        const campaign = await client.getCampaign(numId);
        return resourceContent(uri.href, campaign ?? { error: 'Not found' });
      } catch (error) {
        return resourceError(uri.href, error);
      }
    }
  );

  server.resource(
    'template',
    new ResourceTemplate('rule://templates/{id}', { list: undefined }),
    async (uri, { id }) => {
      try {
        const numId = parseId(id);
        if (numId === null) {
          return resourceError(uri.href, `Invalid template ID: "${id}"`);
        }
        const template = await client.getTemplate(numId);
        return resourceContent(uri.href, template ?? { error: 'Not found' });
      } catch (error) {
        return resourceError(uri.href, error);
      }
    }
  );

  server.resource('segments', 'rule://segments', async (uri) => {
    try {
      const response = await client.listSegments();
      return resourceContent(uri.href, response);
    } catch (error) {
      return resourceError(uri.href, error);
    }
  });

  server.resource(
    'brand-style',
    new ResourceTemplate('rule://brand-styles/{id}', { list: undefined }),
    async (uri, { id }) => {
      try {
        const numId = parseId(id);
        if (numId === null) {
          return resourceError(uri.href, `Invalid brand style ID: "${id}"`);
        }
        const style = await client.getBrandStyle(numId);
        return resourceContent(uri.href, style ?? { error: 'Not found' });
      } catch (error) {
        return resourceError(uri.href, error);
      }
    }
  );
}
