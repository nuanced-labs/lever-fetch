import {
  CACHE_KEY_SEPARATOR,
  ERROR_MISSING_FIELD,
  ERROR_NOT_JSON,
  ERROR_UNKNOWN_PROVIDER,
  PROVIDER_AWS_SECRETS_MANAGER,
} from "./types.js";
import type { SecretOptions, SecretsProvider } from "./types.js";

const providers = new Map<string, SecretsProvider>();
const cache = new Map<string, string>();

export function registerProvider(provider: SecretsProvider): void {
  providers.set(provider.name, provider);
}

async function autoDiscover(name: string): Promise<SecretsProvider> {
  if (name === PROVIDER_AWS_SECRETS_MANAGER) {
    const { createAwsSecretsManagerProvider } = await import("./aws-secrets-manager.js");
    const provider = createAwsSecretsManagerProvider();
    registerProvider(provider);
    return provider;
  }

  const available = Array.from(providers.keys());
  throw new Error(ERROR_UNKNOWN_PROVIDER(name, available));
}

function extractField(raw: string, secretId: string, field: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(ERROR_NOT_JSON(secretId));
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, field)) {
    throw new Error(ERROR_MISSING_FIELD(secretId, field));
  }

  const value = parsed[field];

  return String(value);
}

export async function secret(
  provider: string,
  secretId: string,
  options?: SecretOptions,
): Promise<string> {
  const instance = providers.get(provider) ?? (await autoDiscover(provider));
  const cacheKey = `${provider}${CACHE_KEY_SEPARATOR}${secretId}`;

  let raw = cache.get(cacheKey);
  if (raw === undefined) {
    const { field: _, ...providerOptions } = options ?? {};
    raw = await instance.getSecret(secretId, providerOptions);
    cache.set(cacheKey, raw);
  }

  if (options?.field) {
    return extractField(raw, secretId, options.field);
  }

  return raw;
}
