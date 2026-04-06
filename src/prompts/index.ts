import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// -- E-commerce prompt content builders --

function orderConfirmationPrompt(brandStyleId?: string, orderRefField?: string): string {
  const field = orderRefField ?? 'Order.OrderNumber';
  const brandNote = brandStyleId
    ? `- **Brand style ID**: ${brandStyleId} (passed as brand_style_id)`
    : '- **Brand style**: Use `rule_list_brand_styles` to see available styles, then pass the ID as brand_style_id';

  return `## Order Confirmation Email

This automation sends a confirmation email when a subscriber is tagged with an order-related tag.

### What you'll need:
- **Trigger tag**: The tag that fires when an order is placed (use \`rule_list_tags\` to find it)
- **Subject line**: e.g. "Your order {{${field}}} is confirmed!"
${brandNote}

### Template structure:
The order confirmation email typically includes:
- Company logo and brand header
- Order number and confirmation message
- Line items (if available via merge tags)
- Shipping/delivery info
- CTA button (e.g. "Track Your Order")

### Example tool call:
Use \`rule_create_automation_email\` with:
- \`name\`: "Order Confirmation"
- \`trigger_tag\`: "<your order tag>"
- \`subject\`: "Order {{${field}}} confirmed!"
- \`template\`: An RCML document with a heading, body text referencing {{${field}}}, and a CTA button
- \`sendout_type\`: "transactional"

### Merge tags:
Common order merge tags: \`{{${field}}}\`, \`{{Order.TotalPrice}}\`, \`{{Order.Currency}}\`
Adjust field names based on your integration (Shopify, custom, etc.).

💡 **Tip**: If you have a Shopify integration, use the \`setup_shopify_integration\` prompt first to ensure your field mappings are correct.`;
}

function shippingUpdatePrompt(brandStyleId?: string, trackingUrlField?: string): string {
  const trackingNote = trackingUrlField
    ? `Use the tracking URL field \`{{${trackingUrlField}}}\` in your CTA button.`
    : 'If your integration provides a tracking URL field, use it in the CTA button (e.g. `{{Shipment.TrackingUrl}}`).';
  const brandNote = brandStyleId
    ? `- **Brand style ID**: ${brandStyleId}`
    : '- **Brand style**: Use `rule_list_brand_styles` to see available styles';

  return `## Shipping Update Email

This automation notifies a subscriber when their order has shipped.

### What you'll need:
- **Trigger tag**: The tag that fires when a shipment is created (use \`rule_list_tags\` to find it)
- **Subject line**: e.g. "Your order is on its way!"
${brandNote}

### Template structure:
- Brand header
- Shipment confirmation message
- Tracking number and carrier info
- CTA button: "Track Your Shipment"
- Estimated delivery date (if available)

### Tracking URL:
${trackingNote}

### Example tool call:
Use \`rule_create_automation_email\` with:
- \`name\`: "Shipping Update"
- \`trigger_tag\`: "<your shipment tag>"
- \`subject\`: "Your order has shipped!"
- \`template\`: RCML document with shipping details and tracking CTA
- \`sendout_type\`: "transactional"

💡 **Tip**: Pair this with an order confirmation email for a complete post-purchase flow.`;
}

