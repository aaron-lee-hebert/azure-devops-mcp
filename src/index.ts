#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBasicHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { createAuthenticator } from "./auth.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <collection> --server-url <url> [options]")
  .version(packageVersion)
  .command("$0 <collection> [options]", "Azure DevOps Server MCP Server", (yargs) => {
    yargs.positional("collection", {
      describe: "Azure DevOps Server collection name (e.g., 'DefaultCollection')",
      type: "string",
      demandOption: true,
    });
  })
  .option("server-url", {
    alias: "s",
    describe: "Azure DevOps Server URL",
    type: "string",
    demandOption: true,
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
    choices: ["pat", "envvar", "ntlm"],
    default: "pat",
  })
  .option("pat", {
    alias: "p",
    describe: "Personal Access Token (alternative to environment variable)",
    type: "string",
  })
  .help()
  .parseSync();

export const collectionName = argv.collection as string;
// Keep orgName export for backward compatibility with tools
export const orgName = collectionName;

// Build the server URL
const serverUrl = argv["server-url"] as string;
const orgUrl = `${serverUrl}/${collectionName}`;

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(
  getAzureDevOpsToken: () => Promise<string>,
  userAgentComposer: UserAgentComposer
): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    const authHandler = getBasicHandler("", accessToken);
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

  const authenticator = createAuthenticator(argv.authentication, argv.pat as string | undefined);

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
