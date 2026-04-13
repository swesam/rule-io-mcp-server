# Guided QA Walkthrough: Rule.io MCP in Claude Desktop

## Context
Testing all 35 tools, 7 resources, and 9 prompts as a marketer in Claude Desktop. Server is already running. I'll walk you through each step — paste the prompts, report back what happened, and we'll move to the next one.

---

## Step 1: Verify Connection & Resources
Paste into Claude Desktop:

> **Prompt:** "What tags do I have in my Rule.io account? Also show me my brand styles."

**What to look for:** Claude should call `rule_list_tags` and `rule_list_brand_styles` (or read the `rule://tags` and `rule://brand-styles` resources). You should see real data from your account.

**Report back:** The tag names and brand style names/IDs — we'll need these for later steps.

---

## Step 2: Subscriber CRUD
We'll create a test subscriber, look them up, tag them, then clean up.

> **Prompt:** "Create a new subscriber with email qa-test@example.com"

Then:

> **Prompt:** "Look up the subscriber qa-test@example.com and show me their full profile"

**What to look for:** `rule_create_subscriber` then `rule_get_subscriber`. Note the subscriber's numeric ID.

---

## Step 3: Tag a Subscriber
Pick a tag name from Step 1's results:

> **Prompt:** "Add the tag '[TAG_NAME]' to qa-test@example.com"

**What to look for:** `rule_manage_subscriber_tags` with action `add`.

---

## Step 4: Create a Welcome Automation
This is the big test — it creates 4 resources in one call. Use a brand style ID from Step 1:

> **Prompt:** "Create a welcome email automation triggered by the tag '[TAG_NAME]'. Use brand style [ID]. Subject: 'Welcome aboard!'. Include a heading 'Welcome!', a text paragraph 'Thanks for joining us — we're excited to have you.', and a button 'Explore now' linking to https://example.com"

**What to look for:** `rule_create_automation_email` with `brand_style_id`, `sections`, and `trigger_tag`. Should return the automation ID.

---

## Step 5: Verify the Automation
> **Prompt:** "List my automations and show me details of the one we just created"

**What to look for:** `rule_list_automations` then `rule_get_automation`.

---

## Step 6: Create a Campaign Email
> **Prompt:** "Create a campaign called 'April Newsletter' for subscribers tagged '[TAG_NAME]'. Subject: 'Your April Update'. Use brand style [ID]. Include a heading 'April News', a text block about spring promotions, and a CTA button 'Shop now' to https://example.com/spring"

**What to look for:** `rule_create_campaign_email` with tag targeting + sections.

---

## Step 7: Campaign Operations
> **Prompt:** "Show me my campaigns. Then duplicate the April Newsletter."

**What to look for:** `rule_list_campaigns` then `rule_copy_campaign`.

---

## Step 8: Template & Render
> **Prompt:** "List my email templates and render the one from the April Newsletter as HTML"

**What to look for:** `rule_list_templates` then `rule_render_template`.

---

## Step 9: Analytics
> **Prompt:** "How did my campaigns perform over the last 30 days? Show me opens and clicks."

**What to look for:** `rule_get_analytics` with `object_type`, `object_ids`, and `metrics`. Claude should first call `rule_list_campaigns` to find campaign IDs, then call `rule_get_analytics` with those IDs.

> **Prompt (account-wide):** "Export my email statistics for the last 30 days"

**What to look for:** `rule_export_data` with type `statistics` and a 30-day date range. This is the correct tool for account-wide summaries (no object IDs needed).

---

## Step 10: Prompt-Guided Flow
Test one of the built-in prompts:

> **Prompt:** "Help me create an abandoned cart email"

**What to look for:** The `create_abandoned_cart_email` prompt should activate, guiding you through creating an automation with e-commerce-specific content.

---

## Step 11: Error Handling
> **Prompt:** "Look up the subscriber doesnt-exist-12345@nowhere.test"

**What to look for:** Should return a friendly "not found" message, not a raw error or crash.

---

## Step 12: Cleanup
> **Prompt:** "Delete the automation and campaigns we created during testing. Also delete the subscriber qa-test@example.com."

**What to look for:** `rule_delete_automation`, `rule_delete_campaign` (x2 for original + copy), `rule_delete_subscriber`.

---

## Step 13: Bulk Tag Operations
First, make sure you have at least two test subscribers (create qa-test@example.com and qa-test2@example.com if needed).

> **Prompt:** "Add the tags 'qa-bulk-1' and 'qa-bulk-2' to these subscribers at once: qa-test@example.com and qa-test2@example.com"

