import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerTemplateTools } from '../../tools/templates.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  createTemplate: ReturnType<typeof vi.fn>;
  listTemplates: ReturnType<typeof vi.fn>;
  renderTemplate: ReturnType<typeof vi.fn>;
  getTemplate: ReturnType<typeof vi.fn>;
  deleteTemplate: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    createTemplate: vi.fn(),
    listTemplates: vi.fn(),
    renderTemplate: vi.fn(),
    getTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
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

  describe('rule_list_templates', () => {
    it('returns template list with pagination', async () => {
      const templates = { data: [{ id: 10, name: 'Welcome' }], total: 1 };
      mocks.listTemplates.mockResolvedValue(templates);

      const result = await handlers['rule_list_templates']({ page: 1, per_page: 25 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(templates);
      expect(mocks.listTemplates).toHaveBeenCalledWith({ page: 1, per_page: 25 });
    });
  });

  describe('rule_create_template - name collision retry', () => {
    it('retries with timestamp suffix on name validation error', async () => {
      const validationError = new RuleApiError('Validation failed', 422);
      Object.defineProperty(validationError, 'validationErrors', {
        value: { name: ['The name has already been taken.'] },
      });
      vi.spyOn(validationError, 'isValidationError').mockReturnValue(true);

      const retryResult = { id: 11, name: 'Welcome - 1234567890', message_id: 5 };
      mocks.createTemplate
        .mockRejectedValueOnce(validationError)
        .mockResolvedValueOnce(retryResult);

      const result = await handlers['rule_create_template']({
        name: 'Welcome',
        message_id: 5,
        content: { body: [] },
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(retryResult);
      expect(mocks.createTemplate).toHaveBeenCalledTimes(2);
      // Second call should have a timestamp-suffixed name
      const secondCallName = mocks.createTemplate.mock.calls[1][0].name as string;
      expect(secondCallName).toMatch(/^Welcome - \d+$/);
    });
  });

  describe('rule_get_template', () => {
    it('returns template details when found', async () => {
      const template = { id: 10, name: 'Welcome', message_id: 5 };
      mocks.getTemplate.mockResolvedValue(template);

      const result = await handlers['rule_get_template']({ id: 10 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(template);
    });

    it('returns not found message when template is null', async () => {
      mocks.getTemplate.mockResolvedValue(null);

      const result = await handlers['rule_get_template']({ id: 999 });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Template 999 not found');
    });
  });

  describe('rule_delete_template', () => {
    it('deletes a template', async () => {
      mocks.deleteTemplate.mockResolvedValue({ success: true });

      const result = await handlers['rule_delete_template']({ id: 10 });

      expect(result.isError).toBeUndefined();
      expect(mocks.deleteTemplate).toHaveBeenCalledWith(10);
    });

    it('handles API error', async () => {
      mocks.deleteTemplate.mockRejectedValue(new RuleApiError('Not Found', 404));

      const result = await handlers['rule_delete_template']({ id: 999 });

      expect(result.isError).toBe(true);
    });
  });
});
