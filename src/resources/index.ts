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

export function registerResources(server: McpServer, client: RuleClient): void {
  // Static resources
  server.resource('tags', 'rule://tags', async (uri) => {
    const response = await client.getTags();
    return resourceContent(uri.href, response);
  });

  server.resource('brand-styles', 'rule://brand-styles', async (uri) => {
    const response = await client.listBrandStyles();
    return resourceContent(uri.href, response);
  });

  // Parameterized resources
  server.resource(
    'automail',
    new ResourceTemplate('rule://automails/{id}', { list: undefined }),
    async (uri, { id }) => {
      const automail = await client.getAutomail(Number(id));
      return resourceContent(uri.href, automail ?? { error: 'Not found' });
    }
  );

  server.resource(
    'campaign',
    new ResourceTemplate('rule://campaigns/{id}', { list: undefined }),
    async (uri, { id }) => {
      const campaign = await client.getCampaign(Number(id));
      return resourceContent(uri.href, campaign ?? { error: 'Not found' });
    }
  );

  server.resource(
    'brand-style',
    new ResourceTemplate('rule://brand-styles/{id}', { list: undefined }),
    async (uri, { id }) => {
      const style = await client.getBrandStyle(Number(id));
      return resourceContent(uri.href, style ?? { error: 'Not found' });
    }
  );
}
