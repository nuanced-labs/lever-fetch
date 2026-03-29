export interface ProviderOptions {
  /** Provider-specific region override (for example, AWS region) */
  region?: string;
  /** Secret version or stage identifier */
  version?: string;
}

export interface SecretsProvider {
  readonly name: string;
  getSecret(secretId: string, options?: ProviderOptions): Promise<string>;
}

export interface SecretOptions extends ProviderOptions {
  /** When the secret is a JSON object, the key to extract */
  field?: string;
}

export const PROVIDER_AWS_SECRETS_MANAGER = "aws-secrets-manager";

export const CACHE_KEY_SEPARATOR = ":";

export const ERROR_UNKNOWN_PROVIDER = (name: string, available: string[]) =>
  `Unknown secrets provider "${name}". Available: ${available.join(", ") || "none (register one with registerProvider())"}`;

export const ERROR_NOT_JSON = (secretId: string) =>
  `Secret "${secretId}" is not valid JSON. Remove the "field" option to use the raw value.`;

export const ERROR_MISSING_FIELD = (secretId: string, field: string) =>
  `Secret "${secretId}" does not contain field "${field}".`;
