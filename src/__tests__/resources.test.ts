import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuleClient } from 'rule-io-sdk';
import { registerResources } from '../resources/index.js';

type ResourceHandler = (
  uri: URL,
  params: Record<string, string | string[]>
) => Promise<{
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}>;

function createMockClient(): {
  client: RuleClient;
  getTags: ReturnType<typeof vi.fn>;
  listBrandStyles: ReturnType<typeof vi.fn>;
  getBrandStyle: ReturnType<typeof vi.fn>;
  getAutomation: ReturnType<typeof vi.fn>;
  getCampaign: ReturnType<typeof vi.fn>;
  getTemplate: ReturnType<typeof vi.fn>;
  listSegments: ReturnType<typeof vi.fn>;
} {
  const getTags = vi.fn();
  const listBrandStyles = vi.fn();
  const getBrandStyle = vi.fn();
  const getAutomation = vi.fn();
  const getCampaign = vi.fn();
  const getTemplate = vi.fn();
  const listSegments = vi.fn();
  const client = {
    getTags,
    listBrandStyles,
    getBrandStyle,
    getAutomation,
    getCampaign,
    getTemplate,
    listSegments,
  } as unknown as RuleClient;
  return {
    client,
    getTags,
    listBrandStyles,
    getBrandStyle,
    getAutomation,
    getCampaign,
    getTemplate,
    listSegments,
  };
}

function captureResources(client: RuleClient): Record<string, ResourceHandler> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const resourceSpy = vi.spyOn(server, 'resource');
  registerResources(server, client);

  const handlers: Record<string, ResourceHandler> = {};
  for (const call of resourceSpy.mock.calls) {
    const name = call[0] as string;
    // The handler is always the last argument
    handlers[name] = call[call.length - 1] as ResourceHandler;
  }
  return handlers;
}

const EXPECTED_RESOURCES = [
  'tags',
  'brand-styles',
  'automation',
  'campaign',
  'template',
  'segments',
  'brand-style',
] as const;

