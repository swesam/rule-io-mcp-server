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
> **Prompt:** "How did my emails perform over the last 30 days? Show me opens, clicks, and bounces."

**What to look for:** `rule_get_analytics` with date range and metrics.

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

---

## Bugs Found

### BUG-1: `rule_list_tags` returns empty array (FIXED — PR #25)
- **Tool:** `rule_list_tags`
- **Issue:** Reads `response.data` but SDK returns `response.tags`
- **Test gap:** Mock used same wrong property, masking the bug
- **Fix:** `fix/list-tags-response-property` branch, PR #25

### BUG-2: `rule_create_campaign_email` allows zero recipients
- **Tool:** `rule_create_campaign_email`
- **Issue:** `tags`, `segments`, and `subscribers` are all optional with no validation that at least one is provided. Campaign is created but can never send.
- **LLM side-effect:** Claude hallucinated "targeting all subscribers" when actually zero were selected.
- **Suggested fix:** Either require at least one recipient param, or return a warning in the response when none are set.

### BUG-3: `rule_get_analytics` description misleads LLM — summary mode never used
- **Tool:** `rule_get_analytics`
- **Issue:** LLM repeatedly refuses to call the summary mode (date range only, no object IDs), insisting "the API requires specific object IDs." Tested twice — both times it skipped summary and went to per-object queries, failing to find sent campaigns. The code supports summary mode (line 82 of analytics.ts) but the description doesn't make it clear enough.
- **Suggested fix:** Rewrite description to lead with summary mode as the default: "Call with just date_from and date_to for an account-wide summary. For per-object breakdown, also provide object_type + object_ids + metrics (all three required together). Use rule_list_campaigns or rule_list_automations to find IDs."

### BUG-4: Abandoned cart prompt example JSON uses wrong template format
- **Prompt:** `create_abandoned_cart_email`
- **Issue:** The example JSON (lines 157-169 of prompts/index.ts) uses a raw `"template"` object with an invented RCML structure (`type: "section"`, `type: "heading"`, etc.) that doesn't match the actual `sections` content-block API. This confuses the LLM into generating its own format instead of using `sections` with proper content blocks.
- **Side-effect 1:** Merge tags rendered as `[First Name]` instead of `{{Subscriber.FirstName}}` — the LLM ignored the prompt's correct syntax.
- **Side-effect 2:** Logo broken — the LLM may have tried to include a logo manually instead of relying on the brand style header.
- **Suggested fix:** Replace the example JSON with a correct `sections`-based example using content blocks (heading, text, button). Also reinforce merge tag syntax in the example.

### NOTE-1: Broken logo in Claude Desktop template preview (not a bug)
- **Tool:** `rule_render_template`
- **Issue:** Logo shows broken image in Claude Desktop's rendered preview, but displays correctly inside Rule.io's UI.
- **Cause:** Claude Desktop's HTML/markdown renderer doesn't load external images. The template HTML and logo URL (https://img.rule.io/...) are correct.
- **Action:** None — this is a Claude Desktop rendering limitation, not an MCP server issue.

---

## Verification
After each step, report back:
1. Did Claude pick the right tool(s)?
2. Did the tool succeed or error?
3. Was the response useful for a marketer (not too technical)?
4. Any unexpected behavior?
