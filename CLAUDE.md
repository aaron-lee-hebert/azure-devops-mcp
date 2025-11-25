# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server for Azure DevOps, built with TypeScript. It exposes Azure DevOps functionality through simple, focused tools that provide a thin abstraction layer over the Azure DevOps REST APIs. The server runs as a stdio-based MCP server that can be integrated with VS Code, Claude, Cursor, and other MCP clients.

**Supported Environments:**

- Azure DevOps Services (cloud-hosted at dev.azure.com)
- Azure DevOps Server (on-premises installations)

## Development Commands

### Building

```bash
npm run build          # Compile TypeScript to dist/
npm run watch          # Compile TypeScript in watch mode
npm run prepare        # Runs build (used by npm during install)
npm run prebuild       # Generates version.ts from package.json (runs automatically before build)
```

### Testing

```bash
npm test                                    # Run all tests with coverage
npm test test/src/utils.test.ts            # Run specific test file
npm test -- --coverage                      # Run tests with coverage report
```

### Code Quality

```bash
npm run format         # Format code with Prettier
npm run format-check   # Check code formatting
npm run eslint         # Lint code
npm run eslint-fix     # Lint and auto-fix issues
npm run validate-tools # Validate tool definitions and run TypeScript check
```

### Running Locally

```bash
npm start              # Run the compiled server
npm run inspect        # Run with MCP Inspector for debugging
```

### Cleanup

```bash
npm run clean          # Remove dist/ directory
```

## Architecture

### Entry Point

- `src/index.ts`: Main entry point. Parses CLI args (organization, domains, authentication type), sets up the MCP server, configures authentication, and registers all tools based on enabled domains.

### Authentication

- `src/auth.ts`: Handles multiple authentication methods:
  - `interactive`: OAuth flow with browser (default for non-Codespaces, cloud only)
  - `azcli`: Azure CLI credentials (default for GitHub Codespaces, cloud only)
  - `env`: DefaultAzureCredential (cloud only)
  - `pat`: Personal Access Token from `ADO_PAT` environment variable (recommended for on-premises)
  - `envvar`: Read token from `ADO_MCP_AUTH_TOKEN` environment variable (legacy support)
- Authentication can be tenant-scoped for multi-tenant scenarios (cloud only)
- On-premises installations must use `pat` or `envvar` authentication

### Domain System

- `src/shared/domains.ts`: Manages tool domains. Domains group related tools (e.g., `core`, `work`, `work-items`, `repositories`, `wiki`, `pipelines`, `test-plans`, `search`, `advanced-security`).
- Tools are only loaded for enabled domains to avoid overwhelming MCP clients with too many tools
- Use `-d` flag to specify domains: `npx @azure-devops/mcp myorg -d core work work-items`
- Default is `all` domains

### Tool Organization

Tools are organized by domain in `src/tools/`:

- `core.ts`: Projects, teams, identity lookups
- `work.ts`: Iterations, team capacity
- `work-items.ts`: Work items (CRUD, comments, links, queries, batch operations)
- `repositories.ts`: Repos, branches, pull requests, commits, comments
- `pipelines.ts`: Build definitions, builds, logs, runs
- `wiki.ts`: Wiki pages (list, get, create, update)
- `test-plans.ts`: Test plans, test cases, test results
- `search.ts`: Code, wiki, work item search
- `advanced-security.ts`: Security alerts

Each tool file exports a `configure*Tools` function that registers tools with the MCP server.

### Tool Registration

- `src/tools.ts`: Orchestrates tool registration. Calls each domain's configuration function if that domain is enabled.
- Tools use Zod schemas for input validation and the MCP SDK's `server.tool()` method

## Tool Development Patterns

### Prefer Azure DevOps TypeScript Clients

When adding new tools, prioritize using the official Azure DevOps TypeScript clients from `azure-devops-node-api` over direct REST API calls. Only use direct API calls if the client or method is not available.

### Tool Design Philosophy

Tools should be:

- **Simple**: Each tool does one thing well
- **Focused**: Specific scenarios, not complex multi-step operations
- **Thin abstractions**: Minimal logic, let the LLM handle reasoning
- **Consistent**: Follow existing patterns in the codebase

