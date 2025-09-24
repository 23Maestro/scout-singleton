// MCP Gateway integration for Raycast
import { showToast, Toast } from '@raycast/api';

const MCP_GATEWAY_URL = 'http://127.0.0.1:8001/mcp-call';

export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Session management for MCP Gateway
const mcpSessionId: string | null = null;

async function initializeMCPSession(): Promise<boolean> {
  // Simple HTTP bridge - no session management needed
  return true;
}

export async function callNPIDTool(
  tool: string,
  args: Record<string, unknown> = {},
): Promise<MCPResponse> {
  // Initialize session first
  if (!(await initializeMCPSession())) {
    return {
      success: false,
      error: 'Failed to initialize MCP session',
    };
  }

  // Use the original MCP Gateway
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (mcpSessionId) {
      headers['mcp-session-id'] = mcpSessionId;
    }

    const response = await fetch(MCP_GATEWAY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: tool,
        arguments: args,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP Tool Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'MCP tool call failed',
      };
    }

    return {
      success: true,
      data: result.result,
    };
  } catch (error) {
    console.error(`NPID MCP Tool Error (${tool}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Enhanced version with user feedback
export async function callNPIDToolWithFeedback(
  tool: string,
  args: Record<string, unknown> = {},
  options: {
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
  } = {},
): Promise<MCPResponse> {
  const { loadingMessage, successMessage, errorMessage } = options;

  if (loadingMessage) {
    await showToast({
      style: Toast.Style.Animated,
      title: loadingMessage,
    });
  }

  const result = await callNPIDTool(tool, args);

  if (result.success) {
    if (successMessage) {
      await showToast({
        style: Toast.Style.Success,
        title: successMessage,
      });
    }
  } else {
    const error = errorMessage || `Failed to call ${tool}: ${result.error}`;
    await showToast({
      style: Toast.Style.Failure,
      title: error,
    });
  }

  return result;
}

export async function callAsanaTool(
  tool: string,
  args: Record<string, unknown> = {},
): Promise<MCPResponse> {
  // Use Raycast MCP Builder pattern - simple HTTP bridge
  console.log(`Calling Asana MCP: ${tool}`, args);

  try {
    const response = await fetch('http://localhost:8001/mcp-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool,
        arguments: args,
      }),
    });

    if (!response.ok) {
      throw new Error(`Asana MCP error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Asana MCP ${tool} succeeded`);
    return { success: true, data: result };
  } catch (error) {
    console.error(`Asana MCP ${tool} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Convenience functions for common operations
export async function getInboxThreads(limit = 50) {
  console.log('🔍 getInboxThreads called with limit:', limit);

  try {
    console.log('🔍 About to import selenium-runner-fixed...');
    // Use improved Selenium runner with better error handling
    const { runSeleniumInboxExtraction } = await import('../lib/selenium-runner-improved');
    console.log('🔍 Successfully imported runSeleniumInboxExtraction (improved version)');

    console.log('🔍 About to call runSeleniumInboxExtraction...');
    const threads = await runSeleniumInboxExtraction();
    console.log('🔍 Selenium extraction completed, threads:', threads.length);

    const assignedCount = threads.filter((t) => t.status === 'assigned').length;
    const unassignedCount = threads.filter((t) => t.status === 'unassigned').length;
    console.log(`🔍 Assigned: ${assignedCount}, Unassigned: ${unassignedCount}`);

    return {
      success: true,
      data: threads,
    };
  } catch (error) {
    console.error('❌ Selenium inbox extraction failed:', error);
    console.error('❌ Error details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getThreadDetails(threadId: string) {
  return callNPIDTool('get_thread_details', { thread_id: threadId });
}

export async function getAssignmentModalData(contactid: string) {
  return callNPIDTool('get_assignment_modal_data', { contactid: contactid });
}

export async function assignThread(
  messageId: string,
  assignee = 'Jerami Singleton',
  status = 'INBOX',
  stage = 'Editing',
) {
  return callNPIDTool('assign_thread', {
    message_id: messageId,
    assignee,
    status,
    stage,
  });
}

// Player search via NPID MCP server (used by backfill tool)
export async function searchPlayer(query: string) {
  return callNPIDTool('search_player', { query });
}

export async function loginNPID(email: string, password: string) {
  return callNPIDTool('login_npid', { email, password });
}

// === ASANA FUNCTIONS (using official MCP server) ===

export async function createVideoTask(
  playerName: string,
  sport: string,
  classYear: string,
  playerId: string,
  message: string,
  videoLinks: string[],
) {
  // Use official Asana server with correct tool name and parameters
  return callAsanaTool('asana_create_task', {
    project_id: '1208992901563477', // ID Tasks project
    name: `${playerName}${sport ? ` - ${sport}` : ''}${classYear ? ` ${classYear}` : ''}`,
    notes: `Player ID: ${playerId || 'Unknown'}\n\nMessage: ${message || 'No message'}\n\nVideo Links:\n${videoLinks.join('\n') || 'None'}`,
    assignee: 'Jerami Singleton',
  });
}

export async function getVideoTasks(
  statusFilter?: string,
  stageFilter?: string,
  assigneeFilter = 'Jerami Singleton',
) {
  // Use official Asana server with search_tasks (no get_tasks available)
  return callAsanaTool('asana_search_tasks', {
    workspace: '1200890957583062', // Will need to get this dynamically
    assignee_any: assigneeFilter === 'Jerami Singleton' ? 'Jerami Singleton' : assigneeFilter,
  });
}

// === WORKSPACE AND PROJECT FUNCTIONS ===

export async function getAsanaWorkspaces() {
  return callAsanaTool('get_workspaces', {});
}

export async function getAsanaProjects(workspaceId?: string) {
  return callAsanaTool('get_projects', workspaceId ? { workspace: workspaceId } : {});
}

export async function updateAsanaTask(taskId: string, updates: Record<string, unknown>) {
  return callAsanaTool('update_task', { task_id: taskId, ...updates });
}
