#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBearerHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization> [options]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name (or collection name for on-premises)",
      type: "string",
      demandOption: true,
    });
  })
  .option("domains", {
    alias: "d",
    describe: "Domain(s) to enable: 'all' for everything, or specific domains like 'repositories builds work'. Defaults to 'all'.",
    type: "string",
    array: true,
    default: "all",
  })
  .option("authentication", {
    alias: "a",
    describe: "Type of authentication to use",
    type: "string",
    choices: ["interactive", "azcli", "env", "envvar", "pat"],
    default: defaultAuthenticationType,
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .option("server-url", {
    alias: "s",
    describe: "Custom Azure DevOps Server URL (for on-premises installations, e.g., 'https://tfs.example.com:8080/tfs')",
    type: "string",
  })
  .help()
  .parseSync();

export const orgName = argv.organization as string;

// Determine if this is an on-premises installation
const isOnPremises = !!argv["server-url"];

// Build the organization URL
const orgUrl = isOnPremises ? `${argv["server-url"]}/${orgName}` : `https://dev.azure.com/${orgName}`;

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const authHandler = getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
    icons: [
      {
        src: "https://cdn.vsassets.io/content/icons/favicon.ico",
      },
    ],
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };

  // Skip tenant lookup for on-premises installations
  const tenantId = isOnPremises ? argv.tenant : ((await getOrgTenant(orgName)) ?? argv.tenant);
  const authenticator = createAuthenticator(argv.authentication, tenantId, isOnPremises);

  // removing prompts untill further notice
  // configurePrompts(server);

  configureAllTools(server, authenticator, getAzureDevOpsClient(authenticator, userAgentComposer), () => userAgentComposer.userAgent, enabledDomains);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