describe('resources', () => {
  let mocks: ReturnType<typeof createMockClient>;
  let handlers: Record<string, ResourceHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = captureResources(mocks.client);
  });

  it('registers all 7 expected resources', () => {
    const registeredNames = Object.keys(handlers);
    expect(registeredNames).toHaveLength(EXPECTED_RESOURCES.length);
    for (const name of EXPECTED_RESOURCES) {
      expect(registeredNames).toContain(name);
    }
  });

  it('registers resource URIs on the McpServer', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const resourceSpy = vi.spyOn(server, 'resource');
    registerResources(server, mocks.client);

    const registrations = resourceSpy.mock.calls.map((call) => ({
      name: call[0] as string,
      uri: call[1],
    }));

    // Static resources have string URIs
    const tagsReg = registrations.find((r) => r.name === 'tags');
    expect(tagsReg?.uri).toBe('rule://tags');

    const brandStylesReg = registrations.find((r) => r.name === 'brand-styles');
    expect(brandStylesReg?.uri).toBe('rule://brand-styles');

    const segmentsReg = registrations.find((r) => r.name === 'segments');
    expect(segmentsReg?.uri).toBe('rule://segments');

    // Template resources use ResourceTemplate
    const automationReg = registrations.find((r) => r.name === 'automation');
    expect(automationReg?.uri).toBeInstanceOf(ResourceTemplate);

    const campaignReg = registrations.find((r) => r.name === 'campaign');
    expect(campaignReg?.uri).toBeInstanceOf(ResourceTemplate);

    const templateReg = registrations.find((r) => r.name === 'template');
    expect(templateReg?.uri).toBeInstanceOf(ResourceTemplate);

    const brandStyleReg = registrations.find((r) => r.name === 'brand-style');
    expect(brandStyleReg?.uri).toBeInstanceOf(ResourceTemplate);
  });

  // -- Static resource handlers --

  describe('tags resource', () => {
    it('returns tag data as JSON content', async () => {
      const tagData = { tags: [{ id: 1, name: 'welcome' }] };
      mocks.getTags.mockResolvedValue(tagData);

      const result = await handlers['tags'](new URL('rule://tags'), {});

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('rule://tags');
      expect(result.contents[0].mimeType).toBe('application/json');
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual(tagData);
    });

    it('returns error content on API failure', async () => {
      mocks.getTags.mockRejectedValue(new Error('Network failure'));

      const result = await handlers['tags'](new URL('rule://tags'), {});

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Network failure' });
    });
  });

  describe('brand-styles resource', () => {
    it('returns brand styles as JSON content', async () => {
      const styles = [{ id: 1, name: 'Default' }];
      mocks.listBrandStyles.mockResolvedValue(styles);

      const result = await handlers['brand-styles'](new URL('rule://brand-styles'), {});

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe('application/json');
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual(styles);
    });

    it('returns error content on API failure', async () => {
      mocks.listBrandStyles.mockRejectedValue(new Error('Unauthorized'));

      const result = await handlers['brand-styles'](new URL('rule://brand-styles'), {});

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('segments resource', () => {
    it('returns segments as JSON content', async () => {
      const segments = [{ id: 10, name: 'VIP' }];
      mocks.listSegments.mockResolvedValue(segments);

      const result = await handlers['segments'](new URL('rule://segments'), {});

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual(segments);
    });

    it('returns error content on API failure', async () => {
      mocks.listSegments.mockRejectedValue(new Error('Server error'));

      const result = await handlers['segments'](new URL('rule://segments'), {});

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Server error' });
    });
  });

  // -- Parameterized resource handlers --

  describe('automation resource', () => {
    it('returns automation data for a valid ID', async () => {
      const automation = { id: 42, name: 'Welcome flow' };
      mocks.getAutomation.mockResolvedValue(automation);

      const result = await handlers['automation'](
        new URL('rule://automations/42'),
        { id: '42' }
      );

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual(automation);
      expect(mocks.getAutomation).toHaveBeenCalledWith(42);
    });

    it('returns error for invalid (non-numeric) ID', async () => {
      const result = await handlers['automation'](
        new URL('rule://automations/abc'),
        { id: 'abc' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Invalid automation ID: "abc"' });
      expect(mocks.getAutomation).not.toHaveBeenCalled();
    });

    it('returns not-found when API returns null', async () => {
      mocks.getAutomation.mockResolvedValue(null);

      const result = await handlers['automation'](
        new URL('rule://automations/999'),
        { id: '999' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Not found' });
    });

    it('returns error content on API failure', async () => {
      mocks.getAutomation.mockRejectedValue(new Error('Forbidden'));

      const result = await handlers['automation'](
        new URL('rule://automations/1'),
        { id: '1' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Forbidden' });
    });
  });

  describe('campaign resource', () => {
    it('returns campaign data for a valid ID', async () => {
      const campaign = { id: 5, name: 'Summer sale' };
      mocks.getCampaign.mockResolvedValue(campaign);

      const result = await handlers['campaign'](
        new URL('rule://campaigns/5'),
        { id: '5' }
      );

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual(campaign);
      expect(mocks.getCampaign).toHaveBeenCalledWith(5);
    });

    it('returns error for invalid ID', async () => {
      const result = await handlers['campaign'](
        new URL('rule://campaigns/xyz'),
        { id: 'xyz' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Invalid campaign ID: "xyz"' });
    });

    it('returns not-found when API returns null', async () => {
      mocks.getCampaign.mockResolvedValue(null);

      const result = await handlers['campaign'](
        new URL('rule://campaigns/999'),
        { id: '999' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Not found' });
    });
  });

  describe('template resource', () => {
    it('returns template data for a valid ID', async () => {
      const template = { id: 7, name: 'Newsletter' };
      mocks.getTemplate.mockResolvedValue(template);

      const result = await handlers['template'](
        new URL('rule://templates/7'),
        { id: '7' }
      );

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual(template);
      expect(mocks.getTemplate).toHaveBeenCalledWith(7);
    });

    it('returns error for invalid ID', async () => {
      const result = await handlers['template'](
        new URL('rule://templates/bad'),
        { id: 'bad' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Invalid template ID: "bad"' });
    });

    it('returns not-found when API returns null', async () => {
      mocks.getTemplate.mockResolvedValue(null);

      const result = await handlers['template'](
        new URL('rule://templates/999'),
        { id: '999' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Not found' });
    });
  });

  describe('brand-style resource', () => {
    it('returns brand style data for a valid ID', async () => {
      const style = { id: 3, name: 'Corporate' };
      mocks.getBrandStyle.mockResolvedValue(style);

      const result = await handlers['brand-style'](
        new URL('rule://brand-styles/3'),
        { id: '3' }
      );

      expect(result.contents).toHaveLength(1);
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual(style);
      expect(mocks.getBrandStyle).toHaveBeenCalledWith(3);
    });

    it('returns error for invalid ID', async () => {
      const result = await handlers['brand-style'](
        new URL('rule://brand-styles/nope'),
        { id: 'nope' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Invalid brand style ID: "nope"' });
    });

    it('returns not-found when API returns null', async () => {
      mocks.getBrandStyle.mockResolvedValue(null);

      const result = await handlers['brand-style'](
        new URL('rule://brand-styles/999'),
        { id: '999' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Not found' });
    });

    it('returns error content on API failure', async () => {
      mocks.getBrandStyle.mockRejectedValue(new Error('Timeout'));

      const result = await handlers['brand-style'](
        new URL('rule://brand-styles/1'),
        { id: '1' }
      );

      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed).toEqual({ error: 'Timeout' });
    });
  });
});
