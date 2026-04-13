# Testing Guide

Manual and automated testing instructions for the rule-io-mcp-server.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Starting MCP Inspector](#starting-mcp-inspector)
- [Testing Tools](#testing-tools)
  - [Tags](#tags)
  - [Subscribers](#subscribers)
  - [Automations](#automations)
  - [Campaigns](#campaigns)
  - [Templates](#templates)
  - [Analytics](#analytics)
  - [Admin](#admin)
- [Testing Resources](#testing-resources)
- [Testing Prompts](#testing-prompts)
- [Automated Tests](#automated-tests)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** >= 20
- **npm** >= 9
- A **Rule.io API key** (set as `RULE_IO_API_KEY`)
- The **rule-io-sdk** sibling dependency must be available locally (this project uses `file:../rule-io-sdk`):

```bash
# Clone and build the SDK if you haven't already
git clone https://github.com/swesam/rule-io-sdk.git ../rule-io-sdk
cd ../rule-io-sdk && npm install && npm run build && cd -
```

- The project must be built before running the inspector:

```bash
npm install
npm run build
```

---

## Starting MCP Inspector

Launch the MCP Inspector with the server's start command:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

When the Inspector UI opens in your browser, add the environment variable:

1. In the **Environment Variables** section, add `RULE_IO_API_KEY` with your API key.
2. Click **Connect**.

You should see the server connect with name `rule-io` and version `0.1.0`. The Tools, Resources, and Prompts tabs should each be populated.

> **Tip**: If the Inspector does not open automatically, check the terminal output for the URL (usually `http://localhost:6274`).

---

## Testing Tools

For each tool below, use the **Tools** tab in MCP Inspector. Select the tool name, fill in the JSON input, and click **Run Tool**.

### Tags

#### rule_list_tags

No input required.

```json
{}
```

**Verify**: Response contains an array of tag objects, each with `id` (number) and `name` (string).

#### rule_find_tag

```json
{
  "name": "newsletter"
}
```

**Verify**: Returns `{ "id": <number>, "name": "newsletter" }` if the tag exists, or a "not found" message otherwise.

**Edge case** -- empty name (not a validation error; the tool will execute and return a "not found" message):

```json
{
  "name": ""
}
```

---

### Subscribers

#### rule_create_subscriber

```json
{
  "email": "test@example.com",
  "language": "en",
  "status": "ACTIVE"
}
```

**Verify**: Response confirms creation with subscriber details.

**Error case** -- invalid email:

```json
{
  "email": "not-an-email"
}
```

**Verify**: Zod validation error is returned.

#### rule_get_subscriber

```json
{
  "email": "test@example.com"
}
```

**Verify**: Response contains `subscriber`, `fields`, and `tags`. If the subscriber does not exist, response says "not found".

#### rule_delete_subscriber

> **Warning**: This permanently deletes a subscriber. Only use test subscribers.

```json
{
  "subscriber": "test@example.com",
  "identified_by": "email"
}
```

**Verify**: Response confirms deletion.

**Error case** -- missing subscriber field:

```json
{}
```

#### rule_manage_subscriber_tags

Add tags to a subscriber:

```json
{
  "subscriber": "test@example.com",
  "identified_by": "email",
  "action": "add",
  "tags": ["test-tag"]
}
```

Remove tags from a subscriber:

```json
{
  "subscriber": "test@example.com",
  "identified_by": "email",
  "action": "remove",
  "tags": ["test-tag"]
}
```

With automation trigger:

```json
{
  "subscriber": "test@example.com",
  "identified_by": "email",
  "action": "add",
  "tags": ["test-tag"],
  "trigger_automation": "force"
}
```

**Verify**: Response confirms tags were added or removed.

#### rule_bulk_manage_tags

```json
{
  "action": "add",
  "tags": ["bulk-test-tag"],
  "subscribers": [
    { "email": "test1@example.com" },
    { "email": "test2@example.com" }
  ]
}
```

**Verify**: Response confirms the async operation was accepted.

**Error case** -- subscriber missing both email and phone_number:

```json
{
  "action": "add",
  "tags": ["test"],
  "subscribers": [{}]
}
```

**Verify**: Validation error is returned (each subscriber must have email or phone_number).

---

### Automations

#### rule_create_automation_email

> **Note**: This creates a real automation with four linked resources. Use carefully in test environments.

```json
{
  "name": "Inspector Test Automation",
  "trigger_tag": "newsletter",
  "subject": "Test email from inspector",
  "template": {
    "type": "rcml",
    "content": [
      {
        "type": "section",
        "content": [
          { "type": "heading", "content": "Test Heading" },
          { "type": "text", "content": "This is a test email created via MCP Inspector." }
        ]
      }
    ]
  },
  "sendout_type": "transactional"
}
```

**Verify**: Response contains `automail_id`, `message_id`, `template_id`, and `dynamic_set_id`.

**Error case** -- non-existent trigger tag:

```json
{
  "name": "Test",
  "trigger_tag": "nonexistent_tag_12345",
  "subject": "Test",
  "template": { "type": "rcml", "content": [] }
}
```

**Verify**: Error message says the tag was not found.

#### rule_list_automails

```json
{}
```

With filters:

```json
{
  "active": true,
  "query": "Inspector",
  "page": 1,
  "per_page": 10
}
```

**Verify**: Returns a paginated list of automations.

#### rule_get_automail

```json
{
  "id": 12345
}
```

Replace `12345` with a real automail ID from `rule_list_automails`.

**Verify**: Returns detailed automation info including trigger, message, and status.

**Error case** -- non-existent ID:

```json
{
  "id": 999999999
}
```

#### rule_update_automail

```json
{
  "id": 12345,
  "active": false
}
```

**Verify**: Response confirms the update. Use `rule_get_automail` to verify the status changed.

**Error case** -- trigger_type without trigger_id:

```json
{
  "id": 12345,
  "trigger_type": "tag"
}
```

**Verify**: Error says trigger_type and trigger_id must be provided together.

---

### Campaigns

#### rule_create_campaign

```json
{
  "name": "Inspector Test Campaign",
  "sendout_type": "marketing"
}
```

**Verify**: Returns the created campaign object with an ID.

#### rule_list_campaigns

```json
{
  "page": 1,
  "per_page": 10
}
```

**Verify**: Returns a paginated list of campaigns.

#### rule_get_campaign

```json
{
  "id": 12345
}
```

Replace with a real campaign ID.

**Verify**: Returns campaign details.

#### rule_update_campaign

```json
{
  "id": 12345,
  "name": "Updated Test Campaign"
}
```

**Verify**: Response confirms the update.

#### rule_schedule_campaign

Send immediately:

```json
{
  "id": 12345,
  "action": "send_now"
}
```

> **Warning**: `send_now` will actually send the campaign. Only use with test campaigns that have no recipients or are in a test environment.

Schedule for a future date:

```json
{
  "id": 12345,
  "action": "schedule",
  "datetime": "2030-12-31 10:00:00"
}
```

Cancel a scheduled send:

```json
{
  "id": 12345,
  "action": "cancel"
}
```

**Error case** -- schedule without datetime:

```json
{
  "id": 12345,
  "action": "schedule"
}
```

**Verify**: Error says datetime is required when action is "schedule".

---

### Templates

#### rule_create_template

```json
{
  "name": "Inspector Test Template",
  "message_id": 12345,
  "content": {
    "type": "rcml",
    "content": [
      {
        "type": "section",
        "content": [
          { "type": "text", "content": "Hello from the inspector!" }
        ]
      }
    ]
  }
}
```

Replace `message_id` with a real message ID (get one from `rule_create_campaign` or `rule_create_automation_email`).

**Verify**: Returns the created template with an ID. If the name is already taken, a timestamp suffix is appended automatically.

#### rule_list_templates

```json
{
  "page": 1,
  "per_page": 10
}
```

**Verify**: Returns a paginated list of templates with IDs, names, and message IDs.

#### rule_render_template

```json
{
  "id": 12345
}
```

With subscriber merge tags:

```json
{
  "id": 12345,
  "subscriber_id": 67890
}
```

**Verify**: Returns rendered HTML content.

**Error case** -- non-existent template:

```json
{
  "id": 999999999
}
```

**Verify**: Returns "not found" message.

---

### Analytics

#### rule_get_analytics

All three object params are required (`object_type`, `object_ids`, `metrics`). For account-wide summaries without object IDs, use `rule_export_data` with type `statistics` instead.

```json
{
  "date_from": "2025-01-01",
  "date_to": "2025-01-31",
  "object_type": "campaign",
  "object_ids": ["12345"],
  "metrics": ["opens", "clicks", "bounces"]
}
```

**Verify**: Returns analytics data for the specified objects and metrics.

#### rule_export_data

Export dispatchers (max 1-day range):

```json
{
  "type": "dispatchers",
  "date_from": "2025-01-15",
  "date_to": "2025-01-15"
}
```

Export statistics:

```json
{
  "type": "statistics",
  "date_from": "2025-01-01",
  "date_to": "2025-01-31"
}
```

Export subscribers:

```json
{
  "type": "subscribers",
  "date_from": "2025-01-01",
  "date_to": "2025-01-31"
}
```

**Verify**: Returns exported data. Statistics exports may include a `next_page_token` for pagination.

---

### Admin

#### rule_list_brand_styles

```json
{}
```

**Verify**: Returns an array of brand styles with IDs, names, and visual properties.

#### rule_manage_brand_style

Create from domain:

```json
{
  "action": "create_from_domain",
  "domain": "https://example.com"
}
```

Create manually:

```json
{
  "action": "create_manual",
  "name": "Inspector Test Style"
}
```

Update:

```json
{
  "action": "update",
  "id": 12345,
  "name": "Updated Style Name"
}
```

Delete:

```json
{
  "action": "delete",
  "id": 12345
}
```

**Error case** -- update without ID:

```json
{
  "action": "update",
  "name": "No ID"
}
```

**Verify**: Error says ID is required for update action.

**Error case** -- create_from_domain without domain:

```json
{
  "action": "create_from_domain"
}
```

**Verify**: Error says domain is required.

#### rule_suppress_subscribers

```json
{
  "subscribers": [
    { "email": "test@example.com" }
  ]
}
```

**Verify**: Response confirms the async suppression operation was accepted.

**Error case** -- subscriber missing both identifiers:

```json
{
  "subscribers": [{}]
}
```

**Verify**: Validation error is returned.

#### rule_unsuppress_subscribers

```json
{
  "subscribers": [
    { "email": "test@example.com" }
  ]
}
```

**Verify**: Response confirms the suppression was removed.

---

## Testing Resources

Switch to the **Resources** tab in MCP Inspector. Resources provide read-only context data.

### Static Resources

| Resource | URI | What to Verify |
|---|---|---|
| Tags | `rule://tags` | Returns a response object (typically with a `data` array) containing all tags with IDs and names |
| Brand Styles | `rule://brand-styles` | Returns a response object (typically with a `data` array) containing all brand styles |

### Parameterized Resources

These require an ID. In MCP Inspector, enter the URI with a real ID:

| Resource | URI Pattern | Example | What to Verify |
|---|---|---|---|
| Automail | `rule://automails/{id}` | `rule://automails/12345` | Returns automation details |
| Campaign | `rule://campaigns/{id}` | `rule://campaigns/12345` | Returns campaign details |
| Brand Style | `rule://brand-styles/{id}` | `rule://brand-styles/12345` | Returns brand style details |

**Error cases to test**:

- Non-existent ID (e.g., `rule://automails/999999999`) -- should return `{ "error": "Not found" }`.
- Invalid ID (e.g., `rule://automails/abc`) -- should return an error about invalid ID.

---

## Testing Prompts

Switch to the **Prompts** tab in MCP Inspector. Select a prompt, fill in optional arguments, and click **Get Prompt** to see the generated message.

### E-commerce Prompts

| Prompt | Arguments | What to Verify |
|---|---|---|
| `create_order_confirmation_email` | `brand_style_id`: (optional), `order_ref_field`: (optional) | Returns guide with RCML template example and tool call |
| `create_shipping_update_email` | `brand_style_id`: (optional), `tracking_url_field`: (optional) | Returns shipping email guide with tracking URL field |
| `create_abandoned_cart_email` | `brand_style_id`: (optional), `discount_code`: (optional, e.g. `"SAVE10"`) | Returns cart recovery guide; includes discount code if provided |
| `create_order_cancellation_email` | `brand_style_id`: (optional) | Returns cancellation email guide |

### Hospitality Prompts

| Prompt | Arguments | What to Verify |
|---|---|---|
| `create_reservation_confirmation_email` | `brand_style_id`: (optional), `checkin_field`: (optional), `checkout_field`: (optional) | Returns booking confirmation guide with date merge tags |
| `create_reservation_reminder_email` | `brand_style_id`: (optional) | Returns pre-arrival reminder guide |
| `create_feedback_request_email` | `brand_style_id`: (optional), `feedback_url`: (optional, e.g. `"https://example.com/feedback"`) | Returns feedback request guide; uses provided URL in CTA |

### Integration Prompts

| Prompt | Arguments | What to Verify |
|---|---|---|
| `setup_shopify_integration` | (none) | Returns Shopify setup guide with field mappings table |
| `setup_bookzen_integration` | (none) | Returns Bookzen setup guide with field mappings table |

**What to check for all prompts**:

- The response is a single user-role message with text content.
- Example `rule_create_automation_email` calls include valid JSON.
- Merge tag fields reflect any custom arguments you provided (e.g., a custom `order_ref_field` appears in the template example).

---

## Automated Tests

The project includes a Vitest test suite that mocks the Rule.io API and tests all tools.

Run all tests:

```bash
npm run test
```

Run tests in watch mode during development:

```bash
npm run test:watch
```

Run a specific test file:

```bash
npx vitest run src/__tests__/tools/tags.test.ts
```

Type-check without running:

```bash
npm run type-check
```

---

## Troubleshooting

### "RULE_IO_API_KEY is required"

The server requires the `RULE_IO_API_KEY` environment variable. In MCP Inspector, add it in the Environment Variables section before connecting. If running the server directly:

```bash
RULE_IO_API_KEY=your_key_here npm run start
```

### "Cannot find module dist/index.js"

The project needs to be built before running. Run:

```bash
npm run build
```

### Inspector fails to connect

1. Make sure the server is not already running on another terminal.
2. Verify the command in the Inspector is `node` with argument `dist/index.js` (not `npm run start`).
3. Check the Inspector terminal output for error messages.

### API errors (401 Unauthorized)

Your Rule.io API key is invalid or expired. Generate a new key in the Rule.io dashboard under Settings > API.

### Tool returns an error with `isError: true`

This is expected behavior for handled errors (invalid inputs, missing resources, API failures). The error message should describe what went wrong. Check:

- Required fields are provided.
- IDs reference existing resources.
- Date formats are `YYYY-MM-DD`.
- Email addresses are valid.

### Tests fail after code changes

1. Run `npm run type-check` to catch type errors.
2. Run `npm run test` to see which tests fail.
3. Check that mocks in test files match any new or changed API signatures.
