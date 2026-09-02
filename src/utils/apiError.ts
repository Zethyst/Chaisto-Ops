/**
 * Pulls a readable message out of an API error.
 *
 * Routes reject either with `{ error }` or, from express-validator,
 * `{ errors: [{ msg, path }] }` — reading only the former turned every
 * validation failure into a generic "please try again".
 */
export function apiErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (typeof data?.error === 'string') return data.error;

  const first = data?.errors?.[0];
  if (first?.msg) {
    return first.msg === 'Invalid value' && first.path
      ? `${first.path} is missing or invalid.`
      : first.msg;
  }
  return fallback;
}
