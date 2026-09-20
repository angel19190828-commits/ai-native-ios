export class AccountDeletionError extends Error {
  constructor(public readonly code: string, public readonly status?: number) {
    super(`Account deletion failed: ${code}`);
    this.name = 'AccountDeletionError';
  }
}

type Options = {
  baseUrl: string;
  getAccessToken: () => Promise<string | undefined>;
  fetch?: typeof fetch;
};

export class AccountClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly options: Options) { this.fetchImpl = options.fetch ?? fetch; }

  async deleteAccount(): Promise<void> {
    const token = await this.options.getAccessToken();
    if (!token) throw new AccountDeletionError('authentication_required');
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/api/account`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.ok) return;
    const payload = await response.json().catch(() => undefined) as { error?: { code?: string } } | undefined;
    throw new AccountDeletionError(payload?.error?.code ?? 'account_deletion_failed', response.status);
  }
}
