import { PROVIDER_AWS_SECRETS_MANAGER } from "./types.js";
import type { ProviderOptions, SecretsProvider } from "./types.js";

const SDK_PACKAGE = "@aws-sdk/client-secrets-manager";

const ERROR_SDK_MISSING =
  `${SDK_PACKAGE} is required for the ${PROVIDER_AWS_SECRETS_MANAGER} provider. ` +
  `Install it with: npm install ${SDK_PACKAGE}`;

const ERROR_NO_STRING_VALUE = (secretId: string) =>
  `Secret "${secretId}" has no string value. Binary secrets are not supported.`;

export function createAwsSecretsManagerProvider(
  config?: { region?: string },
): SecretsProvider {
  return {
    name: PROVIDER_AWS_SECRETS_MANAGER,

    async getSecret(secretId: string, options?: ProviderOptions): Promise<string> {
      let sdk: typeof import("@aws-sdk/client-secrets-manager");
      try {
        sdk = await import(SDK_PACKAGE);
      } catch {
        throw new Error(ERROR_SDK_MISSING);
      }

      const client = new sdk.SecretsManagerClient({
        region: options?.region ?? config?.region,
      });

      const command = new sdk.GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: options?.version,
      });

      const result = await client.send(command);
      const raw = result.SecretString;

      if (raw === undefined) {
        throw new Error(ERROR_NO_STRING_VALUE(secretId));
      }

      return raw;
    },
  };
}
