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
    'automail',
    new ResourceTemplate('rule://automails/{id}', { list: undefined }),
    async (uri, { id }) => {
      try {
        const automail = await client.getAutomail(Number(id));
        return resourceContent(uri.href, automail ?? { error: 'Not found' });
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
        const campaign = await client.getCampaign(Number(id));
        return resourceContent(uri.href, campaign ?? { error: 'Not found' });
      } catch (error) {
        return resourceError(uri.href, error);
      }
    }
  );

  server.resource(
    'brand-style',
    new ResourceTemplate('rule://brand-styles/{id}', { list: undefined }),
    async (uri, { id }) => {
      try {
        const style = await client.getBrandStyle(Number(id));
        return resourceContent(uri.href, style ?? { error: 'Not found' });
      } catch (error) {
        return resourceError(uri.href, error);
      }
    }
  );
}
