import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts } from '../prompts/index.js';

type PromptHandler = (
  args: Record<string, string | undefined>
) => Promise<{
  messages: Array<{
    role: string;
    content: { type: string; text: string };
  }>;
}>;

interface PromptRegistration {
  name: string;
  description: string;
  params: Record<string, unknown> | undefined;
  handler: PromptHandler;
}

function capturePrompts(): PromptRegistration[] {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const promptSpy = vi.spyOn(server, 'prompt');
  registerPrompts(server);

  const registrations: PromptRegistration[] = [];
  for (const call of promptSpy.mock.calls) {
    // Prompts with parameters: prompt(name, description, params, handler)
    // Prompts without parameters: prompt(name, description, handler)
    const name = call[0] as string;
    const description = call[1] as string;
    const hasParams = call.length === 4;
    const params = hasParams ? (call[2] as Record<string, unknown>) : undefined;
    const handler = call[call.length - 1] as PromptHandler;
    registrations.push({ name, description, params, handler });
  }
  return registrations;
}

const EXPECTED_PROMPTS = [
  // E-commerce
  'create_order_confirmation_email',
  'create_shipping_update_email',
  'create_abandoned_cart_email',
  'create_order_cancellation_email',
  // Hospitality
  'create_reservation_confirmation_email',
  'create_reservation_reminder_email',
  'create_feedback_request_email',
  // Vendor integration
  'setup_shopify_integration',
  'setup_bookzen_integration',
] as const;

