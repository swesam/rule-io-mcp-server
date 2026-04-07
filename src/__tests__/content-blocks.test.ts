import { describe, it, expect } from 'vitest';
import { sectionsSchema, buildSectionsFromBlocks, type ContentBlock } from '../util/content-blocks.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper to access RCML attributes without deep type casts
function attrs(element: unknown): Record<string, any> {
  return (element as { attributes: Record<string, unknown> }).attributes;
}

describe('sectionsSchema', () => {
  it('accepts valid heading block', () => {
    const result = sectionsSchema.safeParse([{ type: 'heading', text: 'Hello' }]);
    expect(result.success).toBe(true);
  });

  it('accepts valid text block', () => {
    const result = sectionsSchema.safeParse([{ type: 'text', text: 'Body copy' }]);
    expect(result.success).toBe(true);
  });

  it('accepts valid button block', () => {
    const result = sectionsSchema.safeParse([
      { type: 'button', text: 'Click me', url: 'https://example.com' },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts valid image block', () => {
    const result = sectionsSchema.safeParse([
      { type: 'image', src: 'https://example.com/img.png', alt: 'Photo' },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts divider and spacer blocks', () => {
    const result = sectionsSchema.safeParse([
      { type: 'divider' },
      { type: 'spacer', height: '40px' },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts multiple blocks of different types', () => {
    const result = sectionsSchema.safeParse([
      { type: 'heading', text: 'Welcome', level: 'h1' },
      { type: 'text', text: 'Some body text' },
      { type: 'button', text: 'CTA', url: 'https://example.com' },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects unknown block type', () => {
    const result = sectionsSchema.safeParse([{ type: 'unknown', text: 'hi' }]);
    expect(result.success).toBe(false);
  });

  it('rejects button without url', () => {
    const result = sectionsSchema.safeParse([{ type: 'button', text: 'Click' }]);
    expect(result.success).toBe(false);
  });

  it('rejects image without src', () => {
    const result = sectionsSchema.safeParse([{ type: 'image' }]);
    expect(result.success).toBe(false);
  });

  it('rejects empty array', () => {
    const result = sectionsSchema.safeParse([]);
    expect(result.success).toBe(false);
  });
});

describe('buildSectionsFromBlocks', () => {
  it('wraps a heading in rc-section > rc-column', () => {
    const blocks: ContentBlock[] = [{ type: 'heading', text: 'Hello' }];
    const sections = buildSectionsFromBlocks(blocks);

    expect(sections).toHaveLength(1);
    expect(sections[0].tagName).toBe('rc-section');
    expect(sections[0].children).toHaveLength(1);
    expect(sections[0].children[0].tagName).toBe('rc-column');
    expect(sections[0].children[0].children).toHaveLength(1);
    expect(sections[0].children[0].children[0].tagName).toBe('rc-heading');
  });

  it('wraps a text block in rc-section > rc-column > rc-text', () => {
    const blocks: ContentBlock[] = [{ type: 'text', text: 'Paragraph' }];
    const sections = buildSectionsFromBlocks(blocks);

    const element = sections[0].children[0].children[0];
    expect(element.tagName).toBe('rc-text');
  });

  it('creates rc-button with href', () => {
    const blocks: ContentBlock[] = [
      { type: 'button', text: 'Click', url: 'https://example.com' },
    ];
    const sections = buildSectionsFromBlocks(blocks);

    const element = sections[0].children[0].children[0];
    expect(element.tagName).toBe('rc-button');
    expect(attrs(element).href).toBe('https://example.com');
  });

  it('creates rc-image with src and alt', () => {
    const blocks: ContentBlock[] = [
      { type: 'image', src: 'https://example.com/img.png', alt: 'Photo' },
    ];
    const sections = buildSectionsFromBlocks(blocks);

    const element = sections[0].children[0].children[0];
    expect(element.tagName).toBe('rc-image');
    expect(attrs(element).src).toBe('https://example.com/img.png');
    expect(attrs(element).alt).toBe('Photo');
  });

  it('creates rc-divider', () => {
    const blocks: ContentBlock[] = [{ type: 'divider' }];
    const sections = buildSectionsFromBlocks(blocks);

    expect(sections[0].children[0].children[0].tagName).toBe('rc-divider');
  });

  it('creates rc-spacer with custom height', () => {
    const blocks: ContentBlock[] = [{ type: 'spacer', height: '40px' }];
    const sections = buildSectionsFromBlocks(blocks);

    const element = sections[0].children[0].children[0];
    expect(element.tagName).toBe('rc-spacer');
    expect(attrs(element).height).toBe('40px');
  });

  it('places multiple blocks as children of a single column', () => {
    const blocks: ContentBlock[] = [
      { type: 'heading', text: 'Title', level: 'h1' },
      { type: 'text', text: 'Body' },
      { type: 'button', text: 'CTA', url: 'https://example.com' },
    ];
    const sections = buildSectionsFromBlocks(blocks);

    expect(sections).toHaveLength(1);
    const column = sections[0].children[0];
    expect(column.children).toHaveLength(3);
    expect(column.children[0].tagName).toBe('rc-heading');
    expect(column.children[1].tagName).toBe('rc-text');
    expect(column.children[2].tagName).toBe('rc-button');
  });

  it('maps heading levels to font sizes', () => {
    const levels = ['h1', 'h2', 'h3'] as const;
    const expectedSizes = ['28px', '22px', '18px'];

    levels.forEach((level, i) => {
      const sections = buildSectionsFromBlocks([{ type: 'heading', text: 'Test', level }]);
      const heading = sections[0].children[0].children[0];
      expect(attrs(heading)['font-size']).toBe(expectedSizes[i]);
    });
  });

  it('uses default font size when heading level is omitted', () => {
    const sections = buildSectionsFromBlocks([{ type: 'heading', text: 'Test' }]);
    const heading = sections[0].children[0].children[0];
    // Our explicit default: h1 = 28px
    expect(attrs(heading)['font-size']).toBe('28px');
  });
});
