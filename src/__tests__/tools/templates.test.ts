import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerTemplateTools } from '../../tools/templates.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  createTemplate: ReturnType<typeof vi.fn>;
  listTemplates: ReturnType<typeof vi.fn>;
  renderTemplate: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    createTemplate: vi.fn(),
    listTemplates: vi.fn(),
    renderTemplate: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

describe('template tools', () => {
  let mocks: MockClient;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(registerTemplateTools, mocks.asClient);
  });

  describe('rule_create_template', () => {
    it('creates a template and returns result', async () => {
      const template = { id: 10, name: 'Welcome Template', message_id: 5 };
      mocks.createTemplate.mockResolvedValue(template);

      const result = await handlers['rule_create_template']({
        name: 'Welcome Template',
        message_id: 5,
        content: { body: [{ type: 'text', value: 'Hello!' }] },
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(template);
      expect(mocks.createTemplate).toHaveBeenCalledWith({
        name: 'Welcome Template',
        message_id: 5,
        message_type: 'email',
        template: { body: [{ type: 'text', value: 'Hello!' }] },
      });
    });

    it('returns error on API failure', async () => {
      mocks.createTemplate.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_create_template']({
        name: 'Fail',
        message_id: 1,
        content: { body: [] },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_render_template', () => {
    it('returns not found text when template is null', async () => {
      mocks.renderTemplate.mockResolvedValue(null);

      const result = await handlers['rule_render_template']({ id: 999 });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Template 999 not found');
    });

    it('returns rendered HTML on success', async () => {
      mocks.renderTemplate.mockResolvedValue('<html><body>Hello</body></html>');

      const result = await handlers['rule_render_template']({ id: 10 });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('<html>');
    });
  });
});
