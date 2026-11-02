/** An error whose message is safe and useful to show to the admin as-is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof UserError) return err.message;
  console.error(err);
  if (err instanceof Error) return `Something went wrong: ${err.message}`;
  return 'Something went wrong.';
}