function abandonedCartPrompt(brandStyleId?: string, discountCode?: string): string {
  const brandNote = brandStyleId
    ? `- **Brand style ID**: ${brandStyleId}`
    : '- **Brand style**: Use `rule_list_brand_styles` to see available styles';
  const discountSection = discountCode
    ? `\n### Discount incentive:\nInclude the discount code **${discountCode}** in the email body to encourage completion. Example copy: "Use code ${discountCode} for 10% off your order!"`
    : '\n### Optional incentive:\nConsider including a discount code to encourage cart completion. If you have one, re-run this prompt with the `discount_code` argument.';

  return `## Abandoned Cart Recovery Email

This automation sends a recovery email when a subscriber abandons their cart.

### What you'll need:
- **Trigger tag**: The tag that fires on cart abandonment (use \`rule_list_tags\` to find it)
- **Subject line**: e.g. "You left something behind!" or "Complete your order"
${brandNote}
- **Timing**: Typically sent 1-3 hours after abandonment

### Template structure:
- Brand header
- Urgency-focused headline (e.g. "Don't miss out!")
- Cart item reminder (if merge tags available)
- Clear CTA button: "Complete Your Order"
- Social proof or trust signals
${discountSection}

### Copy tips for higher conversions:
1. **Create urgency**: "Items in your cart are selling fast"
2. **Keep it short**: One clear message and one CTA
3. **Be personal**: Use \`{{Subscriber.FirstName}}\` if available
4. **Remove friction**: Link directly to the cart page

### Example tool call:
Use \`rule_create_automation_email\` with:
- \`name\`: "Abandoned Cart Recovery"
- \`trigger_tag\`: "<your cart abandonment tag>"
- \`subject\`: "You left something in your cart!"
- \`template\`: RCML document with urgency copy and cart CTA
- \`sendout_type\`: "marketing"

💡 **Tip**: Abandoned cart emails perform best as a series (1h, 24h, 72h). Create multiple automations with different tags for each stage.`;
}

function orderCancellationPrompt(brandStyleId?: string): string {
  const brandNote = brandStyleId
    ? `- **Brand style ID**: ${brandStyleId}`
    : '- **Brand style**: Use `rule_list_brand_styles` to see available styles';

  return `## Order Cancellation Email

This automation notifies a subscriber when their order has been cancelled.

### What you'll need:
- **Trigger tag**: The tag that fires on order cancellation (use \`rule_list_tags\` to find it)
- **Subject line**: e.g. "Your order has been cancelled"
${brandNote}

### Template structure:
- Brand header
- Clear cancellation confirmation
- Order reference number
- Reason for cancellation (if available)
- Refund information and timeline
- Customer support contact info
- CTA: "Contact Support" or "Shop Again"

### Tone guidance:
- Be empathetic and clear
- Provide next steps (refund timeline, re-ordering)
- Include support contact for questions
- Avoid overly promotional tone

### Example tool call:
Use \`rule_create_automation_email\` with:
- \`name\`: "Order Cancellation"
- \`trigger_tag\`: "<your cancellation tag>"
- \`subject\`: "Your order has been cancelled"
- \`template\`: RCML document with cancellation details and support CTA
- \`sendout_type\`: "transactional"`;
}

// -- Hospitality prompt content builders --

function reservationConfirmationPrompt(
  brandStyleId?: string,
  checkinField?: string,
  checkoutField?: string
): string {
  const checkin = checkinField ?? 'Booking.CheckInDate';
  const checkout = checkoutField ?? 'Booking.CheckOutDate';
  const brandNote = brandStyleId
    ? `- **Brand style ID**: ${brandStyleId}`
    : '- **Brand style**: Use `rule_list_brand_styles` to see available styles';

  return `## Reservation Confirmation Email

This automation sends a booking confirmation when a guest makes a reservation.

### What you'll need:
- **Trigger tag**: The tag that fires when a reservation is created (use \`rule_list_tags\` to find it)
- **Subject line**: e.g. "Your reservation is confirmed!"
${brandNote}

### Template structure:
- Brand header with property/hotel logo
- Confirmation headline
- Reservation details: check-in (\`{{${checkin}}}\`), check-out (\`{{${checkout}}}\`)
- Room type and guest count
- Property address and directions
- CTA: "View Your Reservation" or "Add to Calendar"
- Cancellation policy summary

### Merge tags:
Common reservation fields: \`{{${checkin}}}\`, \`{{${checkout}}}\`, \`{{Booking.RoomType}}\`, \`{{Booking.GuestCount}}\`, \`{{Booking.ConfirmationNumber}}\`
Adjust field names based on your booking system (Bookzen, custom, etc.).

### Example tool call:
Use \`rule_create_automation_email\` with:
- \`name\`: "Reservation Confirmation"
- \`trigger_tag\`: "<your booking tag>"
- \`subject\`: "Your reservation is confirmed!"
- \`template\`: RCML document with reservation details
- \`sendout_type\`: "transactional"

💡 **Tip**: If using Bookzen, run the \`setup_bookzen_integration\` prompt first to configure field mappings.`;
}

