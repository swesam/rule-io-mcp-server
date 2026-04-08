import { describe, it, expect } from 'vitest';
import { RuleApiError } from 'rule-io-sdk';
import {
  handleRuleError,
  jsonResult,
  textResult,
  errorResult,
} from '../util/errors.js';

describe('handleRuleError', () => {
  it('returns auth error message for 401 RuleApiError', () => {
    const error = new RuleApiError('Unauthorized', 401);
    const result = handleRuleError(error);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Authentication failed. Check your RULE_IO_API_KEY environment variable.',
    });
  });

  it('returns rate limit message for 429 RuleApiError', () => {
    const error = new RuleApiError('Too Many Requests', 429);
    const result = handleRuleError(error);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Rate limited by Rule.io API. Please wait a moment and retry.',
    });
  });

  it('returns validation error with field details for 422 RuleApiError', () => {
    const error = new RuleApiError('Validation failed', 422);
    error.validationErrors = {
      email: ['The email field is required.'],
      name: ['The name must be a string.', 'The name must be at least 2 characters.'],
    };
    const result = handleRuleError(error);

    expect(result.isError).toBe(true);
    const text = result.content[0];
    expect(text).toHaveProperty('type', 'text');
    expect((text as { type: 'text'; text: string }).text).toContain('Validation error:');
    expect((text as { type: 'text'; text: string }).text).toContain('email: The email field is required.');
    expect((text as { type: 'text'; text: string }).text).toContain('name: The name must be a string., The name must be at least 2 characters.');
  });

  it('returns generic API error for other RuleApiError status codes', () => {
    const error = new RuleApiError('Internal Server Error', 500);
    const result = handleRuleError(error);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Rule.io API error (500): Internal Server Error',
    });
  });

  it('handles non-RuleApiError Error objects', () => {
    const error = new Error('Something broke');
    const result = handleRuleError(error);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Unexpected error: Something broke',
    });
  });

  it('handles non-Error values (string)', () => {
    const result = handleRuleError('a string error');

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Unexpected error: a string error',
    });
  });
});

describe('jsonResult', () => {
  it('returns properly formatted JSON content', () => {
    const data = { id: 1, name: 'test' };
    const result = jsonResult(data);

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(data, null, 2) },
    ]);
  });

  it('prepends dashboard URL when provided', () => {
    const data = { id: 42, name: 'Test Campaign' };
    const url = 'https://app.rule.io/v5/#/app/campaigns/v6/email/edit/42/details';
    const result = jsonResult(data, url);

    expect(result.isError).toBeUndefined();
    const content = result.content[0] as { type: 'text'; text: string };
    expect(content.text).toContain(`View in the Rule.io dashboard: ${url}`);
    const jsonText = content.text.split('\n\n').slice(1).join('\n\n');
    expect(JSON.parse(jsonText)).toEqual(data);
  });
});

describe('textResult', () => {
  it('returns properly formatted text content', () => {
    const result = textResult('hello world');

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: 'text', text: 'hello world' }]);
  });
});

describe('errorResult', () => {
  it('returns isError: true with text content', () => {
    const result = errorResult('something failed');

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'something failed' }]);
  });
});
