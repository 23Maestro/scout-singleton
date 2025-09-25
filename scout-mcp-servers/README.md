# Scout MCP Servers

This directory contains Docker assets for local Model Context Protocol servers used by the Scout Singleton Raycast extension.

## Services

- **scout-npid-mcp** – Local MCP wrapper around the NPID APIs. It logs in with
  `NPID_USERNAME` / `NPID_PASSWORD`, keeps the session alive, and writes the
  shared token cache to the mounted `state/` directory.
- **scout-asana-mcp** – Launches the official Asana-hosted MCP server via `mcp-remote` and performs the OAuth flow automatically.

## Environment configuration

1. Copy `.env.example` to `.env` and fill in the required values.
   - `ASANA_CLIENT_ID` – OAuth client ID registered in your Asana developer app (required)
   - `ASANA_CLIENT_SECRET` – OAuth client secret (required)
   - `ASANA_REDIRECT_URI` – Optional override if you registered a custom redirect URI (defaults to `http://localhost:3030`)
   - `ASANA_SCOPES` – Optional additional scopes passed to `mcp-remote`
   - `NPID_USERNAME`, `NPID_PASSWORD` – Dashboard credentials used by the token manager
   - `NPID_BASE_URL` – Optional override (defaults to the production dashboard)
   - `NPID_TOKEN_PATH` – Optional custom location for the shared token cache (defaults to `/app/state/npid_tokens.json` inside the container)

Authentication tokens issued by Asana are persisted inside the named Docker volume `asana-mcp-auth`, so you only need to approve the OAuth flow the first time.

To start both servers:

```bash
cd scout-mcp-servers
docker compose up -d
```

The Asana service will emit a URL to complete OAuth in the logs when you run it for the first time. Visit the URL, authorise the application, and the container will pick up the refresh token automatically. Subsequent restarts reuse the cached token stored in the Docker volume.