### Batch Operations

When working with work items:

- Use batch tools for updates instead of many individual updates
- Batch up to 200 updates in a single operation
- Use `wit_get_work_items_batch_by_ids` to get work item details after getting a list of IDs

### Error Handling

Tools should catch errors and return structured error responses:

```typescript
try {
  // tool logic
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
  return {
    content: [{ type: "text", text: `Error: ${errorMessage}` }],
    isError: true,
  };
}
```

## Testing

### Test Structure

- Tests are in `test/` directory, mirroring the `src/` structure
- Jest with ts-jest for TypeScript support
- Configuration: `jest.config.cjs` and `tsconfig.jest.json`

### Key Test Configuration

- `isolatedModules: true` in `tsconfig.jest.json` eliminates ts-jest warnings
- Tests use CommonJS modules for Jest compatibility
- Coverage thresholds: 40% (branches, functions, lines, statements)

### Test Guidelines

- All new tools must have corresponding tests
- PRs will not be accepted without tests
- Run tests before submitting PRs

## File Structure

```
src/
  index.ts              # Entry point, CLI parsing, server setup
  auth.ts               # Authentication providers
  tools.ts              # Tool registration orchestration
  utils.ts              # Shared utilities
  useragent.ts          # User agent string composition
  version.ts            # Auto-generated version from package.json
  org-tenants.ts        # Organization tenant ID lookup
  shared/
    domains.ts          # Domain management
    tool-validation.ts  # Tool validation utilities
  tools/
    [domain].ts         # Tool implementations by domain
test/
  src/                  # Tests mirroring src/ structure
```

## Contributing Workflow

1. **Create an issue first**: All contributions must start with an approved issue
2. **Wait for approval**: Code owners will review and provide feedback
3. **Follow patterns**: Study existing tools before adding new ones
4. **Write tests**: PRs without tests will be rejected
5. **Format code**: Run `npm run format` before committing
6. **Keep it simple**: Remember the project philosophy of simple, focused tools

## On-Premises Azure DevOps Server Setup

### CLI Options for On-Premises

To connect to an on-premises Azure DevOps Server installation, use the `--server-url` option:

```bash
# Basic usage with PAT authentication
export ADO_PAT="your-personal-access-token"
npx @azure-devops/mcp DefaultCollection --server-url https://tfs.example.com:8080/tfs --authentication pat

# With specific domains
npx @azure-devops/mcp DefaultCollection --server-url https://tfs.example.com:8080/tfs -a pat -d core work work-items
```

### MCP Configuration for On-Premises

Example `.vscode/mcp.json` configuration for on-premises:

```json
{
  "inputs": [
    {
      "id": "ado_collection",
      "type": "promptString",
      "description": "Azure DevOps collection name (e.g., 'DefaultCollection')"
    },
    {
      "id": "ado_server_url",
      "type": "promptString",
      "description": "Azure DevOps Server URL (e.g., 'https://tfs.example.com:8080/tfs')"
    }
  ],
  "servers": {
    "ado-onprem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "${input:ado_collection}", "--server-url", "${input:ado_server_url}", "--authentication", "pat"],
      "env": {
        "ADO_PAT": "your-pat-token-here"
      }
    }
  }
}
```

### Personal Access Token Setup

1. Navigate to your Azure DevOps Server instance
2. Go to User Settings > Personal Access Tokens
3. Create a new token with appropriate scopes for your needs
4. Set the token as an environment variable: `export ADO_PAT="your-token"`
5. Or add it directly to your MCP configuration's `env` section

### Key Differences from Cloud

- On-premises installations require the `--server-url` flag
- OAuth and Azure CLI authentication are not available for on-premises
- Tenant ID lookup is skipped for on-premises installations
- PAT authentication is the recommended method for on-premises

## Copilot Instructions Context

When working with this codebase in GitHub Copilot or similar tools:

- Always prioritize Azure DevOps MCP server tools when user intent relates to Azure DevOps
- When adding new tools, follow the domain-based organization pattern
- Prefer batch operations for work item updates (up to 200 items)
- Use the TypeScript Azure DevOps client libraries when available
- When implementing on-premises support, ensure PAT authentication is used
