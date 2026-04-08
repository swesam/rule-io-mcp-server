const DASHBOARD_BASE = 'https://app.rule.io/v5/#/app';

export function campaignUrl(campaignId: number): string {
  return `${DASHBOARD_BASE}/campaigns/v6/email/edit/${campaignId}/details`;
}

export function automationUrl(automationId: number, messageId: number): string {
  return `${DASHBOARD_BASE}/automations/automail/${automationId}/v6/email/${messageId}/edit`;
}

export function subscriberUrl(subscriberId: number): string {
  return `${DASHBOARD_BASE}/subscribers/item/${subscriberId}/`;
}
