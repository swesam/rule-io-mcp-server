import { describe, it, expect } from 'vitest';
import { applyTemplateConfig } from '../util/template-config.js';
import type { ContentBlock } from '../util/content-blocks.js';

describe('applyTemplateConfig', () => {
  it('assigns template when provided', () => {
    const config: Record<string, unknown> = {};
    const template = { body: [{ tagName: 'rc-section' }] };

    applyTemplateConfig(config, { template });

    expect(config.template).toEqual(template);
    expect(config.brandStyleId).toBeUndefined();
    expect(config.sections).toBeUndefined();
  });

  it('assigns brandStyleId when brand_style_id is provided without template', () => {
    const config: Record<string, unknown> = {};

    applyTemplateConfig(config, { brand_style_id: 42 });

    expect(config.brandStyleId).toBe(42);
    expect(config.template).toBeUndefined();
    expect(config.sections).toBeUndefined();
  });

  it('builds and assigns sections when brand_style_id and sections are provided', () => {
    const config: Record<string, unknown> = {};
    const sections: ContentBlock[] = [
      { type: 'heading', text: 'Hello' },
      { type: 'text', text: 'World' },
    ];

    applyTemplateConfig(config, { brand_style_id: 42, sections });

    expect(config.brandStyleId).toBe(42);
    expect(config.template).toBeUndefined();
    // Sections should be converted to RCML via buildSectionsFromBlocks
    const builtSections = config.sections as Array<{ tagName: string; children: Array<{ tagName: string; children: unknown[] }> }>;
    expect(builtSections).toHaveLength(1);
    expect(builtSections[0].tagName).toBe('rc-section');
    expect(builtSections[0].children[0].tagName).toBe('rc-column');
    expect(builtSections[0].children[0].children).toHaveLength(2);
  });

  it('ignores sections when template is provided', () => {
    const config: Record<string, unknown> = {};
    const template = { body: [] };
    const sections: ContentBlock[] = [{ type: 'heading', text: 'Ignored' }];

    applyTemplateConfig(config, { template, sections });

    expect(config.template).toEqual(template);
    expect(config.sections).toBeUndefined();
  });

  it('does not set brandStyleId when neither template nor brand_style_id is provided', () => {
    const config: Record<string, unknown> = {};

    applyTemplateConfig(config, {});

    expect(config.template).toBeUndefined();
    expect(config.brandStyleId).toBeUndefined();
    expect(config.sections).toBeUndefined();
  });
});