**What to look for:** `rule_bulk_manage_tags` with action `add`, an array of two tag names, and an array of two subscriber identifiers (each with `email`).

Then:

> **Prompt:** "Remove the tag 'qa-bulk-1' from qa-test@example.com and qa-test2@example.com in bulk"

**What to look for:** `rule_bulk_manage_tags` with action `remove`.

---

## Step 14: Suppress / Unsuppress

> **Prompt:** "Suppress qa-test@example.com from receiving emails"

**What to look for:** `rule_suppress_subscribers` called with `subscribers: [{ email: "qa-test@example.com" }]`.

Then:

> **Prompt:** "Unsuppress qa-test@example.com so they can receive emails again"

**What to look for:** `rule_unsuppress_subscribers` with the same subscriber.

---

## Step 15: Set Custom Fields
First, re-fetch the subscriber ID (Step 12 may have deleted the original):

> **Prompt:** "Look up the subscriber qa-test@example.com and show me their full profile"

Then use that current ID:

> **Prompt:** "Set custom fields on subscriber [ID]: in the 'Order' group, set OrderNumber to 'ORD-12345' and Status to 'Confirmed'"

**What to look for:** `rule_set_subscriber_fields` with the current `subscriber_id`, `groups` array containing group name `"Order"` and two field values. Groups and fields should be created automatically.

Then verify:

> **Prompt:** "Look up qa-test@example.com and show me their custom fields"

**What to look for:** `rule_get_subscriber` should show the Order group with the values we just set.

---

## Step 16: Subscriber Blocking

> **Prompt:** "Block the subscriber qa-test@example.com from receiving any emails"

**What to look for:** `rule_block_subscribers` with `action: "block"` and `subscribers: [{ email: "qa-test@example.com" }]`.

Then:

> **Prompt:** "Unblock qa-test@example.com"

**What to look for:** `rule_block_subscribers` with `action: "unblock"` and `subscribers: [{ email: "qa-test@example.com" }]`.

---

## Step 17: Export Data

> **Prompt:** "Export my email statistics for the last 7 days"

**What to look for:** `rule_export_data` with type `statistics`, `date_from` and `date_to` set to a 7-day range.

Then:

> **Prompt:** "Export dispatchers for today"

**What to look for:** `rule_export_data` with type `dispatchers` and a single-day date range.

---

## Step 18: E-commerce & Hospitality Prompts
Test the prompt-guided flows for e-commerce and hospitality:

> **Prompt:** "Help me create an order confirmation email"

**What to look for:** The `create_order_confirmation_email` prompt should activate. Check for correct merge tags (`{{Order.OrderNumber}}`, `{{Order.TotalPrice}}`), a sections-based example with content blocks (heading, text, button), and brand style handling.

Then:

> **Prompt:** "Help me set up a reservation confirmation email"

**What to look for:** The `create_reservation_confirmation_email` prompt should activate. Check for hospitality merge tags (`{{Booking.CheckInDate}}`, `{{Booking.CheckOutDate}}`, `{{Booking.ConfirmationNumber}}`).

---

## Step 19: Integration Setup Prompts

> **Prompt:** "Help me set up Shopify with Rule.io"

**What to look for:** The `setup_shopify_integration` prompt should activate. Should include: expected tags (`shopify_order_created`, `shopify_order_fulfilled`, `shopify_checkout_abandoned`, `shopify_customer_created`), field mapping table, step-by-step setup guide, and testing instructions.

Then:

> **Prompt:** "Help me set up Bookzen with Rule.io"

**What to look for:** The `setup_bookzen_integration` prompt should activate. Should include: expected tags (`bookzen_reservation_created`, `bookzen_checkin_approaching`, `bookzen_checkout_completed`, `bookzen_reservation_cancelled`), booking field mappings, and step-by-step guide.

---

## Step 20: Final Cleanup
Clean up all test data from the extended testing. Note: there is no `rule_delete_tag` tool — tag cleanup must be done manually in the Rule.io UI.

> **Prompt:** "Delete the test subscribers qa-test@example.com and qa-test2@example.com. Then list my tags so I can confirm whether the test tags (qa-bulk-1, qa-bulk-2) still exist and need manual removal."

**What to look for:** `rule_delete_subscriber` for each subscriber, then `rule_list_tags` to check for leftover test tags. If they exist, remove them manually in the Rule.io UI.

---

## Verification
After each step, report back:
1. Did Claude pick the right tool(s)?
2. Did the tool succeed or error?
3. Was the response useful for a marketer (not too technical)?
4. Any unexpected behavior?
