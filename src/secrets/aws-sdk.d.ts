declare module "@aws-sdk/client-secrets-manager" {
  export class SecretsManagerClient {
    constructor(config?: { region?: string });
    send(command: GetSecretValueCommand): Promise<GetSecretValueOutput>;
  }

  export class GetSecretValueCommand {
    constructor(input: { SecretId: string; VersionStage?: string });
  }

  interface GetSecretValueOutput {
    SecretString?: string;
  }
}
