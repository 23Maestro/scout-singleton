#!/usr/bin/env python3
"""
Simple Asana MCP Server - Handles Asana API calls for Raycast integration
"""
import os
import sys
import logging
import json
from datetime import datetime, timezone
import httpx
from mcp.server.fastmcp import FastMCP

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("scout-asana-server")

# Initialize MCP server
mcp = FastMCP("scout-asana")

# Configuration from environment variables
ASANA_ACCESS_TOKEN = os.environ.get("ASANA_ACCESS_TOKEN", "")

# === UTILITY FUNCTIONS ===

def get_asana_headers():
    """Get headers for Asana API requests"""
    return {
        "Authorization": f"Bearer {ASANA_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }

# === MCP TOOLS ===

@mcp.tool()
async def asana_list_workspaces(opt_fields: str = "gid,name") -> str:
    """List all available Asana workspaces."""
    logger.info(f"Fetching Asana workspaces with fields: {opt_fields}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://app.asana.com/api/1.0/workspaces",
                headers=get_asana_headers(),
                params={"opt_fields": opt_fields},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"✅ Found {len(data.get('data', []))} workspaces:\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        return f"❌ Asana API Error: {e.response.status_code} - Check authentication"
    except Exception as e:
        logger.error(f"Error fetching workspaces: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def asana_search_tasks(project_id: str = "", opt_fields: str = "gid,name,created_at,custom_fields") -> str:
    """Search for tasks in Asana project."""
    logger.info(f"Searching Asana tasks in project {project_id}")
    
    if not project_id.strip():
        return "❌ Error: Project ID is required for task search"
    
    try:
        params = {
            "opt_fields": opt_fields,
            "limit": 100
        }
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://app.asana.com/api/1.0/projects/{project_id}/tasks",
                headers=get_asana_headers(),
                params=params,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"✅ Found {len(data.get('data', []))} tasks:\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        return f"❌ Asana API Error: {e.response.status_code} - Check authentication"
    except Exception as e:
        logger.error(f"Error searching tasks: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def asana_create_task(project_id: str = "", name: str = "", notes: str = "", assignee: str = "") -> str:
    """Create a new task in Asana project."""
    logger.info(f"Creating Asana task: {name}")
    
    if not project_id.strip():
        return "❌ Error: Project ID is required"
    if not name.strip():
        return "❌ Error: Task name is required"
    
    try:
        task_data = {
            "name": name,
            "projects": [project_id]
        }
        
        if notes.strip():
            task_data["notes"] = notes
        if assignee.strip():
            task_data["assignee"] = assignee
            
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://app.asana.com/api/1.0/tasks",
                headers=get_asana_headers(),
                json=task_data,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"✅ Task created successfully:\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        return f"❌ Asana API Error: {e.response.status_code} - Task creation failed"
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def asana_update_task(task_id: str = "", custom_fields: str = "") -> str:
    """Update an existing Asana task with custom fields."""
    logger.info(f"Updating Asana task: {task_id}")
    
    if not task_id.strip():
        return "❌ Error: Task ID is required"
    
    try:
        # All Asana API requests must wrap data in a "data" object
        request_data = {"data": {}}
        
        if custom_fields.strip():
            try:
                custom_fields_dict = json.loads(custom_fields)
                # Asana expects custom_fields as simple key-value pairs: {"gid": "value"}
                # For text fields, the value is directly the string
                request_data["data"]["custom_fields"] = custom_fields_dict
                logger.info(f"Sending request_data: {request_data}")
            except json.JSONDecodeError:
                return f"❌ Error: Invalid JSON in custom_fields: {custom_fields}"
            
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"https://app.asana.com/api/1.0/tasks/{task_id}",
                headers=get_asana_headers(),
                json=request_data,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"✅ Task updated successfully:\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        error_response = e.response.text if hasattr(e.response, 'text') else str(e)
        return f"❌ Asana API Error: {e.response.status_code} - {error_response}"
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        return f"❌ Error: {str(e)}"

# === SERVER STARTUP ===
if __name__ == "__main__":
    logger.info("Starting Asana MCP server...")
    
    # Check for required environment variables
    if not ASANA_ACCESS_TOKEN:
        logger.warning("ASANA_ACCESS_TOKEN not set - authentication may fail")
    
    try:
        mcp.run(transport='stdio')
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
