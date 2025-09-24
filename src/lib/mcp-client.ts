import { showToast, Toast } from '@raycast/api';

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface MCPToolCall {
  tool: string;
  arguments: Record<string, any>;
}

export class MCPClient {
  private serverUrl: string;
  private serverName: string;

  constructor(config: { serverUrl: string; serverName: string }) {
    this.serverUrl = config.serverUrl;
    this.serverName = config.serverName;
  }

  /**
   * Call an MCP tool with the given arguments
   */
  async callTool(tool: string, args: Record<string, any> = {}): Promise<MCPResponse> {
    try {
      const response = await fetch(`${this.serverUrl}/mcp-call`, {
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error(`MCP ${this.serverName} Error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Call an MCP tool with error handling and user feedback
   */
  async callToolWithFeedback(
    tool: string,
    args: Record<string, any> = {},
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

    const result = await this.callTool(tool, args);

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

  /**
   * Get available tools from the MCP server
   */
  async getAvailableTools(): Promise<string[]> {
    try {
      const response = await fetch(`${this.serverUrl}/tools/list`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.tools || [];
    } catch (error) {
      console.error(`Error getting tools from ${this.serverName}:`, error);
      return [];
    }
  }

  /**
   * Check if the MCP server is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      });
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${this.serverName}:`, error);
      return false;
    }
  }
}

// Pre-configured MCP clients for your services
export const npidMCPClient = new MCPClient({
  serverUrl: 'http://localhost:8000', // Adjust based on your setup
  serverName: 'scout-npid',
});

export const asanaMCPClient = new MCPClient({
  serverUrl: 'http://localhost:8001', // Adjust based on your setup
  serverName: 'scout-asana',
});

// Utility function to call NPID tools
export async function callNPIDTool(
  tool: string,
  args: Record<string, any> = {},
): Promise<MCPResponse> {
  return npidMCPClient.callTool(tool, args);
}

// Utility function to call Asana tools
export async function callAsanaTool(
  tool: string,
  args: Record<string, any> = {},
): Promise<MCPResponse> {
  return asanaMCPClient.callTool(tool, args);
}
