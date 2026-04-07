import { z } from 'zod';
import {
  createSection,
  createColumn,
  createImage,
  createDivider,
  createSpacer,
  createProseMirrorDoc,
  createBrandHeading,
  createBrandText,
  createBrandButton,
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
});

const textBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().describe('Paragraph text'),
  align: z
    .enum(['left', 'center', 'right', 'justify'])
    .optional()
    .transform((align) => (align === 'justify' ? 'left' : align))
    .describe('Text alignment. "justify" is normalized to "left" for brand template compatibility.'),
});

const buttonBlockSchema = z.object({
  type: z.literal('button'),
  text: z.string().describe('Button label'),
  url: z.string().describe('Button link URL'),
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
    'Optional email body content blocks rendered top-to-bottom. If omitted with brand_style_id, the brand style generates a default layout. Supported types: heading (optional level h1/h2/h3), text (supports align), button (requires url, centered by brand style), image (requires src), divider, spacer. Note: heading and button alignment is controlled by the brand style and cannot be overridden.'
  );

// ---------------------------------------------------------------------------
// RCML builder — converts content blocks to valid RCML sections
// ---------------------------------------------------------------------------

const HEADING_LEVEL: Record<'h1' | 'h2' | 'h3', 1 | 2 | 3> = {
  h1: 1,
  h2: 2,
  h3: 3,
};

function blockToElement(block: ContentBlock): RCMLColumnChild {
  switch (block.type) {
    case 'heading':
      return createBrandHeading(
        createProseMirrorDoc(block.text),
        HEADING_LEVEL[block.level ?? 'h1']
      ) as RCMLColumnChild;
    case 'text':
      return createBrandText(createProseMirrorDoc(block.text), {
        align: block.align,
      }) as RCMLColumnChild;
    case 'button':
      return createBrandButton(
        createProseMirrorDoc(block.text),
        block.url
      ) as RCMLColumnChild;
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
