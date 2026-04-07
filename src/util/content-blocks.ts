import { z } from 'zod';
import {
  createSection,
  createColumn,
  createHeading,
  createText,
  createButton,
  createImage,
  createDivider,
  createSpacer,
  type RCMLSection,
  type RCMLColumnChild,
} from 'rule-io-sdk';

// ---------------------------------------------------------------------------
// Zod schemas — typed content blocks that LLMs can fill correctly
// ---------------------------------------------------------------------------

const headingBlockSchema = z.object({
  type: z.literal('heading'),
  text: z.string().describe('Heading text'),
  level: z
    .enum(['h1', 'h2', 'h3'])
    .optional()
    .describe('Heading level (default: h1)'),
  align: z.enum(['left', 'center', 'right']).optional(),
});

const textBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().describe('Paragraph text'),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

const buttonBlockSchema = z.object({
  type: z.literal('button'),
  text: z.string().describe('Button label'),
  url: z.string().describe('Button link URL'),
  align: z.enum(['left', 'center', 'right']).optional(),
});

const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string().describe('Image URL'),
  alt: z.string().optional().describe('Alt text for accessibility'),
  href: z.string().optional().describe('Link URL when image is clicked'),
});

const dividerBlockSchema = z.object({
  type: z.literal('divider'),
});

const spacerBlockSchema = z.object({
  type: z.literal('spacer'),
  height: z.string().optional().describe('Height CSS value, e.g. "20px"'),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  textBlockSchema,
  buttonBlockSchema,
  imageBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
]);

export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const sectionsSchema = z
  .array(contentBlockSchema)
  .min(1)
  .describe(
    'Optional email body content blocks rendered top-to-bottom. If omitted with brand_style_id, the brand style generates a default layout. Supported types: heading (optional level h1/h2/h3), text, button (requires url), image (requires src), divider, spacer.'
  );

// ---------------------------------------------------------------------------
// RCML builder — converts content blocks to valid RCML sections
// ---------------------------------------------------------------------------

const HEADING_FONT_SIZE: Record<string, string> = {
  h1: '28px',
  h2: '22px',
  h3: '18px',
};

function blockToElement(block: ContentBlock): RCMLColumnChild {
  switch (block.type) {
    case 'heading':
      return createHeading(block.text, {
        align: block.align,
        fontSize: HEADING_FONT_SIZE[block.level ?? 'h1'],
      });
    case 'text':
      return createText(block.text, { align: block.align });
    case 'button':
      return createButton(block.text, block.url, { align: block.align });
    case 'image':
      return createImage(block.src, { alt: block.alt, href: block.href });
    case 'divider':
      return createDivider();
    case 'spacer':
      return createSpacer(block.height);
  }
}

/**
 * Convert an array of content blocks into valid RCML sections.
 *
 * All blocks are placed into a single section with one column.
 * The SDK's element builders handle ProseMirror wrapping and defaults.
 */
export function buildSectionsFromBlocks(blocks: ContentBlock[]): RCMLSection[] {
  const children = blocks.map(blockToElement);
  return [createSection([createColumn(children)])];
}
