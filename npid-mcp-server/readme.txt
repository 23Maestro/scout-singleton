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
- Valid NPID authentication (XSRF token and session cookie)
- Access to NPID video team dashboard

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
                           Docker Desktop Secrets
                           (NPID_XSRF_TOKEN, NPID_SESSION, NPID_BASE_URL)
```

## Development

### Local Testing

```bash
# Set environment variables for testing
export NPID_XSRF_TOKEN="your-xsrf-token"
export NPID_SESSION="your-session-cookie"
export NPID_BASE_URL="https://dashboard.nationalpid.com"

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
- Verify secrets with `docker mcp secret list`
- Ensure secret names match in code and catalog
- Check NPID dashboard for fresh tokens/cookies
- Verify XSRF token format and session cookie validity

## Security Considerations

- All secrets stored in Docker Desktop secrets
- Never hardcode credentials
- Running as non-root user
- Sensitive data never logged
- Authentication tokens rotated regularly

## License

MIT License
