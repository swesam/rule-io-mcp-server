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

25 tools organized into 7 categories.

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
| `rule_manage_subscriber_tags` | Add or remove tags from a subscriber | `subscriber`, `action`, `tags`, `trigger_automation?` |
| `rule_bulk_manage_tags` | Bulk add/remove tags for multiple subscribers | `action`, `tags`, `subscribers[]` |

### Automations

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_create_automation_email` | Create complete email automation in one step | `name`, `trigger_tag`, `subject`, `template` |
| `rule_list_automails` | List email automations | `active?`, `query?`, `page?` |
| `rule_get_automail` | Get automation details by ID | `id` |
| `rule_update_automail` | Update an automation | `id`, `active?`, `sendout_type?` |

### Campaigns

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_create_campaign` | Create a one-off email campaign | `name?`, `sendout_type?` |
| `rule_list_campaigns` | List campaigns | `page?`, `per_page?` |
| `rule_get_campaign` | Get campaign details by ID | `id` |
| `rule_update_campaign` | Update a campaign | `id`, `name?`, `sendout_type?` |
| `rule_schedule_campaign` | Schedule, send, or cancel a campaign | `id`, `action`, `datetime?` |

### Templates

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_create_template` | Create RCML email template | `name`, `message_id`, `content` |
| `rule_list_templates` | List templates | `page?`, `per_page?` |
| `rule_render_template` | Render template to HTML (with optional merge tag substitution) | `id`, `subscriber_id?` |

### Analytics

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_get_analytics` | Get performance metrics for campaigns/automations | `date_from`, `date_to`, `object_type?`, `metrics?` |
| `rule_export_data` | Export dispatchers, statistics, or subscribers | `type`, `date_from`, `date_to` |

### Admin

| Tool | Description | Key Inputs |
|------|-------------|------------|
| `rule_list_brand_styles` | List brand styles | _(none)_ |
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
| `rule://automails/{id}` | Automail by ID |
| `rule://campaigns/{id}` | Campaign by ID |
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
| `RULE_IO_FIELD_GROUP_PREFIX` | No | Custom field group prefix (default: `"Booking"`) |
| `RULE_IO_BASE_URL_V2` | No | Custom base URL for v2 API |
| `RULE_IO_BASE_URL_V3` | No | Custom base URL for v3 API |

---

## Examples

### Create a subscriber and tag them

> "Add jane@example.com as a subscriber with the tag 'VIP'"

The AI calls two tools in sequence:

```json
// 1. Create the subscriber
{ "email": "jane@example.com", "language": "en" }
// → { "id": 42, "email": "jane@example.com", ... }

// 2. Tag them
{ "subscriber": "jane@example.com", "action": "add", "tags": ["VIP"] }
// → { "message": "Tags added successfully" }
```

### Set up an abandoned cart automation

> "Set up an abandoned cart recovery email for our Shopify store"

The AI uses the **`create_abandoned_cart_email`** prompt for step-by-step guidance, then calls **`rule_create_automation_email`** with the trigger tag, subject, and RCML template:

```json
{
  "name": "Abandoned Cart Recovery",
  "trigger_tag": "shopify_checkout_abandoned",
  "subject": "You left something behind!",
  "template": { "type": "rcml", "content": [{ "type": "section", "content": [...] }] },
  "sendout_type": "marketing"
}
// → { "automail_id": 101, "message_id": 202, "template_id": 303, "dynamic_set_id": 404 }
```

### Check campaign performance

> "How did last week's newsletter perform?"

The AI calls **`rule_get_analytics`** with the campaign ID and date range:

```json
{
  "date_from": "2025-06-01",
  "date_to": "2025-06-07",
  "object_type": "campaign",
  "object_ids": ["12345"],
  "metrics": ["opens", "clicks", "bounces", "unsubscribes"]
}
// → { "opens": 1240, "clicks": 312, "bounces": 8, "unsubscribes": 3 }
```

### Create a brand style from a website

> "Create a brand style based on https://example.com"

The AI calls **`rule_manage_brand_style`** with **`action: create_from_domain`** to create a new brand style with colors, fonts, and logo extracted from the site:

```json
{ "action": "create_from_domain", "domain": "https://example.com" }
// → { "id": 7, "name": "example.com", "colors": {...}, "fonts": {...} }
```

---

## Development

```bash
npm install
npm run build          # Build with tsup
npm run dev            # Build in watch mode
npm run test           # Run tests (vitest)
npm run test:watch     # Tests in watch mode
npm run type-check     # TypeScript type checking
npm run start          # Start the MCP server
```

---

## Links

- [Rule.io API documentation](https://rule.se/apidoc/)
- [rule-io-sdk](https://github.com/swesam/rule-io-sdk) — The underlying SDK this server wraps
- [Model Context Protocol specification](https://modelcontextprotocol.io/)

---

## License

MIT
