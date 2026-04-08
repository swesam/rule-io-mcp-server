import { describe, it, expect } from 'vitest';
import { campaignUrl, automationUrl, subscriberUrl } from '../util/urls.js';

describe('dashboard URL helpers', () => {
  it('builds campaign URL', () => {
    expect(campaignUrl(914826)).toBe(
      'https://app.rule.io/v5/#/app/campaigns/v6/email/edit/914826/details'
    );
  });

  it('builds automation URL', () => {
    expect(automationUrl(32063, 90348)).toBe(
      'https://app.rule.io/v5/#/app/automations/automail/32063/v6/email/90348/edit'
    );
  });

  it('builds subscriber URL', () => {
    expect(subscriberUrl(375665036)).toBe(
      'https://app.rule.io/v5/#/app/subscribers/item/375665036/'
    );
  });
});