describe('prompts', () => {
  let registrations: PromptRegistration[];
  let handlerMap: Record<string, PromptHandler>;
  let registrationMap: Record<string, PromptRegistration>;

  beforeEach(() => {
    registrations = capturePrompts();
    handlerMap = {};
    registrationMap = {};
    for (const reg of registrations) {
      handlerMap[reg.name] = reg.handler;
      registrationMap[reg.name] = reg;
    }
  });

  it('registers all 9 expected prompts', () => {
    const names = registrations.map((r) => r.name);
    expect(names).toHaveLength(EXPECTED_PROMPTS.length);
    for (const name of EXPECTED_PROMPTS) {
      expect(names).toContain(name);
    }
  });

  it('every prompt has a non-empty description', () => {
    for (const reg of registrations) {
      expect(reg.description).toBeTruthy();
      expect(reg.description.length).toBeGreaterThan(10);
    }
  });

  // -- Parameter schema verification --

  describe('parameter schemas', () => {
    it('create_order_confirmation_email has brand_style_id and order_ref_field params', () => {
      const params = registrationMap['create_order_confirmation_email'].params;
      expect(params).toBeDefined();
      expect(params).toHaveProperty('brand_style_id');
      expect(params).toHaveProperty('order_ref_field');
    });

    it('create_shipping_update_email has brand_style_id and tracking_url_field params', () => {
      const params = registrationMap['create_shipping_update_email'].params;
      expect(params).toBeDefined();
      expect(params).toHaveProperty('brand_style_id');
      expect(params).toHaveProperty('tracking_url_field');
    });

    it('create_abandoned_cart_email has brand_style_id and discount_code params', () => {
      const params = registrationMap['create_abandoned_cart_email'].params;
      expect(params).toBeDefined();
      expect(params).toHaveProperty('brand_style_id');
      expect(params).toHaveProperty('discount_code');
    });

    it('create_order_cancellation_email has brand_style_id param', () => {
      const params = registrationMap['create_order_cancellation_email'].params;
      expect(params).toBeDefined();
      expect(params).toHaveProperty('brand_style_id');
    });

    it('create_reservation_confirmation_email has brand_style_id, checkin_field, checkout_field params', () => {
      const params = registrationMap['create_reservation_confirmation_email'].params;
      expect(params).toBeDefined();
      expect(params).toHaveProperty('brand_style_id');
      expect(params).toHaveProperty('checkin_field');
      expect(params).toHaveProperty('checkout_field');
    });

    it('create_reservation_reminder_email has brand_style_id param', () => {
      const params = registrationMap['create_reservation_reminder_email'].params;
      expect(params).toBeDefined();
      expect(params).toHaveProperty('brand_style_id');
    });

    it('create_feedback_request_email has brand_style_id and feedback_url params', () => {
      const params = registrationMap['create_feedback_request_email'].params;
      expect(params).toBeDefined();
      expect(params).toHaveProperty('brand_style_id');
      expect(params).toHaveProperty('feedback_url');
    });

    it('setup_shopify_integration has no parameters', () => {
      const params = registrationMap['setup_shopify_integration'].params;
      expect(params).toBeUndefined();
    });

    it('setup_bookzen_integration has no parameters', () => {
      const params = registrationMap['setup_bookzen_integration'].params;
      expect(params).toBeUndefined();
    });
  });

  // -- Handler smoke tests --

  describe('handler content structure', () => {
    it('create_order_confirmation_email returns valid content with defaults', async () => {
      const result = await handlerMap['create_order_confirmation_email']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      expect(result.messages[0].content.text).toContain('Order Confirmation Email');
      expect(result.messages[0].content.text).toContain('Order.OrderNumber');
    });

    it('create_order_confirmation_email uses custom parameters', async () => {
      const result = await handlerMap['create_order_confirmation_email']({
        brand_style_id: '99',
        order_ref_field: 'Custom.RefNumber',
      });

      expect(result.messages[0].content.text).toContain('99');
      expect(result.messages[0].content.text).toContain('Custom.RefNumber');
    });

    it('create_shipping_update_email returns valid content with defaults', async () => {
      const result = await handlerMap['create_shipping_update_email']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      expect(result.messages[0].content.text).toContain('Shipping Update Email');
      expect(result.messages[0].content.text).toContain('Shipment.TrackingUrl');
    });

    it('create_shipping_update_email uses custom tracking field', async () => {
      const result = await handlerMap['create_shipping_update_email']({
        tracking_url_field: 'Custom.TrackUrl',
      });

      expect(result.messages[0].content.text).toContain('Custom.TrackUrl');
    });

    it('create_abandoned_cart_email returns valid content with defaults', async () => {
      const result = await handlerMap['create_abandoned_cart_email']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('Abandoned Cart Recovery Email');
      expect(result.messages[0].content.text).toContain('Optional incentive');
    });

    it('create_abandoned_cart_email includes discount code when provided', async () => {
      const result = await handlerMap['create_abandoned_cart_email']({
        discount_code: 'SAVE10',
      });

      expect(result.messages[0].content.text).toContain('SAVE10');
      expect(result.messages[0].content.text).toContain('Discount incentive');
    });

    it('create_order_cancellation_email returns valid content', async () => {
      const result = await handlerMap['create_order_cancellation_email']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('Order Cancellation Email');
    });

    it('create_reservation_confirmation_email returns valid content with defaults', async () => {
      const result = await handlerMap['create_reservation_confirmation_email']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('Reservation Confirmation Email');
      expect(result.messages[0].content.text).toContain('Booking.CheckInDate');
      expect(result.messages[0].content.text).toContain('Booking.CheckOutDate');
    });

    it('create_reservation_confirmation_email uses custom date fields', async () => {
      const result = await handlerMap['create_reservation_confirmation_email']({
        checkin_field: 'Stay.Arrival',
        checkout_field: 'Stay.Departure',
      });

      expect(result.messages[0].content.text).toContain('Stay.Arrival');
      expect(result.messages[0].content.text).toContain('Stay.Departure');
    });

    it('create_reservation_reminder_email returns valid content', async () => {
      const result = await handlerMap['create_reservation_reminder_email']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('Reservation Reminder Email');
    });

    it('create_feedback_request_email returns valid content with defaults', async () => {
      const result = await handlerMap['create_feedback_request_email']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content.text).toContain('Post-Stay Feedback Request Email');
      expect(result.messages[0].content.text).toContain('example.com/feedback');
    });

    it('create_feedback_request_email uses custom feedback URL', async () => {
      const result = await handlerMap['create_feedback_request_email']({
        feedback_url: 'https://myhotel.com/review',
      });

      expect(result.messages[0].content.text).toContain('https://myhotel.com/review');
    });

    it('setup_shopify_integration returns valid content', async () => {
      const result = await handlerMap['setup_shopify_integration']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      expect(result.messages[0].content.text).toContain('Setting Up Shopify with Rule.io');
      expect(result.messages[0].content.text).toContain('shopify_order_created');
    });

    it('setup_bookzen_integration returns valid content', async () => {
      const result = await handlerMap['setup_bookzen_integration']({});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      expect(result.messages[0].content.text).toContain('Setting Up Bookzen with Rule.io');
      expect(result.messages[0].content.text).toContain('bookzen_reservation_created');
    });
  });

  // -- Brand style parameter behavior --

  describe('brand style parameter behavior', () => {
    it('includes brand style ID reference when provided', async () => {
      const result = await handlerMap['create_order_confirmation_email']({
        brand_style_id: '123',
      });

      expect(result.messages[0].content.text).toContain('**Brand style ID**: 123');
    });

    it('suggests listing brand styles when no ID provided', async () => {
      const result = await handlerMap['create_order_confirmation_email']({});

      expect(result.messages[0].content.text).toContain('rule_list_brand_styles');
    });
  });
});
