import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuleClient } from 'rule-io-sdk';
import { RuleApiError } from 'rule-io-sdk';
import { registerAutomationTools } from '../../tools/automations.js';

interface MockClient {
  getTagIdByName: ReturnType<typeof vi.fn>;
  createAutomationEmail: ReturnType<typeof vi.fn>;
  listAutomails: ReturnType<typeof vi.fn>;
  getAutomail: ReturnType<typeof vi.fn>;
  updateAutomail: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    getTagIdByName: vi.fn(),
    createAutomationEmail: vi.fn(),
    listAutomails: vi.fn(),
    getAutomail: vi.fn(),
    updateAutomail: vi.fn(),
  };
  return { ...mocks, asClient: mocks as unknown as RuleClient };
}

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function registerAndCapture(client: RuleClient): Record<string, ToolHandler> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const toolSpy = vi.spyOn(server, 'tool');
  registerAutomationTools(server, client);

  const handlers: Record<string, ToolHandler> = {};
  for (const call of toolSpy.mock.calls) {
    const name = call[0] as string;
    handlers[name] = call[call.length - 1] as ToolHandler;
  }
  return handlers;
}

describe('automation tools', () => {
  let mocks: ReturnType<typeof createMockClient>;
  let handlers: Record<string, ToolHandler>;

  beforeEach(() => {
    mocks = createMockClient();
    handlers = registerAndCapture(mocks.asClient);
  });

  describe('rule_create_automation_email', () => {
    it('creates automation email on success', async () => {
      mocks.getTagIdByName.mockResolvedValue(10);
      mocks.createAutomationEmail.mockResolvedValue({
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
        automail_id: 100,
        message_id: 200,
        template_id: 300,
        dynamic_set_id: 400,
      });
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

  describe('rule_list_automails', () => {
    it('returns list of automails', async () => {
      const automails = { data: [{ id: 1, name: 'Auto 1' }], total: 1 };
      mocks.listAutomails.mockResolvedValue(automails);

      const result = await handlers['rule_list_automails']({
        page: 1,
        per_page: 25,
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(automails);
    });

    it('handles API error', async () => {
      mocks.listAutomails.mockRejectedValue(new RuleApiError('Forbidden', 403));

      const result = await handlers['rule_list_automails']({
        page: 1,
        per_page: 25,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('rule_get_automail', () => {
    it('returns automail details when found', async () => {
      const automail = { id: 1, name: 'Welcome', active: true };
      mocks.getAutomail.mockResolvedValue(automail);

      const result = await handlers['rule_get_automail']({ id: 1 });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(automail);
    });

    it('returns not found message when automail is null', async () => {
      mocks.getAutomail.mockResolvedValue(null);

      const result = await handlers['rule_get_automail']({ id: 999 });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Automail 999 not found');
    });
  });

  describe('rule_update_automail', () => {
    it('updates automail successfully', async () => {
      const updated = { id: 1, active: false };
      mocks.updateAutomail.mockResolvedValue(updated);

      const result = await handlers['rule_update_automail']({
        id: 1,
        active: false,
      });

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(updated);
    });

    it('returns error when trigger_type provided without trigger_id', async () => {
      const result = await handlers['rule_update_automail']({
        id: 1,
        trigger_type: 'tag',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'trigger_type and trigger_id must be provided together'
      );
    });

    it('returns error when trigger_id provided without trigger_type', async () => {
      const result = await handlers['rule_update_automail']({
        id: 1,
        trigger_id: 5,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'trigger_type and trigger_id must be provided together'
      );
    });

    it('sends trigger update when both trigger_type and trigger_id provided', async () => {
      mocks.updateAutomail.mockResolvedValue({ id: 1 });

      await handlers['rule_update_automail']({
        id: 1,
        trigger_type: 'tag',
        trigger_id: 42,
      });

      expect(mocks.updateAutomail).toHaveBeenCalledWith(1, {
        trigger: { type: 'TAG', id: 42 },
      });
    });
  });
});
