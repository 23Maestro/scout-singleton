# NPID MCP Server - Raycast Integration Guide

## Implementation Details

This MCP server is specifically designed for Raycast extension integration (NOT Claude Desktop). It provides video team inbox management tools for the scout-singleton extension.

## Key Integration Points

### 1. Authentication Flow
- Uses Docker MCP secrets for secure token storage
- Handles NPID XSRF tokens and session cookies
- Automatic header management for API calls

### 2. Video Team Inbox Workflow
```
1. get_inbox_threads() → Shows pending video requests
2. get_thread_details(id) → Shows email content and attachments  
3. get_assignment_modal_data(id) → Gets status/stage options
4. assign_thread(id, assignee, status, stage) → Assigns and locks player
```

### 3. Human-in-the-Loop Assignment Process
- **Inbox Check**: Raycast shows unassigned video requests
- **Email Integration**: Tasks created with Asana email forwarding (x+1211354715479093@mail.asana.com)
- **Assignment Modal**: Status/Stage options fetched from NPID API
- **Player Locking**: Assignment locks player to editor in NPID system

### 4. Raycast Extension Integration

Update your `inbox-check.tsx` to use MCP calls:

```typescript
import { getInboxThreads, getThreadDetails, assignThread } from "./bridge/mcpClient";

// Replace direct API calls with MCP calls
const loadInboxMessages = async () => {
  const response = await getInboxThreads(50);
  if (response.success) {
    // Parse MCP response
    const threads = JSON.parse(response.data);
    setMessages(threads);
  }
};

const handleAssignment = async (threadId: string) => {
  // Get assignment options
  const modalData = await getAssignmentModalData(threadId);
  
  // Show status/stage selection UI
  // ...
  
  // Assign thread
  const result = await assignThread(threadId, "Jerami Singleton", selectedStatus, selectedStage);
  
  // Create Asana task with email integration
  await createAsanaTaskWithEmail(threadData, "x+1211354715479093@mail.asana.com");
};
```

## Guidelines

### Tool Design Patterns
- Single-line docstrings only (critical for MCP Gateway)
- Empty string defaults for all parameters
- Consistent error handling with emoji prefixes
- JSON response formatting for structured data

### Error Handling
- ✅ Success operations
- ❌ Errors with descriptive messages
- 🔍 Search operations
- 📊 Data/statistics
- ⏱️ Time-related operations

### Security Best Practices
- Never log sensitive tokens
- Use Docker secrets for all credentials
- Validate all input parameters
- Handle authentication failures gracefully

## Email Integration with Asana

The server supports the Asana email forwarding workflow:

1. **NPID Inbox** → Shows video requests
2. **Assignment Decision** → Human selects status/stage
3. **Asana Task Creation** → Uses email address for forwarding
4. **Ongoing Communication** → Email replies update Asana task

### Asana Email Format
- **To**: `x+1211354715479093@mail.asana.com`
- **Subject**: `Player Name - Sport - Class Year`
- **Body**: Includes player ID, message, video links
- **Attachments**: Video files or links

## Testing

### Local Development
```bash
# Test individual tools
curl -X POST http://127.0.0.1:8811/tools/call \
  -H "Content-Type: application/json" \
  -d '{"server": "npid", "tool": "get_inbox_threads", "arguments": {"limit": "10"}}'
```

### Raycast Integration Test
1. Build and start MCP server
2. Update scout-singleton extension to use MCP calls
3. Test inbox loading and assignment workflow
4. Verify Asana task creation with email integration

## Deployment

1. Build Docker image: `docker build -t npid-mcp-server .`
2. Set secrets: `docker mcp secret set NPID_XSRF_TOKEN=...`
3. Update catalog and registry files
4. Restart MCP Gateway
5. Test from Raycast extension

This server enables seamless integration between NPID video team inbox management and Raycast-based workflow automation.