function reservationReminderPrompt(brandStyleId?: string): string {
  const brandNote = brandStyleId
    ? `- **Brand style ID**: ${brandStyleId}`
    : '- **Brand style**: Use `rule_list_brand_styles` to see available styles';

  return `## Reservation Reminder Email (Pre-Arrival)

This automation sends a reminder before a guest's check-in date.

### What you'll need:
- **Trigger tag**: The tag that fires before check-in (use \`rule_list_tags\` to find it, or create a time-based tag)
- **Subject line**: e.g. "We're looking forward to your stay!"
${brandNote}

### Template structure:
- Brand header
- Warm welcome message with guest name
- Check-in details (date, time, location)
- Pre-arrival checklist (ID, parking info, etc.)
- Local area highlights or amenities
- CTA: "View Your Reservation" or "Get Directions"
- Contact info for questions

### Content suggestions:
- **Practical info**: Check-in time, parking, Wi-Fi details
- **Upsell opportunity**: Spa services, restaurant reservations, room upgrades
- **Local tips**: Nearby restaurants, attractions, transport
- **Weather**: Suggest packing tips if relevant

### Example tool call:
Use \`rule_create_automation_email\` with:
- \`name\`: "Pre-Arrival Reminder"
- \`trigger_tag\`: "<your pre-arrival tag>"
- \`subject\`: "Your stay is coming up - here's what you need to know"
- \`template\`: RCML document with arrival info and local tips
- \`sendout_type\`: "transactional"`;
}

function feedbackRequestPrompt(brandStyleId?: string, feedbackUrl?: string): string {
  const brandNote = brandStyleId
    ? `- **Brand style ID**: ${brandStyleId}`
    : '- **Brand style**: Use `rule_list_brand_styles` to see available styles';
  const ctaUrl = feedbackUrl
    ? `Link the CTA button to: ${feedbackUrl}`
    : 'Link the CTA button to your feedback/review page URL.';

  return `## Post-Stay Feedback Request Email

This automation requests feedback after a guest checks out.

### What you'll need:
- **Trigger tag**: The tag that fires after check-out (use \`rule_list_tags\` to find it)
- **Subject line**: e.g. "How was your stay?"
${brandNote}

### Template structure:
- Brand header
- Thank you message with guest name
- Brief ask for feedback (keep it short)
- Star rating or review prompt
- CTA button: "Share Your Feedback"
- Optional: incentive for completing feedback

### CTA link:
${ctaUrl}

### Best practices:
- **Timing**: Send 24-48 hours after check-out while the experience is fresh
- **Keep it brief**: One clear ask, one button
- **Be genuine**: Thank them for their stay before asking for feedback
- **Make it easy**: Link directly to the review form, not a landing page

### Example tool call:
Use \`rule_create_automation_email\` with:
- \`name\`: "Post-Stay Feedback"
- \`trigger_tag\`: "<your checkout tag>"
- \`subject\`: "How was your stay, {{Subscriber.FirstName}}?"
- \`template\`: RCML document with thank-you message and feedback CTA
- \`sendout_type\`: "marketing"`;
}

// -- Vendor integration prompt content builders --

