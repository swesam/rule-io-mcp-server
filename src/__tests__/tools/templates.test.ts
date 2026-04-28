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
    it('returns a campaign owner and skips the automations scan entirely', async () => {
      const templateId = 42;

      mocks.listCampaigns.mockResolvedValue({
        data: [
          { id: 1, name: 'Campaign 1', status: 'sent' },
          { id: 2, name: 'Campaign 2', status: 'draft' },
        ],
      });

      // Campaign 1's first message owns the template — scan must stop here.
      mocks.listMessages.mockResolvedValueOnce({ data: [{ id: 10, subject: 'Campaign 1 Email' }] });
      mocks.listDynamicSets.mockResolvedValueOnce({ data: [{ template_id: 42 }] });

      const result = await handlers['rule_find_template_usage']({ id: templateId });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.template_id).toBe(42);
      expect(parsed.owner).toEqual({
        kind: 'campaign',
        id: 1,
        name: 'Campaign 1',
        subject: 'Campaign 1 Email',
        status: 'sent',
      });
      expect(parsed.scanned.campaigns).toBe(1);
      expect(parsed.scanned.automations).toBe(0);
      expect(parsed.partial_errors).toBeUndefined();
      // 1:1 invariant: once a campaign owner is found, automations must not be scanned.
      expect(mocks.listAutomations).not.toHaveBeenCalled();
    });

    it('returns an automation owner when no campaign owns the template', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [{ id: 1, name: 'Campaign 1', status: 'draft' }],
      });
      mocks.listMessages
        .mockResolvedValueOnce({ data: [{ id: 10, subject: 'Campaign Email' }] }) // campaign's message
        .mockResolvedValueOnce({ data: [{ id: 20, subject: 'Auto Email' }] }); // automation's message
      mocks.listDynamicSets
        .mockResolvedValueOnce({ data: [{ template_id: 99 }] }) // campaign owns a different template
        .mockResolvedValueOnce({ data: [{ template_id: 42 }] }); // automation owns target

      mocks.listAutomations.mockResolvedValue({
        data: [{ id: 100, name: 'Auto 1', active: true, trigger: { type: 'TAG' } }],
      });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.owner).toEqual({
        kind: 'automation',
        id: 100,
        name: 'Auto 1',
        active: true,
        trigger_type: 'TAG',
      });
      expect(parsed.scanned.campaigns).toBe(1);
      expect(parsed.scanned.automations).toBe(1);
    });

    it('returns owner: null when no dispatcher owns the template', async () => {
      mocks.listCampaigns.mockResolvedValue({ data: [] });
      mocks.listAutomations.mockResolvedValue({ data: [] });

      const result = await handlers['rule_find_template_usage']({ id: 999 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.owner).toBeNull();
      expect(parsed.scanned.campaigns).toBe(0);
      expect(parsed.scanned.automations).toBe(0);
    });

    it('stops paginating campaigns once a match is found on page 1', async () => {
      // Full page of 100 campaigns, none owning the template except the last one.
      const page1Campaigns = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `C${i + 1}`,
        status: 'draft',
      }));

      mocks.listCampaigns.mockResolvedValueOnce({ data: page1Campaigns });

      // First 99 campaigns own a different template; campaign 100 owns template 42.
      for (let i = 0; i < 99; i++) {
        mocks.listMessages.mockResolvedValueOnce({ data: [{ id: 1000 + i, subject: `E${i + 1}` }] });
        mocks.listDynamicSets.mockResolvedValueOnce({ data: [{ template_id: 99 }] });
      }
      mocks.listMessages.mockResolvedValueOnce({ data: [{ id: 1099, subject: 'E100' }] });
      mocks.listDynamicSets.mockResolvedValueOnce({ data: [{ template_id: 42 }] });

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.owner?.kind).toBe('campaign');
      expect(parsed.owner?.id).toBe(100);
      expect(parsed.scanned.campaigns).toBe(100);
      // Page loop must terminate on match — no second page fetched, no automations scanned.
      expect(mocks.listCampaigns).toHaveBeenCalledTimes(1);
      expect(mocks.listAutomations).not.toHaveBeenCalled();
    });

    it('records partial errors and still finds a later owner in the same pass', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [
          { id: 1, name: 'Campaign 1', status: 'draft' },
          { id: 2, name: 'Campaign 2', status: 'draft' },
        ],
      });

      mocks.listMessages
        .mockResolvedValueOnce({ data: [{ id: 10, subject: 'Email 1' }] })
        .mockResolvedValueOnce({ data: [{ id: 11, subject: 'Email 2' }] });

      mocks.listDynamicSets
        .mockRejectedValueOnce(new RuleApiError('Server Error', 500)) // Campaign 1 fails
        .mockResolvedValueOnce({ data: [{ template_id: 42 }] }); // Campaign 2 is the owner

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.owner?.kind).toBe('campaign');
      expect(parsed.owner?.id).toBe(2);
      expect(parsed.scanned.campaigns).toBe(2);
      expect(parsed.partial_errors).toHaveLength(1);
      expect(parsed.partial_errors[0].kind).toBe('campaign');
      expect(parsed.partial_errors[0].id).toBe(1);
      expect(parsed.partial_errors[0].message_id).toBe(10);
      // Owner was found in the campaigns pass — automations must not be scanned.
      expect(mocks.listAutomations).not.toHaveBeenCalled();
    });

    it('handles API error on listCampaigns', async () => {
      mocks.listCampaigns.mockRejectedValue(new RuleApiError('Server Error', 500));

      const result = await handlers['rule_find_template_usage']({ id: 42 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rule.io API error (500)');
    });

    it('aborts the scan on auth failure instead of accumulating partial_errors', async () => {
      mocks.listCampaigns.mockResolvedValue({
        data: [
          { id: 1, name: 'Campaign 1', status: 'draft' },
          { id: 2, name: 'Campaign 2', status: 'draft' },
        ],
      });
      mocks.listMessages.mockRejectedValue(new RuleApiError('Unauthorized', 401));

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
      expect(parsed.owner).toBeNull();
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
      expect(parsed.owner).toBeNull();
      expect(parsed.partial_errors).toHaveLength(1);
      expect(parsed.partial_errors[0].status_code).toBeUndefined();
      expect(parsed.partial_errors[0].error).toBe('network blip');
    });
  });
});
