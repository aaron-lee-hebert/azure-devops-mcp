// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Creates an authenticator function for Azure DevOps Server.
 * Supports PAT (Personal Access Token) authentication.
 *
 * @param type - The authentication type: 'pat' (default) or 'envvar' (legacy)
 * @returns A function that returns a Promise resolving to the authentication token
 */
function createAuthenticator(type: string, cliPat?: string): () => Promise<string> {
  switch (type) {
    case "pat":
      // Personal Access Token authentication (recommended)
      // Priority: CLI argument > environment variables
      return async () => {
        const token = cliPat || process.env["ADO_PAT"];
        if (!token) {
          throw new Error("Personal Access Token not found. Provide via --pat argument or set AZURE_DEVOPS_PAT environment variable.");
        }
        return token;
      };

    case "envvar":
      // Read token from fixed environment variable (legacy support)
      return async () => {
        const token = process.env["ADO_MCP_AUTH_TOKEN"];
        if (!token) {
          throw new Error("Environment variable 'ADO_MCP_AUTH_TOKEN' is not set or empty. Please set it with a valid Azure DevOps Personal Access Token.");
        }
        return token;
      };

    default:
      throw new Error(`Unknown authentication type: ${type}. Supported types are 'pat', 'envvar', and 'ntlm'.`);
  }
}

export { createAuthenticator };
