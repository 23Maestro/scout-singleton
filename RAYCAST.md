# Raycast MCP Integration Guide

## Overview

This Raycast extension uses the Raycast MCP Builder patterns for seamless integration with Docker-based MCP servers, providing a clean interface for AI-powered video editing workflows.

## Architecture

```
Raycast Extension → MCP Client → Docker MCP Servers → External APIs
                                      ↓
                              NPID Dashboard & Asana
```

## MCP Client Integration

### Basic Usage

```typescript
import { callNPIDToolWithFeedback } from './src/bridge/mcpClient';

// In your Raycast command
export default function InboxCheck() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callNPIDToolWithFeedback(
      'get_inbox_threads',
      { limit: '20' },
      {
        loadingMessage: 'Fetching inbox threads...',
        successMessage: 'Inbox loaded successfully',
        errorMessage: 'Failed to load inbox'
      }
    ).then(result => {
      if (result.success) {
        setThreads(result.data);
      }
      setLoading(false);
    });
  }, []);

  return (
    <List isLoading={loading}>
      {threads.map(thread => (
        <List.Item
          key={thread.id}
          title={thread.player_name}
          subtitle={`${thread.sport} - ${thread.class}`}
          actions={
            <ActionPanel>
              <Action
                title="Assign to Me"
                onAction={() => assignThread(thread.id)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
```

### Advanced Usage with Error Handling

```typescript
import { callNPIDTool, callAsanaTool } from './src/bridge/mcpClient';

async function createTaskFromThread(threadId: string) {
  try {
    // Get thread details
    const threadResult = await callNPIDTool('get_thread_details', { thread_id: threadId });
    if (!threadResult.success) {
      throw new Error(threadResult.error);
    }

    // Create Asana task
    const taskResult = await callAsanaTool('asana_create_task', {
      project_id: "1208992901563477",
      name: `${threadResult.data.player_name} - ${threadResult.data.sport}`,
      notes: `Player ID: ${threadResult.data.player_id}\n\nMessage: ${threadResult.data.email_subject}`,
      assignee: "Jerami Singleton"
    });

    if (!taskResult.success) {
      throw new Error(taskResult.error);
    }

    return taskResult.data;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}
```

## Docker MCP Servers

### Starting the Servers

```bash
# Navigate to MCP servers directory
cd scout-mcp-servers

# Create environment file
cp .env.example .env
# Edit .env with your actual tokens

# Start servers
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Server Health Checks

```typescript
// Check if MCP servers are healthy
async function checkMCPServers() {
  const npidHealthy = await fetch('http://localhost:8812/health').then(r => r.ok).catch(() => false);
  const asanaHealthy = await fetch('http://localhost:8000/health').then(r => r.ok).catch(() => false);
  
  return { npidHealthy, asanaHealthy };
}
```

## Environment Configuration

### Required Environment Variables

```env
# NPID Configuration
NPID_XSRF_TOKEN=eyJpdiI6...  # From browser session
NPID_SESSION=eyJpdiI6...     # From browser session
NPID_BASE_URL=https://dashboard.nationalpid.com

# Asana Configuration
ASANA_CLIENT_ID=your_client_id
ASANA_CLIENT_SECRET=your_client_secret
ASANA_REDIRECT_URI=http://localhost:3030
ASANA_SCOPES=default_scopes
```

### Getting NPID Tokens

1. Log into NPID dashboard in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage → Cookies
4. Copy `XSRF-TOKEN` and `myapp_session` values

### Getting Asana Credentials

1. Go to Asana Developer Console
2. Create a new app
3. Copy Client ID and Client Secret
4. Set redirect URI to `http://localhost:3030`

## Best Practices

### 1. Error Handling

```typescript
// Always wrap MCP calls in try-catch
try {
  const result = await callNPIDTool('get_inbox_threads', { limit: '10' });
  if (!result.success) {
    throw new Error(result.error);
  }
  // Use result.data
} catch (error) {
  console.error('MCP call failed:', error);
  // Handle error appropriately
}
```

### 2. Loading States

```typescript
// Show loading indicators
const [loading, setLoading] = useState(true);

useEffect(() => {
  callNPIDTool('get_inbox_threads', { limit: '10' })
    .then(result => {
      // Process result
    })
    .finally(() => setLoading(false));
}, []);
```

### 3. Caching

```typescript
// Cache results when appropriate
const [cachedThreads, setCachedThreads] = useState(null);

useEffect(() => {
  if (!cachedThreads) {
    callNPIDTool('get_inbox_threads', { limit: '50' })
      .then(result => {
        if (result.success) {
          setCachedThreads(result.data);
        }
      });
  }
}, [cachedThreads]);
```

### 4. User Feedback

```typescript
// Use the feedback version for important operations
await callNPIDToolWithFeedback(
  'assign_thread',
  { thread_id: threadId, assignee: 'Jerami Singleton' },
  {
    loadingMessage: 'Assigning thread...',
    successMessage: 'Thread assigned successfully',
    errorMessage: 'Failed to assign thread'
  }
);
```

## Troubleshooting

### Common Issues

1. **MCP Server Not Responding**
   ```bash
   # Check if containers are running
   docker compose ps
   
   # Restart if needed
   docker compose restart
   ```

2. **Authentication Errors**
   ```bash
   # Check environment variables
   docker compose exec scout-npid-mcp env | grep NPID
   ```

3. **Network Connectivity**
   ```bash
   # Test MCP server directly
   curl -X POST http://localhost:8812/mcp-call \
     -H "Content-Type: application/json" \
     -d '{"tool":"get_inbox_threads","arguments":{"limit":"5"}}'
   ```

### Debug Mode

```typescript
// Enable debug logging
const DEBUG = true;

if (DEBUG) {
  console.log('MCP Tool Call:', { tool, args });
}
```

## Development

### Adding New MCP Tools

1. Add tool to MCP server Python file
2. Update TypeScript client with new function
3. Add to Raycast command
4. Test integration

### Testing MCP Integration

```bash
# Test NPID server
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  docker exec -i scout-npid-mcp python scout_npid_server.py

# Test with curl
curl -X POST http://localhost:8812/mcp-call \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_inbox_threads","arguments":{"limit":"3"}}'
```

## Security Considerations

- All secrets stored in environment variables
- Never hardcode credentials in code
- MCP servers run as non-root users
- Sensitive data never logged
- Use HTTPS for production deployments

## Performance Tips

- Cache frequently accessed data
- Use appropriate limits for API calls
- Implement proper loading states
- Handle network timeouts gracefully
- Monitor Docker container resource usage