function shopifyIntegrationPrompt(): string {
  return `## Setting Up Shopify with Rule.io

This guide walks you through connecting Shopify to Rule.io for automated email marketing.

### Step 1: Verify your Rule.io tags
Use \`rule_list_tags\` to check which Shopify-related tags are already synced. Common Shopify tags:
- \`shopify_order_created\` - Fires when an order is placed
- \`shopify_order_fulfilled\` - Fires when an order is shipped
- \`shopify_checkout_abandoned\` - Fires on cart abandonment
- \`shopify_customer_created\` - Fires when a new customer registers

If these tags don't exist yet, they will be created automatically once the Shopify integration is connected in Rule.io.

### Step 2: Understand field mappings
Shopify data is synced to Rule.io subscriber fields. Common mappings:
| Shopify Field | Rule.io Field |
|---|---|
| Order Number | \`{{Order.OrderNumber}}\` |
| Total Price | \`{{Order.TotalPrice}}\` |
| Currency | \`{{Order.Currency}}\` |
| First Name | \`{{Customer.FirstName}}\` |
| Last Name | \`{{Customer.LastName}}\` |
| Shipping Address | \`{{Order.ShippingAddress}}\` |

Use \`rule_list_subscriber_fields\` to see all available fields in your account.

### Step 3: Create your automations
Recommended email automations for Shopify:
1. **Order Confirmation** - Use \`create_order_confirmation_email\` prompt
2. **Shipping Update** - Use \`create_shipping_update_email\` prompt
3. **Abandoned Cart** - Use \`create_abandoned_cart_email\` prompt
4. **Order Cancellation** - Use \`create_order_cancellation_email\` prompt

### Step 4: Test your setup
1. Use \`rule_list_automations\` to verify your automations were created
2. Place a test order in Shopify
3. Check that the subscriber receives the triggered email
4. Use \`rule_render_template\` with a subscriber ID to preview with real data

### Common issues:
- **Tags not appearing**: Ensure the Shopify integration is active in Rule.io settings
- **Merge tags empty**: Check field mappings in Rule.io > Integrations > Shopify
- **Emails not sending**: Verify the automation is active (not paused) in the Rule.io dashboard`;
}

function bookzenIntegrationPrompt(): string {
  return `## Setting Up Bookzen with Rule.io

This guide walks you through connecting Bookzen (hospitality booking system) to Rule.io for automated guest communications.

### Step 1: Verify your Rule.io tags
Use \`rule_list_tags\` to check which Bookzen-related tags are synced. Common Bookzen tags:
- \`bookzen_reservation_created\` - Fires when a booking is made
- \`bookzen_checkin_approaching\` - Fires before check-in date
- \`bookzen_checkout_completed\` - Fires after check-out
- \`bookzen_reservation_cancelled\` - Fires on cancellation

If these tags don't exist, they will appear once the Bookzen integration is connected in Rule.io.

### Step 2: Understand field mappings
Bookzen syncs reservation data to Rule.io subscriber fields. Common mappings:
| Bookzen Field | Rule.io Field |
|---|---|
| Check-in Date | \`{{Booking.CheckInDate}}\` |
| Check-out Date | \`{{Booking.CheckOutDate}}\` |
| Room Type | \`{{Booking.RoomType}}\` |
| Guest Count | \`{{Booking.GuestCount}}\` |
| Confirmation # | \`{{Booking.ConfirmationNumber}}\` |
| Guest First Name | \`{{Subscriber.FirstName}}\` |

Use \`rule_list_subscriber_fields\` to see all available fields.

### Step 3: Create your automations
Recommended email automations for hospitality:
1. **Reservation Confirmation** - Use \`create_reservation_confirmation_email\` prompt
2. **Pre-Arrival Reminder** - Use \`create_reservation_reminder_email\` prompt
3. **Post-Stay Feedback** - Use \`create_feedback_request_email\` prompt

### Step 4: Test your setup
1. Use \`rule_list_automations\` to verify your automations were created
2. Create a test reservation in Bookzen
3. Check that the guest subscriber receives the triggered email
4. Use \`rule_render_template\` with a subscriber ID to preview with real data

### Common issues:
- **Tags not appearing**: Ensure the Bookzen integration is active in Rule.io settings
- **Date fields formatted oddly**: Check date format settings in Rule.io > Integrations > Bookzen
- **Guest data missing**: Verify that Bookzen is syncing guest profiles to Rule.io subscribers`;
}

// -- Registration --

