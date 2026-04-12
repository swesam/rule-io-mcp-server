# Code Review Plan: rule-io-mcp-server

## Context

A developer needs to code review this MCP server that wraps the Rule.io email marketing API. The codebase has **35 tools, 7 resources, 9 prompts**, and **~190 test cases** across 13 test files. Stack: TypeScript (strict), tsup, Vitest, MCP SDK, rule-io-sdk, zod.

This plan is the result of a deep, three-pronged exploration covering architecture, tests, and security. The codebase is **generally well-built** — MCP protocol compliance is solid, type safety is strong (zero `any`), error handling is consistent, and tool descriptions are excellent for LLM consumption. The issues below are the findings worth acting on.

---

## Priority Matrix (TL;DR)

> **Note:** The `file:` SDK dependency (`package.json:39`) and README tool names/counts are known — the SDK is being published separately and the README will be updated alongside that work.

| Priority | Issue | Location | Status |
|----------|-------|----------|--------|
| **P1** | ~~Version `0.1.0` duplicated in two places~~ | `server.ts` + `package.json` | Done (PR #33) |
| **P1** | ~~18/35 tools lack API error case tests~~ | Various test files | Done (PR #33) |
| **P1** | No test coverage for resources or prompts | Missing files | Deferred |
| **P2** | ~~3x `as unknown as` double casts for RCML templates~~ | `templates.ts`, `automations.ts`, `campaigns.ts` | Done (PR #33) |
| **P2** | ~~No Zod schema rejection tests at tool level~~ | `schemas.ts` + `schemas.test.ts` | Done (PR #38) |
| **P2** | ~~No coverage configuration in vitest~~ | `vitest.config.ts` | Done (PR #37) |
| **P3** | ~~Fatal error logs full error object to stderr~~ | `bin/rule-io-mcp.ts` | Done (PR #34) |
| **P3** | Campaign/automation email creation code duplication | `campaigns.ts` + `automations.ts` | Deferred |
| **P3** | ~~No `.env.example` file~~ | Project root | Done (PR #35) |

---

## Phase 1: Should-Fix — COMPLETED (PR #33)

All Phase 1 items were implemented and merged:

- [x] **1A. Version duplication** — `server.ts` now imports version from `package.json` via `createRequire`
- [x] **1B. Error case tests** — Added 18 API error tests + 1 brand_style delete happy path (133 -> 151 tests)
- [x] **1D. RCML cast documentation** — Added comments at all 5 `as unknown as` locations
- 1C (resources/prompts tests) was deferred as low-risk

---

## Phase 2: Nice-to-Have — COMPLETED (PRs #34-38)

All actionable Phase 2 items were implemented and merged. Only 2B (code duplication) was deferred as low-priority.

---

### 2A. Fatal Error Logging — `bin/rule-io-mcp.ts:5`

**What's the issue?**

When the server crashes on startup, this line runs:

```typescript
console.error('Fatal error:', error);
```

The problem is that `error` is the **entire error object**, not just the message. In JavaScript, error objects can contain much more than just a text message — they can carry HTTP response data, request headers, and other internal details.

**Why does it matter?**

If the crash happens during an API call, the `RuleApiError` object might contain the raw HTTP request headers. HTTP headers often include `Authorization: Bearer <your-api-key>`. Logging the full object would print that API key to stderr (the error output stream). Even though stderr usually just shows in a developer's terminal, it could end up in log files that other people can read.

**What's the fix?**

Only log the parts that are safe and useful for debugging:

```typescript
// Before (risky):
console.error('Fatal error:', error);

// After (safe):
if (error instanceof Error) {
  console.error('Fatal error:', error.message);  // just the human-readable message
  console.error(error.stack);                     // the call stack showing where it failed
} else {
  console.error('Fatal error:', String(error));   // fallback for non-Error throws
}
```

- [x] Change `bin/rule-io-mcp.ts:5` to log only `error.message` and `error.stack` — Done (PR #34)

---

### 2B. Campaign/Automation Email Code Duplication

**What's the issue?**

Two tool handlers do very similar things:
- `rule_create_campaign_email` in `campaigns.ts` (lines 95-230) — creates an email for a one-off campaign
- `rule_create_automation_email` in `automations.ts` (lines 8-114) — creates an email for an automated workflow

Both handlers contain nearly identical code for:
1. Checking whether the user provided a `template` (raw RCML) or a `brand_style_id` (auto-styled)
2. Building "sections" (content blocks like headings, text, buttons) from user input
3. Constructing the config object that gets sent to the API

**Why does it matter?**

When the same logic is copy-pasted in two places, a future developer might fix a bug in one place but forget the other. This is called "shotgun surgery" — one change requires editing multiple files, and missing one creates a subtle bug.

**What's the fix?**

Extract the shared logic into a helper function, something like:

```typescript
// In a shared utility file:
function resolveTemplateConfig(template, brand_style_id, sections) {
  if (template) {
    return { template: template as ... };
  }
  const config = { brandStyleId: brand_style_id };
  if (sections) {
    config.sections = buildSectionsFromBlocks(sections);
  }
  return config;
}
```

**Trade-off:** The duplication is only ~20 lines, and the two handlers have different surrounding parameters (campaigns need `recipients`, automations need `trigger_tag`). Extracting might add complexity for minimal gain. This is a judgment call — it's fine to leave it as-is with a comment noting the parallel structure.

- [ ] Consider extracting a shared helper like `resolveTemplateConfig()` — Deferred (low priority, ~20 lines duplication)
- [ ] If not extracting, add a comment in both files noting the parallel structure — Deferred

---

### 2C. No Coverage Configuration — `vitest.config.ts`

**What is test coverage?**

Test coverage measures what percentage of your code actually runs during tests. For example, if you have 100 lines of code and your tests execute 80 of them, you have 80% line coverage. There's also "branch coverage" — if you have an `if/else`, did your tests exercise both the `if` path and the `else` path?

**What's the issue?**

The project has 151 tests, but there's no way to know how much of the code those tests actually cover. The vitest config (`vitest.config.ts`) only has `globals: true` — no coverage tool is configured.

**Why does it matter?**

Without coverage measurement, you can't tell:
- Which parts of the code are untested (blind spots)
- Whether new code being added has tests
- Whether your test suite is getting better or worse over time

In Phase 1B we identified 18 tools without error tests — coverage tooling would have caught that automatically.

**What's the fix?**

1. Install a coverage tool: `npm install -D @vitest/coverage-v8`
2. Update `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',              // uses V8's built-in coverage engine
      reporter: ['text', 'html'],  // 'text' prints to terminal, 'html' generates a browsable report
      include: ['src/**/*.ts'],    // only measure your source code
      exclude: ['src/__tests__/**'], // don't measure test files themselves
      thresholds: {
        lines: 80,                 // fail if less than 80% of lines are covered
        branches: 70,              // fail if less than 70% of branches are covered
      },
    },
  },
});
```

3. Add a script to `package.json`:
```json
"test:coverage": "vitest run --coverage"
```

Then run `npm run test:coverage` to see a report showing exactly which lines and branches are covered.

- [x] Install `@vitest/coverage-v8` as a dev dependency — Done (PR #37)
- [x] Add coverage configuration to `vitest.config.ts` — Done (PR #37)
- [x] Add `"test:coverage"` script to `package.json` — Done (PR #37)

---

### 2D. No `.env.example`

**What is a `.env.example` file?**

It's a template file that shows developers what environment variables they need to set, without containing any real secrets. The actual `.env` file (with real API keys) is in `.gitignore` so it never gets committed. But `.env.example` IS committed, serving as documentation.

**What's the issue?**

This project needs up to 5 environment variables to run, but a new developer would have to dig through `src/config.ts` to discover them. The README does list them, but `.env.example` is the standard convention that most developers look for first.

**What's the fix?**

Create a file called `.env.example` in the project root:

```bash
# Required — get your API key from app.rule.io > Settings > API keys
RULE_IO_API_KEY=your-api-key-here

# Optional — set to "true" to enable debug logging
# RULE_IO_DEBUG=false

# Optional — prefix for subscriber field groups (default: "Order")
# RULE_IO_FIELD_GROUP_PREFIX=Order

# Optional — override API base URLs (for testing or staging)
# RULE_IO_BASE_URL_V2=
# RULE_IO_BASE_URL_V3=
```

A new developer can then just run `cp .env.example .env` and fill in their API key.

- [x] Create `.env.example` with all 5 variables and helpful comments — Done (PR #35)

---

### 2E. Zod Schema Rejection Not Tested at Tool Level

**What is Zod?**

Zod is a library for defining "schemas" — rules about what shape data should have. For example: "this field must be a string", "this number must be between 1 and 100", "this email must be valid". When data doesn't match the schema, Zod rejects it with a clear error message.

**What's the issue?**

Every tool in this server defines a Zod schema for its inputs. For example, `rule_create_subscriber` requires a valid email address. The MCP SDK automatically runs Zod validation before the tool handler executes — so if someone passes `email: "not-an-email"`, Zod rejects it before your code even runs.

The problem: **the tests bypass this entirely.** The test helper `registerAndCapture()` extracts the raw handler function and calls it directly with plain objects. It never runs the Zod validation step. So if someone accidentally loosened a schema (e.g., changed `z.string().email()` to just `z.string()`), no test would catch it.

**Analogy:** It's like testing that a door locks correctly, but never testing that the key actually fits the lock. The lock works, the key works, but you never tested them together.

**What's the fix?**

Add tests that call `schema.safeParse()` directly with invalid data and verify it rejects. The project already does this well for content blocks in `content-blocks.test.ts` — the same pattern can be applied to tool schemas:

```typescript
// Example: test that rule_create_subscriber rejects invalid email
describe('rule_create_subscriber schema', () => {
  it('rejects invalid email', () => {
    const result = subscriberSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts valid email', () => {
    const result = subscriberSchema.safeParse({ email: 'jane@example.com' });
    expect(result.success).toBe(true);
  });
});
```

**Note:** This is lower priority because Zod itself is well-tested, and the MCP SDK handles the validation layer. The risk is specifically that someone accidentally changes a schema — which is relatively unlikely but not impossible.

- [x] Added `.safeParse()` tests for subscriber, subscriber tags, and campaign email schemas — Done (PR #38, 30+ schema tests)

---

## Phase 3: Verification Pass (Things That Are Correct)

These are areas where the codebase is solid — verify during review to confirm.

### What's Working Well

- [x] **MCP protocol compliance**: All 35 tools have `name`, `description`, `inputSchema` (Zod), and return `{ content: [{ type: "text", text }] }`. Verified via `server.test.ts` manifest.
- [x] **Error handling**: Every handler has try/catch -> `handleRuleError()` -> `{ isError: true }`. No handler throws. Only 2 `throw` statements in the entire codebase: `config.ts:12` (startup guard) and `templates.ts:37` (re-throw in nested catch, caught by outer handler).
- [x] **Type safety**: Zero `any` in production code. Maximally strict tsconfig with all optional flags enabled.
- [x] **Security**: API key from env only, never logged. No hardcoded secrets. All inputs Zod-validated. Error messages sanitized (no stack traces or internal paths). No injection vectors. No `eval`/dynamic code.
- [x] **SDK usage**: All API interactions go through `RuleClient`. Zero direct HTTP calls (no fetch, axios, etc.).
- [x] **Tool descriptions**: Excellent LLM-facing quality — cross-references between tools, idempotency warnings, clear parameter docs with `.describe()`.
- [x] **Zod schemas**: Advanced patterns used correctly — `z.discriminatedUnion`, `.refine()`, `.transform()`, `.regex()`, `z.string().email()`.

---

## How to Verify

```bash
# Run tests — expect the full test suite to pass
npm test

# Type check — expect zero errors
npm run type-check

# Build — verify clean output
npm run build

# Count registered tools (source of truth)
grep -c "server.tool(" src/tools/*.ts
# Should sum to 35
```

---

## Key Files Reference

| File | What to review |
|------|----------------|
| `package.json` | `file:` dependency, version, scripts |
| `README.md` | Tool count, tool names, resource URIs |
| `src/server.ts` | Version import, registration |
| `src/bin/rule-io-mcp.ts` | Error logging |
| `src/util/errors.ts` | Error sanitization |
| `src/util/content-blocks.ts` | Zod schemas, RCML builder |
| `src/tools/*.ts` (7 files) | Handler pattern, type casts, descriptions |
| `src/resources/index.ts` | Resource registration |
| `src/prompts/index.ts` | Prompt content accuracy |
| `src/__tests__/tools/_helpers.ts` | Test abstraction approach |
| `vitest.config.ts` | Coverage gap |
