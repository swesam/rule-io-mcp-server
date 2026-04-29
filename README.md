# rule-io-mcp-server

An MCP server that gives AI assistants deep access to Rule.io email marketing — campaigns, automations, subscribers, templates, analytics, and more.

[![npm version](https://img.shields.io/npm/v/rule-io-mcp-server.svg)](https://www.npmjs.com/package/rule-io-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

## Quick Start

### 1. Get a Rule.io API key

Create one at [app.rule.io](https://app.rule.io) under **Settings > API keys**.

### 2. Add to Claude Desktop

Open your Claude Desktop config (`claude_desktop_config.json`) and add:

```json
{
  "mcpServers": {
    "rule-io": {
      "command": "npx",
      "args": ["-y", "rule-io-mcp-server"],
      "env": {
        "RULE_IO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 3. Add to Claude Code

Add a `.mcp.json` file to your project root (or your user `settings.json`):

```json
{
  "mcpServers": {
    "rule-io": {
      "command": "npx",
      "args": ["-y", "rule-io-mcp-server"],
      "env": {
        "RULE_IO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

That's it. The server starts automatically when Claude needs it.

---

## Tools

37 tools organized into 7 categories.

### Tags

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_list_tags` | List all tags in your Rule.io account | _(none)_ |
| `rule_find_tag` | Find a tag's numeric ID by name | `name` |

### Subscribers

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_create_subscriber` | Create a new subscriber | `email`, `phone_number?`, `language?`, `status?` |
| `rule_get_subscriber` | Get subscriber by email (profile + fields + tags) | `email` |
| `rule_delete_subscriber` | Delete a subscriber | `subscriber`, `identified_by?` |
| `rule_manage_subscriber_tags` | Add or remove tags from a subscriber | `subscriber`, `identified_by?`, `action`, `tags`, `trigger_automation?` |
| `rule_bulk_manage_tags` | Bulk add/remove tags for multiple subscribers | `action`, `tags`, `subscribers[{ email?, phone_number? }]`, `trigger_automation?` |
| `rule_set_subscriber_fields` | Set custom field data on a subscriber | `subscriber_id`, `groups[{ group, values[{ field, value, historical? }] }]` |
| `rule_list_subscribers_by_tag` | List subscribers having ALL given tag IDs (AND / intersection) | `tag_ids[]`, `limit?`, `page?` |
| `rule_block_subscribers` | Block or unblock multiple subscribers | `action`, `subscribers[{ email? \| phone_number? \| id? }]` |

### Automations

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_create_automation_email` | Create complete email automation in one step | `name`, `trigger_tag`, `subject`, `template`, `sendout_type?` |
| `rule_list_automations` | List email automations | `active?`, `query?`, `page?`, `per_page?` |
| `rule_get_automation` | Get automation details by ID, optionally merged with analytics metrics | `id`, `include_analytics?{ date_from, date_to, metrics[], message_type? }` |
| `rule_update_automation` | Update an automation | `id`, `active?`, `sendout_type?`, `trigger_type?`, `trigger_id?` |
| `rule_delete_automation` | Delete an automation | `id` |

### Campaigns

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_create_campaign` | Create a one-off email campaign | `name?`, `sendout_type?` |
| `rule_create_campaign_email` | Create a complete campaign with email in one step | `name`, `subject`, `tags` or `segments` or `subscribers`, `template` or `brand_style_id` |
| `rule_list_campaigns` | List campaigns | `page?`, `per_page?` |
| `rule_get_campaign` | Get campaign details by ID, optionally merged with analytics metrics | `id`, `include_analytics?{ date_from, date_to, metrics[], message_type? }` |
| `rule_update_campaign` | Update a campaign | `id`, `name?`, `sendout_type?` |
| `rule_delete_campaign` | Delete a campaign | `id` |
| `rule_copy_campaign` | Duplicate an existing campaign | `id` |
| `rule_list_segments` | List available segments for campaign targeting | `page?`, `per_page?` |
| `rule_schedule_campaign` | Schedule, send, or cancel a campaign | `id`, `action`, `datetime?` |

### Templates

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_create_template` | Create RCML email template | `name`, `message_id`, `content` |
| `rule_list_templates` | List templates | `page?`, `per_page?` |
| `rule_render_template` | Render template to HTML (with optional merge tag substitution) | `id`, `subscriber_id?` |
| `rule_get_template` | Get template details by ID | `id` |
| `rule_delete_template` | Delete a template | `id` |
| `rule_find_template_usage` | Find the single campaign or automation that owns a template (returns `{ owner: null }` if unused). Scans dispatchers until first match — no direct owner endpoint in Rule.io yet. | `id` |

### Analytics

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_get_analytics` | Get per-object performance metrics for any dispatcher type — campaigns, automations, A/B tests, transactional sends, journeys (see `object_type`) | `date_from`, `date_to`, `object_type`, `object_ids[]`, `metrics[]`, `message_type?` |
| `rule_export_data` | Export dispatchers, statistics, or subscribers | `type`, `date_from`, `date_to`, `next_page_token?` |

### Admin

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_list_brand_styles` | List brand styles | _(none)_ |
| `rule_get_brand_style` | Get full details of a brand style | `id` |
| `rule_manage_brand_style` | Create/update/delete brand styles | `action`, `id?`, `domain?`, `name?` |
| `rule_suppress_subscribers` | Suppress subscribers from emails | `subscribers[]` |
| `rule_unsuppress_subscribers` | Remove suppression | `subscribers[]` |

---

## Resources

Resources provide read-only context that AI assistants can pull in automatically.

| URI | Description |
|-----|-------------|
| `rule://tags` | All tags |
| `rule://brand-styles` | All brand styles |
| `rule://segments` | All segments |
| `rule://automations/{id}` | Automation by ID |
| `rule://campaigns/{id}` | Campaign by ID |
| `rule://templates/{id}` | Template by ID |
| `rule://brand-styles/{id}` | Brand style by ID |

---

## Prompts

Pre-built workflow guides that walk the AI through multi-step email setups.

### E-commerce

| Prompt | Description |
|--------|-------------|
| `create_order_confirmation_email` | Order confirmation automation guide |
| `create_shipping_update_email` | Shipping notification guide |
| `create_abandoned_cart_email` | Abandoned cart recovery guide |
| `create_order_cancellation_email` | Order cancellation guide |

### Hospitality

| Prompt | Description |
|--------|-------------|
| `create_reservation_confirmation_email` | Reservation confirmation guide |
| `create_reservation_reminder_email` | Pre-arrival reminder guide |
| `create_feedback_request_email` | Post-stay feedback guide |

### Integrations

| Prompt | Description |
|--------|-------------|
| `setup_shopify_integration` | Shopify setup guide |
| `setup_bookzen_integration` | Bookzen setup guide |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RULE_IO_API_KEY` | Yes | Your Rule.io API key |
| `RULE_IO_DEBUG` | No | Set to `"true"` for debug logging |
| `RULE_IO_FIELD_GROUP_PREFIX` | No | Custom field group prefix (default: `"Order"`) |
| `RULE_IO_BASE_URL_V2` | No | Custom base URL for v2 API |
| `RULE_IO_BASE_URL_V3` | No | Custom base URL for v3 API |

---

## Examples

### Create a subscriber and tag them

> "Add jane@example.com as a subscriber with the tag 'VIP'"

The AI calls two tools in sequence:

```jsonc
// 1. rule_create_subscriber
{ "email": "jane@example.com", "language": "en" }
// → { "id": 42, "email": "jane@example.com", ... }

// 2. rule_manage_subscriber_tags
{ "subscriber": "jane@example.com", "action": "add", "tags": ["VIP"] }
// → { "message": "Tags added successfully" }
```

### Set up an abandoned cart automation

> "Set up an abandoned cart recovery email for our Shopify store"

The AI uses the **`create_abandoned_cart_email`** prompt for step-by-step guidance, then calls **`rule_create_automation_email`** with the trigger tag, subject, and RCML template:

```jsonc
{
  "name": "Abandoned Cart Recovery",
  "trigger_tag": "shopify_checkout_abandoned",
  "subject": "You left something behind!",
  "template": { "type": "rcml", "content": [{ "type": "section", "content": ["..."] }] },
  "sendout_type": "marketing"
}
// → { "success": true, "automail_id": 101, "message_id": 202, "template_id": 303, "dynamic_set_id": 404 }
```

### Check campaign performance

> "How did last week's newsletter perform?"

The AI calls **`rule_get_analytics`** with the campaign ID and date range:

```jsonc
{
  "date_from": "2025-06-01",
  "date_to": "2025-06-07",
  "object_type": "CAMPAIGN",
  "object_ids": ["12345"],
  "metrics": ["open_uniq", "click_uniq", "total_bounce", "unsubscribe"]
}
// → { data: [{ id: "12345", metrics: [{ metric: "open_uniq", value: 1240 }, ...] }] }
```

### Create a brand style from a website

> "Create a brand style based on https://example.com"

The AI calls **`rule_manage_brand_style`** with **`action: create_from_domain`** to create a new brand style with colors, fonts, and logo extracted from the site:

```jsonc
{ "action": "create_from_domain", "domain": "https://example.com" }
// → { "id": 7, "name": "example.com", "colors": { "primary": "#000" }, "fonts": { "heading": "Arial" } }
```

---

## Known upstream limitations

These are Rule.io API behaviours we cannot fix from the MCP layer. Workarounds below are what we recommend today.

### Filtering `rule_list_campaigns`

The Rule.io API does not accept a `status` filter on `GET /v2/campaigns`. `rule_list_campaigns` returns everything (drafts, scheduled, sent). Filter client-side on the campaign `status` field — the SDK types it as `{ value, key, description }` (so match on `status.key === "sent"` etc.), but some responses surface it as a plain string. Handle both.

The campaign `subject` also lives on the message resource, not the campaign itself — the list response includes `name` but not `subject`. This MCP server does not currently expose a message-get tool, so if campaigns in your account are often unnamed, retrieve the subject from the Rule.io UI or the Rule.io API directly until we add one.

### Segment metadata

`rule_list_segments` returns `id` and `name` only — no member count, no creation timestamp. To detect dead segments today, use `rule_export_data` with `type: "subscribers"` and join on tag / segment membership client-side.

### Dispatcher exports limited to 1 day

`rule_export_data` with `type: "dispatchers"` accepts at most a 1-day range per call. For multi-week frequency or fatigue analysis, call iteratively per day and aggregate.

### Market / brand attribution

Rule.io has no native `market` / `country` / `brand` attribute on campaigns, automations, segments, or tags. Multi-market accounts typically encode market into a name prefix (e.g. `SE-`, `DK-`, `FI-`) and parse it client-side.

### SMS analytics: no open tracking

SMS has no native "open" event — any `open_uniq` on a `text_message` campaign is an artefact of the underlying storage. When you call `rule_get_analytics` with `message_type: "text_message"` and request `open` or `open_uniq`, the response adds a `warnings` array flagging those fields as artefacts (the raw values still come through — we don't strip them). The same annotation surfaces as `analytics_warnings` on the `include_analytics` merge path, with one asymmetry to know about: `rule_get_campaign` infers `message_type` from the campaign record, so SMS campaigns trigger the warning automatically; `rule_get_automation` does **not** currently infer it, so callers need to set `include_analytics.message_type: "text_message"` explicitly to get the warning on SMS automations. Treat `click_uniq` as the engagement signal for SMS.

### Read-only deployments

Rule.io API keys do not currently carry a read-only scope. If you want to run this MCP server in a read-only posture (phase-1 AI rollouts, audit integrations), enforce it at the tool layer — filter the tool list in your own wrapper, or run a fork that omits the write tools. Contributions welcome (e.g. a `READ_ONLY=true` env flag).

### Rate limits

Rule.io has not published formal rate limits. Most tools here issue one Rule.io request each, but a few fan out internally — notably `rule_get_subscriber`, which runs three requests in parallel. Rule.io may return a `Retry-After` header on 429 responses, but this server does not currently surface the header or its value through tool responses — consumers see the fixed friendly message `Rate limited by Rule.io API. Please wait a moment and retry.` with no retry timestamp. If you call this server from a high-concurrency orchestrator, prefer conservative concurrency and backoff-on-429 over aggressive parallelism.

---

## Development

```bash
npm install
npm run build          # Build with tsup
npm run dev            # Build in watch mode
npm run test           # Run tests (vitest)
npm run test:watch     # Tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run type-check     # TypeScript type checking
npm run start          # Start the MCP server
```

### Local install in Claude Desktop

When running from a local clone (instead of via `npx`), point at the **bin entry point**, not `dist/index.js`:

```json
{
  "mcpServers": {
    "rule-io": {
      "command": "node",
      "args": ["/path/to/rule-io-mcp-server/dist/bin/rule-io-mcp.js"],
      "env": {
        "RULE_IO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

> **Why not `dist/index.js`?** That's the library entry — it only exports `main()` for programmatic use. The bin entry point (`dist/bin/rule-io-mcp.js`) is the CLI shim that actually invokes `main()`.

---

## Links

- [Rule.io API documentation](https://rule.se/apidoc/)
- [rule-io-sdk](https://github.com/rulecom/rule-io-sdk) — The underlying SDK this server wraps
- [Model Context Protocol specification](https://modelcontextprotocol.io/)

---

## License

MIT