export function registerPrompts(server: McpServer): void {
  // E-commerce prompts

  server.prompt(
    'create_order_confirmation_email',
    'Guide for creating an order confirmation automation email. Returns template structure, required info, and example rule_create_automation_email call.',
    {
      brand_style_id: z.string().optional().describe('Brand style ID to use (from rule_list_brand_styles)'),
      order_ref_field: z
        .string()
        .optional()
        .describe('Merge tag field for order number (default: Order.OrderNumber)'),
    },
    async ({ brand_style_id, order_ref_field }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: orderConfirmationPrompt(brand_style_id, order_ref_field),
          },
        },
      ],
    })
  );

  server.prompt(
    'create_shipping_update_email',
    'Guide for creating a shipping notification automation email. Returns template structure and example rule_create_automation_email call.',
    {
      brand_style_id: z.string().optional().describe('Brand style ID to use (from rule_list_brand_styles)'),
      tracking_url_field: z
        .string()
        .optional()
        .describe('Merge tag field for tracking URL (e.g. Shipment.TrackingUrl)'),
    },
    async ({ brand_style_id, tracking_url_field }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: shippingUpdatePrompt(brand_style_id, tracking_url_field),
          },
        },
      ],
    })
  );

  server.prompt(
    'create_abandoned_cart_email',
    'Guide for creating an abandoned cart recovery automation email with urgency-focused copy tips and optional discount code.',
    {
      brand_style_id: z.string().optional().describe('Brand style ID to use (from rule_list_brand_styles)'),
      discount_code: z.string().optional().describe('Discount code to include in the recovery email'),
    },
    async ({ brand_style_id, discount_code }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: abandonedCartPrompt(brand_style_id, discount_code),
          },
        },
      ],
    })
  );

  server.prompt(
    'create_order_cancellation_email',
    'Guide for creating an order cancellation notification automation email.',
    {
      brand_style_id: z.string().optional().describe('Brand style ID to use (from rule_list_brand_styles)'),
    },
    async ({ brand_style_id }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: orderCancellationPrompt(brand_style_id),
          },
        },
      ],
    })
  );

  // Hospitality prompts

  server.prompt(
    'create_reservation_confirmation_email',
    'Guide for creating a booking/reservation confirmation automation email for hospitality.',
    {
      brand_style_id: z.string().optional().describe('Brand style ID to use (from rule_list_brand_styles)'),
      checkin_field: z
        .string()
        .optional()
        .describe('Merge tag field for check-in date (default: Booking.CheckInDate)'),
      checkout_field: z
        .string()
        .optional()
        .describe('Merge tag field for check-out date (default: Booking.CheckOutDate)'),
    },
    async ({ brand_style_id, checkin_field, checkout_field }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: reservationConfirmationPrompt(brand_style_id, checkin_field, checkout_field),
          },
        },
      ],
    })
  );

  server.prompt(
    'create_reservation_reminder_email',
    'Guide for creating a pre-arrival reminder automation email for hospitality.',
    {
      brand_style_id: z.string().optional().describe('Brand style ID to use (from rule_list_brand_styles)'),
    },
    async ({ brand_style_id }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: reservationReminderPrompt(brand_style_id),
          },
        },
      ],
    })
  );

  server.prompt(
    'create_feedback_request_email',
    'Guide for creating a post-stay feedback request automation email for hospitality.',
    {
      brand_style_id: z.string().optional().describe('Brand style ID to use (from rule_list_brand_styles)'),
      feedback_url: z.string().optional().describe('URL to the feedback/review form'),
    },
    async ({ brand_style_id, feedback_url }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: feedbackRequestPrompt(brand_style_id, feedback_url),
          },
        },
      ],
    })
  );

  // Vendor integration prompts

  server.prompt(
    'setup_shopify_integration',
    'Step-by-step guide for setting up Shopify with Rule.io, including field mappings, tag setup, and automation creation.',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: shopifyIntegrationPrompt(),
          },
        },
      ],
    })
  );

  server.prompt(
    'setup_bookzen_integration',
    'Step-by-step guide for setting up Bookzen (hospitality booking system) with Rule.io.',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: bookzenIntegrationPrompt(),
          },
        },
      ],
    })
  );
}
