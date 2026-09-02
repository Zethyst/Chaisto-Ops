import { apiErrorMessage } from '../apiError';

describe('apiErrorMessage', () => {
  it('prefers an explicit { error } message', () => {
    const err = { response: { data: { error: 'Can only log for your assigned stall' } } };
    expect(apiErrorMessage(err, 'fallback')).toBe('Can only log for your assigned stall');
  });

  it('reads express-validator messages, which used to fall through to the fallback', () => {
    const err = {
      response: {
        data: { errors: [{ type: 'field', msg: 'Amount must be at least ₹1', path: 'amount' }] },
      },
    };
    expect(apiErrorMessage(err, 'fallback')).toBe('Amount must be at least ₹1');
  });

  it('names the offending field when the validator gave no message', () => {
    const err = {
      response: { data: { errors: [{ type: 'field', msg: 'Invalid value', path: 'stallId' }] } },
    };
    expect(apiErrorMessage(err, 'fallback')).toBe('stallId is missing or invalid.');
  });

  it('falls back on a network error with no response', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'Could not save.')).toBe('Could not save.');
  });
});
