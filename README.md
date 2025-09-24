# Scout Singleton - Raycast Extension

Video editing workflow automation for student athletes. This extension consolidates prospect pipeline and player ID update workflows into a unified Scout Singleton interface.

## Features

### Commands

- **🎯 ID Tasks** - View and manage video editing tasks from Asana's ID Tasks project
- **📬 Inbox Check** - Check NPID video team inbox for new assignments
- **🔍 Player Lookup** - Find player details via Selenium automation
- **🔄 Sync Status** - Sync Asana task status back to NPID (background)

### Integrations

- **Asana**: Connects to 'ID Tasks' project with custom fields (Sport, Class, PlayerID, Stage, Status, Positions)
- **NPID API**: Integrates with National Prospect ID for inbox management and status updates
- **Selenium**: Automates player profile lookups and data extraction
- **MCP (Model Context Protocol)**: Docker Compose stacks for both NPID and the official OAuth-backed Asana MCP server live under `scout-mcp-servers/`

## Setup

### Prerequisites

- Python 3.7+ with pip
- Google Chrome (for Selenium automation)
- Node.js 16+ and npm
- Raycast app

### Installation

1. Run the setup script:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. Configure Asana OAuth:
   - Open Raycast preferences
   - Configure Asana authentication

3. Configure NPID API:
   - Add NPID API key in extension preferences
   - Set base URL (default: https://dashboard.nationalpid.com)

### Development

```bash
npm run dev      # Start development mode
npm run build    # Build for production
npm run lint     # Run linter
```

## Usage

### ID Tasks
View and manage video editing tasks with status tracking, player information, and direct links to Asana and player profiles.

### Inbox Check
Monitor the NPID video team inbox for new video requests. Automatically create Asana tasks and assign them to yourself.

### Player Lookup
Search for players by name or ID using either:
- Direct NPID API lookup (by Player ID)
- Selenium automation for name searches
- Data export functionality

### Sync Status
Background sync of Asana task statuses to NPID progress tracking. Maps Asana statuses to NPID progress states:
- INBOX/Revise → editing
- HUDL/Review → review  
- Dropbox/Approved → approved
- Uploads/Complete → published

## Project Structure

```
src/
├── api/
│   ├── npid.ts           # NPID API integration
│   ├── request.ts        # Asana API requests
│   └── tasks.ts          # Asana task types
├── components/           # Shared UI components
├── scripts/
│   └── player_lookup.py  # Selenium automation
├── id-tasks.tsx         # Main task management
├── inbox-check.tsx      # Inbox monitoring
├── player-lookup.tsx    # Player search
└── sync-status.tsx      # Status synchronization
```

## Custom Fields

The extension expects these custom fields in the Asana 'ID Tasks' project:
- **Sport**: Multi-select sport categories
- **Class**: Graduation year/class
- **PlayerID**: NPID identifier
- **Stage**: Current editing stage
- **Status**: Task status (INBOX, Revise, HUDL, etc.)
- **Positions**: Player positions

## API Endpoints

### NPID Integration
- `GET /videoteammsg/inbox` - Fetch inbox messages
- `POST /videoteammsg/inbox/assign` - Assign message to user
- `PATCH /videoteammsg/videoprogress/:playerId` - Update progress

### MCP Tools Available

#### Asana MCP Tools
- `asana_create_task` - Create a new task in a project
- `asana_update_task` - Update an existing task's details
- `asana_get_task` - Get detailed information about a specific task
- `asana_search_tasks` - Search tasks in a workspace with advanced filtering
- `asana_list_workspaces` - List all available workspaces
- `asana_get_project` - Get detailed information about a specific project

#### NPID MCP Tools
- `get_inbox_threads` - Fetch video team inbox messages
- `get_thread_details` - Get detailed thread information including email content
- `get_assignment_modal_data` - Get assignment modal data with available editors
- `assign_thread` - Assign inbox thread to user with status and stage

## Raycast MCP Integration

This extension uses the Raycast MCP Builder patterns for seamless integration:

### MCP Client Usage

```typescript
import { callNPIDToolWithFeedback } from './src/bridge/mcpClient';

// Call MCP tools with user feedback
const result = await callNPIDToolWithFeedback(
  'get_inbox_threads',
  { limit: '10' },
  {
    loadingMessage: 'Fetching inbox...',
    successMessage: 'Inbox loaded successfully',
    errorMessage: 'Failed to load inbox'
  }
);
```

### Docker MCP Servers

The extension includes Docker-based MCP servers for both NPID and Asana:

```bash
# Start MCP servers
cd scout-mcp-servers
docker compose up -d

# Check server status
docker compose ps
```

### Environment Configuration

Create a `.env` file in `scout-mcp-servers/` with:

```env
# NPID Configuration
NPID_XSRF_TOKEN=your_token_here
NPID_SESSION=your_session_here
NPID_BASE_URL=https://dashboard.nationalpid.com

# Asana Configuration
ASANA_CLIENT_ID=your_client_id
ASANA_CLIENT_SECRET=your_client_secret
```

## License

MIT License - see LICENSE file for details.
