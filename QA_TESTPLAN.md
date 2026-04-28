# Guided QA Walkthrough: Rule.io MCP in Claude Desktop

## Context
Testing all 37 tools, 7 resources, and 9 prompts as a marketer in Claude Desktop. Server is already running. I'll walk you through each step — paste the prompts, report back what happened, and we'll move to the next one.

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

Then exercise the `include_analytics` flag added in PR #48/#53:

> **Prompt:** "Show me that automation again and include its open and click metrics for the last 30 days."

**What to look for:** `rule_get_automation` called with `include_analytics: { date_from, date_to, metrics: ["open", "click"] }`. Response should carry an `analytics` array (possibly empty for a brand-new automation) alongside the main automation payload — no separate `rule_get_analytics` call needed.

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

> **Prompt (inline analytics):** "Show me the April Newsletter campaign's details with open and click metrics for the last 30 days in one go."

**What to look for:** Single `rule_get_campaign` call with `include_analytics: { date_from, date_to, metrics: ["open", "click"] }` (PR #48/#53). Response includes both the campaign payload and an `analytics` array. If the analytics fetch fails, the response carries `analytics: []` plus an `analytics_error` string — the main campaign payload should still be intact.

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

## Step 21: Tag Lookup by Name
Quick check that the name-to-ID helper returns a real ID for an existing tag (pick one from Step 1).

> **Prompt:** "Find the tag ID for '[TAG_NAME]'"

**What to look for:** `rule_find_tag` with the name, returning `{ id, name }`.

Then the miss path:

> **Prompt:** "Find the tag ID for 'this-tag-definitely-does-not-exist-xyz'"

**What to look for:** `rule_find_tag` returning a friendly not-found message — not an error result.

---

## Step 22: Segments
> **Prompt:** "List my subscriber segments"

**What to look for:** `rule_list_segments`. Note: segments are not created via MCP — this is a read-only check.

---

## Step 23: Non-Email Campaign Lifecycle
This exercises the campaign tools that the email-wrapper (`rule_create_campaign_email`) skips over.

> **Prompt:** "Create a blank campaign called 'QA Blank Campaign' (no recipients, no template yet)"

**What to look for:** `rule_create_campaign` with the name. Note the returned campaign ID.

Then inspect, update, schedule/cancel, and delete it:

> **Prompt:** "Show me campaign [ID] in detail"

**What to look for:** `rule_get_campaign` with the ID. Response should include `message_type` on the campaign record.

> **Prompt:** "Rename campaign [ID] to 'QA Blank Campaign (renamed)' and change it to transactional"

**What to look for:** `rule_update_campaign` with `name` and `sendout_type: "transactional"`.

> **Prompt:** "Schedule campaign [ID] to send on 2099-12-31 at 10:00, then immediately cancel that schedule"

**What to look for:** Two `rule_schedule_campaign` calls — first with `action: "schedule"` + `datetime`, then with `action: "cancel"`. Verify the "schedule without datetime" error path by asking Claude to schedule without a datetime:

> **Prompt:** "Schedule campaign [ID] — no specific time, just schedule it"

**What to look for:** Either Claude asks for a datetime, or `rule_schedule_campaign` returns an error about `datetime` being required when action is `schedule`.

Finally clean up:

> **Prompt:** "Delete campaign [ID]"

**What to look for:** `rule_delete_campaign`.

---

## Step 24: Automation Pause / Resume
Needs an existing automation. If Step 12 deleted them all, create a fresh one using any tag from Step 1 before running this step.

> **Prompt:** "Pause automation [ID]"

**What to look for:** `rule_update_automation` with `active: false`.

> **Prompt:** "Reactivate automation [ID]"

**What to look for:** `rule_update_automation` with `active: true`. Then delete it with `rule_delete_automation` when done.

---

## Step 25: Template Read & Delete
Pick a template ID from Step 8's `rule_list_templates` output.

> **Prompt:** "Show me the full RCML content of template [ID]"

**What to look for:** `rule_get_template` returning the template with its content.

If you have a disposable test template (e.g. one left over from a prior QA run), delete it:

> **Prompt:** "Delete template [ID]"

**What to look for:** `rule_delete_template`. Do NOT run this against a template that's still linked to a live campaign or automation — use Step 26 first to check ownership.

Note: `rule_create_template` is not exercised manually here because it requires a pre-existing `message_id`. It's covered by the integration test suite; if you need to hit it manually, pull a `message_id` from the last `rule_create_campaign_email` response.

---

## Step 26: Template Ownership Lookup (NEW — PR #49/#54/#55/#56)
`rule_find_template_usage` resolves the single campaign or automation that owns a given template. Each template has at most one owner.

> **Prompt:** "Which campaign or automation is using template [ID]?"

**What to look for:** `rule_find_template_usage` returning `{ template_id, owner, scanned: { campaigns, automations } }`. The `owner` is either a `{ kind: "campaign", id, name, subject, status }` object, a `{ kind: "automation", id, name, active, trigger_type }` object, or `null` for an unowned/orphaned template. If any dispatchers failed to scan, a `partial_errors` array is included.

Now the orphan path — use a template ID that is not linked to any live dispatcher (ask Claude to list templates and pick one that doesn't appear in any campaign/automation):

> **Prompt:** "Check if template [ORPHAN_ID] has an owner"

**What to look for:** `owner: null` in the response, with `scanned.campaigns` and `scanned.automations` both reflecting a full walk of each list (equal to the dispatcher counts in your account — non-zero on a typical QA account).

---

## Step 27: List Subscribers by Tag (NEW — PR #50/#59)
Requires at least one subscriber carrying a given tag. Use a tag from Step 1 that you know has subscribers (or reuse `qa-bulk-1` / `qa-bulk-2` from Step 13 if those subscribers still exist — if you ran Step 20, recreate the subscribers first).

First resolve the tag's numeric ID via `rule_find_tag` (Step 21), then:

> **Prompt:** "List subscribers who have tag ID [TAG_ID]"

**What to look for:** `rule_list_subscribers_by_tag` with `tag_ids: [TAG_ID]`. Response should include the matching subscribers and a pagination cursor.

Then the intersection path (subscribers that have **all** provided tags):

> **Prompt:** "List subscribers who have BOTH tag ID [TAG_ID_1] AND tag ID [TAG_ID_2]"

**What to look for:** `rule_list_subscribers_by_tag` with `tag_ids: [ID_1, ID_2]` — results should be the intersection, not the union.

Validation check:

> **Prompt:** "List subscribers who have no tags"

**What to look for:** Claude should either push back (tag_ids is non-empty) or the tool should return a Zod validation error saying `tag_ids` must have at least one entry.

---

## Step 28: Brand Style Management
> **Prompt:** "Create a brand style from the domain anthropic.com and call it 'QA Brand Test'"

**What to look for:** `rule_manage_brand_style` with `action: "create_from_domain"` and the domain. Note the returned brand style ID.

> **Prompt:** "Show me the full details (colours, fonts, links) of brand style [ID]"

**What to look for:** `rule_get_brand_style` returning colours, fonts, images, and links.

> **Prompt:** "Rename brand style [ID] to 'QA Brand Test (renamed)'"

**What to look for:** `rule_manage_brand_style` with `action: "update"`, `id`, and `name`.

> **Prompt:** "Delete brand style [ID]"

**What to look for:** `rule_manage_brand_style` with `action: "delete"` and `id`.

Error path — missing required arg:

> **Prompt:** "Create a brand style manually (no name, no colours, no fonts)"

**What to look for:** Friendly error — `name is required for create_manual action.`

---

## Step 29: SMS Analytics Warnings (PR #57/#58)
Rule.io doesn't track opens on SMS campaigns. The server warns when you request open metrics on an SMS object.

> **Prompt:** "Get analytics for campaign [ANY_CAMPAIGN_ID] over the last 30 days. Request opens and clicks, and specify message_type text_message."

**What to look for:** `rule_get_analytics` called with `message_type: "text_message"` and `metrics: ["open", "click"]` (or `open_uniq`). Response should include a `warnings` array with one entry per SMS-unsupported metric (`open`, `open_uniq`), each noting that the returned value is an artefact and should not be reported. The campaign ID itself does not need to be an actual SMS campaign for the warning to surface — the warning is driven by the requested `message_type` + metric combination.

Negative check:

> **Prompt:** "Get click-only analytics for campaign [ID] over the last 30 days, message_type text_message"

**What to look for:** No `warnings` array — only SMS-unsupported metrics (`open`, `open_uniq`) trigger warnings. `click` alone is fine.

---

## Verification
After each step, report back:
1. Did Claude pick the right tool(s)?
2. Did the tool succeed or error?
3. Was the response useful for a marketer (not too technical)?
4. Any unexpected behavior?
