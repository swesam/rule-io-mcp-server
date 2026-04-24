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
  listCampaigns: ReturnType<typeof vi.fn>;
  listAutomations: ReturnType<typeof vi.fn>;
  listMessages: ReturnType<typeof vi.fn>;
  listDynamicSets: ReturnType<typeof vi.fn>;
  asClient: RuleClient;
}

function createMockClient(): MockClient {
  const mocks = {
    createTemplate: vi.fn(),
    listTemplates: vi.fn(),
    renderTemplate: vi.fn(),
    getTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    listCampaigns: vi.fn(),
    listAutomations: vi.fn(),
    listMessages: vi.fn(),
    listDynamicSets: vi.fn(),
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

    it('returns isError on API failure', async () => {
      mocks.renderTemplate.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_render_template']({ id: 10 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
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

    it('returns isError on API failure', async () => {
      mocks.listTemplates.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_list_templates']({ page: 1, per_page: 25 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
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

    it('returns isError on API failure', async () => {
      mocks.getTemplate.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_get_template']({ id: 10 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
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

  describe('rule_find_template_usage', () => {
    it('finds campaigns and automations using a template (happy path)', async () => {
      const templateId = 42;

      // Mock campaigns
      mocks.listCampaigns.mockResolvedValue({
        data: [
          { id: 1, name: 'Campaign 1', status: 'sent' },
          { id: 2, name: 'Campaign 2', status: 'draft' },
        ],
      });

      // Mock messages for each campaign
      mocks.listMessages
        .mockResolvedValueOnce({ data: [{ id: 10, subject: 'Campaign 1 Email' }] })
        .mockResolvedValueOnce({ data: [{ id: 11, subject: 'Campaign 2 Email' }] })
        .mockResolvedValueOnce({ data: [{ id: 20, subject: 'Auto Email' }] });

      // Mock dynamic sets (templates)
      mocks.listDynamicSets
        .mockResolvedValueOnce({ data: [{ template_id: 42 }] }) // Campaign 1 uses template 42
        .mockResolvedValueOnce({ data: [{ template_id: 99 }] }) // Campaign 2 uses different template
        .mockResolvedValueOnce({ data: [{ template_id: 42 }] }); // Automation uses template 42

      // Mock automations
      mocks.listAutomations.mockResolvedValue({
        data: [{ id: 100, name: 'Auto 1', active: true, trigger: { type: 'TAG' } }],
      });

      const result = await handlers['rule_find_template_usage']({ id: templateId });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.template_id).toBe(42);
      expect(parsed.campaigns).toHaveLength(1);
      expect(parsed.campaigns[0].id).toBe(1);
      expect(parsed.campaigns[0].name).toBe('Campaign 1');
      expect(parsed.automations).toHaveLength(1);
      expect(parsed.automations[0].id).toBe(100);
      expect(parsed.scanned.campaigns).toBe(2);
      expect(parsed.scanned.automations).toBe(1);
      expect(parsed.partial_errors).toBeUndefined();
    });

    it('handles template with no usage (empty result)', async () => {
      mocks.listCampaigns.mockResolvedValue({ data: [] });
      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 999 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.campaigns).toEqual([]);
      expect(parsed.automations).toEqual([]);
      expect(parsed.scanned.campaigns).toBe(0);
      expect(parsed.scanned.automations).toBe(0);
    });

    it('handles partial failure during message resolution', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [
          { id: 1, name: 'Campaign 1', status: 'draft' },
          { id: 2, name: 'Campaign 2', status: 'draft' },
        ],
      });

      mocks.listMessages
        .mockResolvedValueOnce({ data: [{ id: 10, subject: 'Email 1' }] })
        .mockResolvedValueOnce({ data: [{ id: 11, subject: 'Email 2' }] })
        .mockResolvedValueOnce({ data: [{ id: 20, subject: 'Auto' }] });

      // First dynamic set call succeeds, second fails, third succeeds
      mocks.listDynamicSets
        .mockResolvedValueOnce({ data: [{ template_id: 42 }] })
        .mockRejectedValueOnce(new RuleApiError('Server Error', 500))
        .mockResolvedValueOnce({ data: [{ template_id: 42 }] });

      mocks.listAutomations.mockResolvedValue({
        data: [{ id: 100, name: 'Auto 1', active: true }],
      });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.campaigns).toHaveLength(1);
      expect(parsed.campaigns[0].id).toBe(1);
      expect(parsed.automations).toHaveLength(1);
      expect(parsed.scanned.campaigns).toBe(2);
      expect(parsed.partial_errors).toHaveLength(1);
      expect(parsed.partial_errors[0].kind).toBe('campaign');
      expect(parsed.partial_errors[0].id).toBe(2);
      expect(parsed.partial_errors[0].message_id).toBe(11);
    });

    it('paginates through campaigns (2 pages)', async () => {
      // First page: 100 campaigns (full page, triggers next page fetch)
      const page1Campaigns = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `C${i + 1}`,
        status: 'draft',
      }));
      // Second page: 1 campaign (less than 100, stops pagination)
      const page2Campaigns = [{ id: 101, name: 'C101', status: 'draft' }];

      mocks.listCampaigns
        .mockResolvedValueOnce({ data: page1Campaigns })
        .mockResolvedValueOnce({ data: page2Campaigns });

      // Mock messages and dynamic sets for all 101 campaigns
      for (let i = 0; i < 101; i++) {
        mocks.listMessages.mockResolvedValueOnce({
          data: [{ id: 1000 + i, subject: `E${i + 1}` }],
        });
        mocks.listDynamicSets.mockResolvedValueOnce({
          data: [{ template_id: 42 }],
        });
      }

      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.scanned.campaigns).toBe(101);
      expect(parsed.campaigns).toHaveLength(101);
    });

    it('paginates through automations (2 pages)', async () => {
      mocks.listCampaigns.mockResolvedValue({ data: [] });

      // First page: 100 automations (full page, triggers next page fetch)
      const page1Automations = Array.from({ length: 100 }, (_, i) => ({
        id: 1000 + i,
        name: `A${i + 1}`,
        active: true,
      }));
      // Second page: 1 automation (less than 100, stops pagination)
      const page2Automations = [{ id: 1100, name: 'A101', active: false }];

      mocks.listAutomations
        .mockResolvedValueOnce({ data: page1Automations })
        .mockResolvedValueOnce({ data: page2Automations });

      // Mock messages and dynamic sets for all 101 automations
      for (let i = 0; i < 101; i++) {
        mocks.listMessages.mockResolvedValueOnce({
          data: [{ id: 2000 + i, subject: `E${i + 1}` }],
        });
        mocks.listDynamicSets.mockResolvedValueOnce({
          data: [{ template_id: 42 }],
        });
      }

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.scanned.automations).toBe(101);
      expect(parsed.automations).toHaveLength(101);
    });

    it('handles API error on listCampaigns', async () => {
      mocks.listCampaigns.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });

    it('handles campaign-level errors gracefully', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [
          { id: 1, name: 'Campaign 1', status: 'draft' },
          { id: 2, name: 'Campaign 2', status: 'draft' },
        ],
      });

      // First campaign's listMessages call fails; second campaign succeeds.
      mocks.listMessages
        .mockRejectedValueOnce(new RuleApiError('Error', 500))
        .mockResolvedValueOnce({ data: [{ id: 11, subject: 'E2' }] });

      mocks.listDynamicSets.mockResolvedValueOnce({ data: [{ template_id: 42 }] });

      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.scanned.campaigns).toBe(2);
      expect(parsed.campaigns).toHaveLength(1);
      expect(parsed.partial_errors).toBeDefined();
      expect(parsed.partial_errors[0].kind).toBe('campaign');
      expect(parsed.partial_errors[0].id).toBe(1);
      expect(mocks.listMessages).toHaveBeenCalledTimes(2);
    });

    it('aborts the scan on auth failure instead of accumulating partial_errors', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [
          { id: 1, name: 'Campaign 1', status: 'draft' },
          { id: 2, name: 'Campaign 2', status: 'draft' },
        ],
      });
      mocks.listMessages.mockRejectedValue(new RuleApiError('Unauthorized', 401));
      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication failed');
      // Scan should stop at the first failing call — don't hammer the API.
      expect(mocks.listMessages).toHaveBeenCalledTimes(1);
    });

    it('aborts the scan on rate-limit and surfaces the friendly message', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [{ id: 1, name: 'C1', status: 'draft' }],
      });
      mocks.listMessages.mockResolvedValue({ data: [{ id: 10, subject: 'E' }] });
      mocks.listDynamicSets.mockRejectedValue(new RuleApiError('Too many requests', 429));
      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rate limited');
    });

    it('includes status_code on RuleApiError entries in partial_errors', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [{ id: 1, name: 'C1', status: 'draft' }],
      });
      mocks.listMessages.mockRejectedValueOnce(new RuleApiError('Not Found', 404));
      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.partial_errors).toHaveLength(1);
      expect(parsed.partial_errors[0].status_code).toBe(404);
      expect(parsed.partial_errors[0].error).toContain('Rule.io API error (404)');
      expect(parsed.partial_errors[0].error).toContain('Not Found');
    });

    it('omits status_code when the error is not a RuleApiError', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [{ id: 1, name: 'C1', status: 'draft' }],
      });
      mocks.listMessages.mockRejectedValueOnce(new Error('network blip'));
      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.partial_errors).toHaveLength(1);
      expect(parsed.partial_errors[0].status_code).toBeUndefined();
      expect(parsed.partial_errors[0].error).toBe('network blip');
    });
  });
});
