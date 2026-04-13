import type { RCMLDocument, RCMLBodyChild } from 'rule-io-sdk';
import { buildSectionsFromBlocks, type ContentBlock } from './content-blocks.js';

// ---------------------------------------------------------------------------
// Shared template / brand-style config builder
// ---------------------------------------------------------------------------

/**
 * The subset of email config fields related to template content.
 *
 * Both `CreateCampaignEmailConfig` and `CreateAutomationEmailConfig` share
 * these three optional properties; this interface lets us write a single
 * helper that applies the template-vs-brand-style logic to either config.
 */
interface TemplateConfigTarget {
  template?: RCMLDocument;
  brandStyleId?: number;
  sections?: RCMLBodyChild[];
}

/**
 * Validated input from the Zod tool schemas — the template/brand-style
 * fields as they arrive after parsing and refinement.
 */
interface TemplateInput {
  template?: Record<string, unknown>;
  brand_style_id?: number;
  sections?: ContentBlock[];
}

/**
 * Apply the template-or-brand-style logic to a config object.
 *
 * When `template` is provided it is assigned directly (cast to RCMLDocument;
 * structural validation is deferred to the Rule.io API). Otherwise
 * `brandStyleId` is set and, if `sections` are provided, they are converted
 * to RCML via {@link buildSectionsFromBlocks}.
 *
 * This helper is used by both the campaign and automation email creation
 * handlers to avoid duplicating the same branching logic.
 */
export function applyTemplateConfig(
  config: TemplateConfigTarget,
  input: TemplateInput,
): void {
  if (input.template) {
    // Cast: Zod accepts loose JSON for RCML; structural validation deferred to Rule.io API
    config.template = input.template as unknown as RCMLDocument;
  } else {
    config.brandStyleId = input.brand_style_id;
    if (input.sections) {
      // Cast: Zod accepts loose JSON for RCML; structural validation deferred to Rule.io API
      config.sections = buildSectionsFromBlocks(input.sections) as RCMLBodyChild[];
    }
  }
}
