# NPID Video Team MCP Server

A Model Context Protocol (MCP) server that provides video team inbox management and player assignment for National Prospect ID (NPID) workflows.

## Purpose

This MCP server provides a secure interface for AI assistants to manage NPID video team inbox messages, assign players to editors, and coordinate video production workflows through Raycast extensions.

## Features

### Current Implementation
- **`get_inbox_threads`** - Retrieve video team inbox messages with email content and metadata
- **`get_thread_details`** - Get detailed thread information including email content and attachments
- **`get_assignment_modal_data`** - Fetch assignment modal data with available editors, status and stage options
- **`assign_thread`** - Assign threads to editors with status/stage selection (locks player to assignee)
- **`search_player`** - Search for players by name, email, or ID for assignment purposes
- **`get_my_assignments`** - Get current assignments for a specific editor
- **`check_inbox_updates`** - Check for new inbox messages and return summary of unassigned items

## Prerequisites

- Docker Desktop with MCP Toolkit enabled
- Docker MCP CLI plugin (`docker mcp` command)
- NPID dashboard service account (username + password)
- Optional: Raycast extension reading the shared token cache

## Installation

See the step-by-step instructions provided with the files.

## Usage Examples

In Raycast with scout-singleton extension, you can:
- "Check my NPID inbox for new video requests"
- "Show details for thread ID 12345"
- "Get assignment options for this thread"
- "Assign this video request to me with editing status"
- "Search for player John Smith"
- "Show my current video assignments"

## Architecture

```
Raycast Extension → MCP Gateway → NPID MCP Server → NPID Dashboard API
                                   ↓
                         Token Manager (shared JSON cache)
                                   ↓
                        Scheduled login + keep-alive cron
```

The server authenticates with the dashboard by storing a small token bundle in
`/app/state/npid_tokens.json` (configurable via `NPID_TOKEN_PATH`). The file is
designed to live on a shared host volume so the Raycast extension can reuse the
same session without manual copy/paste.

## Development

### Local Testing

```bash
# Set environment variables for testing
export NPID_USERNAME="your-npid-username"
export NPID_PASSWORD="your-npid-password"
export NPID_BASE_URL="https://dashboard.nationalpid.com"
export NPID_TOKEN_PATH="$(pwd)/state/npid_tokens.json"

# Run directly
python npid_server.py

# Test MCP protocol
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | python npid_server.py
```

### Adding New Tools

1. Add the function to `npid_server.py`
2. Decorate with `@mcp.tool()`
3. Update the catalog entry with the new tool name
4. Rebuild the Docker image

## Troubleshooting

### Tools Not Appearing
- Verify Docker image built successfully
- Check catalog and registry files
- Ensure Raycast MCP client config includes custom catalog
- Restart MCP Gateway

### Authentication Errors
- Confirm `NPID_USERNAME` / `NPID_PASSWORD` are set for the container
- Check that the token cache file exists and is writable (`NPID_TOKEN_PATH`)
- Inspect logs for `token-manager` messages (refresh + keepalive events)
- Ensure the dashboard credentials are not protected by MFA/SSO prompts

## Security Considerations

- All secrets stored in Docker Desktop secrets
- Never hardcode credentials
- Running as non-root user
- Sensitive data never logged
- Authentication tokens rotated regularly

## License

MIT License
