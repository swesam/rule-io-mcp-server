import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerAutomationTools } from '../../tools/automations.js';
import { type ToolHandler, registerAndCapture } from './_helpers.js';

interface MockClient {
  getTagIdByName: ReturnType<typeof vi.fn>;
  createAutomationEmail: ReturnType<typeof vi.fn>;
  listAutomations: ReturnType<typeof vi.fn>;
  getAutomation: ReturnType<typeof vi.fn>;
  updateAutomation: ReturnType<typeof vi.fn>;
  deleteAutomation: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    getTagIdByName: vi.fn(),
    createAutomationEmail: vi.fn(),
    listAutomations: vi.fn(),
    getAutomation: vi.fn(),
    updateAutomation: vi.fn(),
    deleteAutomation: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

describe('automation tools', () => {
  let mocks: ReturnType<typeof createMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(registerAutomationTools, mocks.asClient);
  });

  describe('rule_create_automation_email', () => {
    it('creates automation email with template on success', async () => {
      mocks.getTagIdByName.mockResolvedValue(10);
      mocks.createAutomationEmail.mockResolvedValue({
        automationId: 100,
        automailId: 100,
        messageId: 200,
        templateId: 300,
        dynamicSetId: 400,
      });

      const result = await handlers['rule_create_automation_email']({
        name: 'Welcome Email',
        trigger_tag: 'welcome',
        subject: 'Welcome!',
        template: { body: [] },
        sendout_type: 'transactional',
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({
        success: true,
        automation_id: 100,
        message_id: 200,
        template_id: 300,
        dynamic_set_id: 400,
      });
    });

    it('creates automation email with brand_style_id', async () => {
      mocks.getTagIdByName.mockResolvedValue(10);
      mocks.createAutomationEmail.mockResolvedValue({
        automationId: 101,
        automailId: 101,
        messageId: 201,
        templateId: 301,
        dynamicSetId: 401,
      });

      const result = await handlers['rule_create_automation_email']({
        name: 'Branded Email',
        trigger_tag: 'welcome',
        subject: 'Welcome!',
        brand_style_id: 42,
        sendout_type: 'transactional',
      });

      expect(result.isError).toBeUndefined();
      expect(mocks.createAutomationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ brandStyleId: 42 })
      );
    });

    it('creates automation email with brand_style_id and sections', async () => {
      mocks.getTagIdByName.mockResolvedValue(10);
      mocks.createAutomationEmail.mockResolvedValue({
        automationId: 102,
        automailId: 102,
        messageId: 202,
        templateId: 302,
        dynamicSetId: 402,
      });

      const result = await handlers['rule_create_automation_email']({
        name: 'Welcome Branded',
        trigger_tag: 'welcome',
        subject: 'Welcome!',
        brand_style_id: 42,
        sections: [
          { type: 'heading', text: 'Welcome!' },
          { type: 'text', text: 'Thanks for joining' },
          { type: 'button', text: 'Get Started', url: 'https://example.com/start' },
        ],
        sendout_type: 'transactional',
      });

      expect(result.isError).toBeUndefined();
      const call = mocks.createAutomationEmail.mock.calls[0][0];
      expect(call.brandStyleId).toBe(42);
      expect(call.sections).toHaveLength(1);
      expect(call.sections[0].tagName).toBe('rc-section');
      expect(call.sections[0].children[0].tagName).toBe('rc-column');
      expect(call.sections[0].children[0].children).toHaveLength(3);
      expect(call.sections[0].children[0].children[0].tagName).toBe('rc-heading');
      expect(call.sections[0].children[0].children[1].tagName).toBe('rc-text');
      expect(call.sections[0].children[0].children[2].tagName).toBe('rc-button');
    });

    it('ignores sections when template is provided', async () => {
      mocks.getTagIdByName.mockResolvedValue(10);
      mocks.createAutomationEmail.mockResolvedValue({
        automationId: 103,
        automailId: 103,
        messageId: 203,
        templateId: 303,
        dynamicSetId: 403,
      });

      const result = await handlers['rule_create_automation_email']({
        name: 'Template Auto',
        trigger_tag: 'welcome',
        subject: 'Welcome!',
        template: { body: [] },
        sections: [{ type: 'heading', text: 'Ignored' }],
        sendout_type: 'transactional',
      });

      expect(result.isError).toBeUndefined();
      const call = mocks.createAutomationEmail.mock.calls[0][0];
      expect(call.template).toEqual({ body: [] });
      expect(call.sections).toBeUndefined();
    });

    it('returns error when neither template nor brand_style_id provided', async () => {
      const result = await handlers['rule_create_automation_email']({
        name: 'Welcome Email',
        trigger_tag: 'welcome',
        subject: 'Welcome!',
        sendout_type: 'transactional',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Provide either');
    });

    it('returns error when both template and brand_style_id provided', async () => {
      const result = await handlers['rule_create_automation_email']({
        name: 'Welcome Email',
        trigger_tag: 'welcome',
        subject: 'Welcome!',
        template: { body: [] },
        brand_style_id: 42,
        sendout_type: 'transactional',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not both');
    });

    it('returns error when trigger tag is not found', async () => {
      mocks.getTagIdByName.mockResolvedValue(null);

      const result = await handlers['rule_create_automation_email']({
        name: 'Welcome Email',
        trigger_tag: 'nonexistent',
        subject: 'Welcome!',
        template: { body: [] },
        sendout_type: 'transactional',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tag "nonexistent" not found');
    });

    it('handles API error during creation', async () => {
      mocks.getTagIdByName.mockResolvedValue(10);
      mocks.createAutomationEmail.mockRejectedValue(
        new RuleApiError('Internal Server Error', 500)
      );

      const result = await handlers['rule_create_automation_email']({
        name: 'Welcome Email',
        trigger_tag: 'welcome',
        subject: 'Welcome!',
        template: { body: [] },
        sendout_type: 'transactional',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_list_automations', () => {
    it('returns list of automations', async () => {
      const automations = { data: [{ id: 1, name: 'Auto 1' }], total: 1 };
      mocks.listAutomations.mockResolvedValue(automations);

      const result = await handlers['rule_list_automations']({
        page: 1,
        per_page: 25,
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(automations);
    });

    it('handles API error', async () => {
      mocks.listAutomations.mockRejectedValue(new RuleApiError('Forbidden', 403));

      const result = await handlers['rule_list_automations']({
        page: 1,
        per_page: 25,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('rule_get_automation', () => {
    it('returns automation details when found', async () => {
      const automation = { id: 1, name: 'Welcome', active: true };
      mocks.getAutomation.mockResolvedValue(automation);

      const result = await handlers['rule_get_automation']({ id: 1 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(automation);
    });

    it('returns not found message when automation is null', async () => {
      mocks.getAutomation.mockResolvedValue(null);

      const result = await handlers['rule_get_automation']({ id: 999 });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Automation 999 not found');
    });

    it('returns isError on API failure', async () => {
      mocks.getAutomation.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_get_automation']({ id: 1 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_update_automation', () => {
    it('updates automation successfully', async () => {
      const updated = { id: 1, active: false };
      mocks.updateAutomation.mockResolvedValue(updated);

      const result = await handlers['rule_update_automation']({
        id: 1,
        active: false,
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(updated);
    });

    it('returns error when trigger_type provided without trigger_id', async () => {
      const result = await handlers['rule_update_automation']({
        id: 1,
        trigger_type: 'tag',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'trigger_type and trigger_id must be provided together'
      );
    });

    it('returns error when trigger_id provided without trigger_type', async () => {
      const result = await handlers['rule_update_automation']({
        id: 1,
        trigger_id: 5,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'trigger_type and trigger_id must be provided together'
      );
    });

    it('sends trigger update when both trigger_type and trigger_id provided', async () => {
      mocks.updateAutomation.mockResolvedValue({ id: 1 });

      await handlers['rule_update_automation']({
        id: 1,
        trigger_type: 'tag',
        trigger_id: 42,
      });

      expect(mocks.updateAutomation).toHaveBeenCalledWith(1, {
        trigger: { type: 'TAG', id: 42 },
      });
    });

    it('returns isError on API failure', async () => {
      mocks.updateAutomation.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_update_automation']({
        id: 1,
        active: false,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });
  });

  describe('rule_delete_automation', () => {
    it('deletes an automation', async () => {
      mocks.deleteAutomation.mockResolvedValue({ success: true });

      const result = await handlers['rule_delete_automation']({ id: 1 });

      expect(result.isError).toBeUndefined();
      expect(mocks.deleteAutomation).toHaveBeenCalledWith(1);
    });

    it('handles API error', async () => {
      mocks.deleteAutomation.mockRejectedValue(new RuleApiError('Not Found', 404));

      const result = await handlers['rule_delete_automation']({ id: 999 });

      expect(result.isError).toBe(true);
    });
  });
});
