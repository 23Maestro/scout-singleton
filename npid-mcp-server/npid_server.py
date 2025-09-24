#!/usr/bin/env python3
"""
NPID Video Team MCP Server - Video team inbox management and player assignment
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
logger = logging.getLogger("npid-server")

# Initialize MCP server - NO PROMPT PARAMETER!
mcp = FastMCP("npid")

# Configuration
NPID_BASE_URL = os.environ.get("NPID_BASE_URL", "https://dashboard.nationalpid.com")
NPID_XSRF_TOKEN = os.environ.get("NPID_XSRF_TOKEN", "")
NPID_SESSION = os.environ.get("NPID_SESSION", "")

# === UTILITY FUNCTIONS ===
def get_auth_headers():
    """Get authentication headers for NPID API calls."""
    return {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "application/json;charset=UTF-8",
        "DNT": "1",
        "Origin": NPID_BASE_URL,
        "Pragma": "no-cache",
        "Referer": f"{NPID_BASE_URL}/videoteammsg/videomailprogress",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "X-XSRF-TOKEN": NPID_XSRF_TOKEN,
        "sec-ch-ua": '"Not=A?Brand";v="24", "Chromium";v="140"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"'
    }

def get_cookies():
    """Get cookies for NPID authentication."""
    return f"myapp_session={NPID_SESSION}; XSRF-TOKEN={NPID_XSRF_TOKEN}"

# === MCP TOOLS ===

@mcp.tool()
async def get_inbox_threads(limit: str = "50") -> str:
    """Get video team inbox threads with email content and metadata."""
    logger.info(f"Fetching inbox threads with limit {limit}")
    
    try:
        limit_int = int(limit) if limit.strip() else 50
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NPID_BASE_URL}/videoteammsg/inbox",
                headers=get_auth_headers(),
                cookies={"myapp_session": NPID_SESSION, "XSRF-TOKEN": NPID_XSRF_TOKEN},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            # Limit results
            if isinstance(data, list):
                data = data[:limit_int]
            elif isinstance(data, dict) and "data" in data:
                data["data"] = data["data"][:limit_int]
            
            return f"✅ Inbox Threads:\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        return f"❌ API Error: {e.response.status_code} - Check authentication"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def get_thread_details(thread_id: str = "") -> str:
    """Get detailed thread information including email content and attachments."""
    if not thread_id.strip():
        return "❌ Error: Thread ID is required"
    
    logger.info(f"Fetching thread details for {thread_id}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NPID_BASE_URL}/videoteammsg/inbox/{thread_id}",
                headers=get_auth_headers(),
                cookies={"myapp_session": NPID_SESSION, "XSRF-TOKEN": NPID_XSRF_TOKEN},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"✅ Thread Details:\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        return f"❌ API Error: {e.response.status_code} - Thread not found or access denied"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def get_assignment_modal_data(thread_id: str = "") -> str:
    """Get assignment modal data including available editors, status and stage options."""
    if not thread_id.strip():
        return "❌ Error: Thread ID is required"
    
    logger.info(f"Fetching assignment modal data for {thread_id}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NPID_BASE_URL}/videoteammsg/inbox/{thread_id}/assignprefetch",
                headers=get_auth_headers(),
                cookies={"myapp_session": NPID_SESSION, "XSRF-TOKEN": NPID_XSRF_TOKEN},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"✅ Assignment Modal Data:\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        return f"❌ API Error: {e.response.status_code} - Could not fetch assignment data"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def assign_thread(thread_id: str = "", assignee: str = "Jerami Singleton", status: str = "INBOX", stage: str = "Editing") -> str:
    """Assign a thread to an editor with status and stage (locks player to assignee)."""
    if not thread_id.strip():
        return "❌ Error: Thread ID is required"
    
    logger.info(f"Assigning thread {thread_id} to {assignee} with status {status}, stage {stage}")
    
    try:
        assignment_data = {
            "thread_id": thread_id,
            "assignee": assignee,
            "status": status,
            "stage": stage,
            "_token": NPID_XSRF_TOKEN.replace("=", "").replace("%3D", "")
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NPID_BASE_URL}/videoteammsg/inbox/assign",
                headers=get_auth_headers(),
                cookies={"myapp_session": NPID_SESSION, "XSRF-TOKEN": NPID_XSRF_TOKEN},
                json=assignment_data,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"✅ Assignment Successful:\nThread {thread_id} assigned to {assignee}\nStatus: {status}, Stage: {stage}\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        return f"❌ Assignment Failed: {e.response.status_code} - Check permissions and data"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def search_player(query: str = "") -> str:
    """Search for players by name, email, or ID for assignment purposes."""
    if not query.strip():
        return "❌ Error: Search query is required"
    
    logger.info(f"Searching for player: {query}")
    
    try:
        search_params = {
            "first_name": "",
            "last_name": "",
            "email": "",
            "sport": "0",
            "states": "0",
            "athlete_school": "0",
            "editorassigneddatefrom": "",
            "editorassigneddateto": "",
            "grad_year": "",
            "select_club_sport": "",
            "select_club_state": "",
            "select_club_name": "",
            "video_editor": "",
            "video_progress": "",
            "video_progress_stage": "",
            "video_progress_status": "",
            "search": query
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NPID_BASE_URL}/videoteammsg/videoprogress",
                headers=get_auth_headers(),
                cookies={"myapp_session": NPID_SESSION, "XSRF-TOKEN": NPID_XSRF_TOKEN},
                params=search_params,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"🔍 Player Search Results for '{query}':\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        return f"❌ Search Failed: {e.response.status_code}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def get_my_assignments(assignee: str = "Jerami Singleton") -> str:
    """Get current assignments for a specific editor."""
    logger.info(f"Fetching assignments for {assignee}")
    
    try:
        params = {
            "first_name": "",
            "last_name": "",
            "email": "",
            "sport": "0",
            "states": "0",
            "athlete_school": "0",
            "editorassigneddatefrom": "",
            "editorassigneddateto": "",
            "grad_year": "",
            "select_club_sport": "",
            "select_club_state": "",
            "select_club_name": "",
            "video_editor": assignee,
            "video_progress": "",
            "video_progress_stage": "",
            "video_progress_status": ""
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NPID_BASE_URL}/videoteammsg/videoprogress",
                headers=get_auth_headers(),
                cookies={"myapp_session": NPID_SESSION, "XSRF-TOKEN": NPID_XSRF_TOKEN},
                params=params,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            return f"📊 My Assignments ({assignee}):\n{json.dumps(data, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        return f"❌ API Error: {e.response.status_code}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def check_inbox_updates() -> str:
    """Check for new inbox messages and return summary of unassigned items."""
    logger.info("Checking for inbox updates")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NPID_BASE_URL}/videoteammsg/inbox",
                headers=get_auth_headers(),
                cookies={"myapp_session": NPID_SESSION, "XSRF-TOKEN": NPID_XSRF_TOKEN},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            # Count unassigned items
            unassigned_count = 0
            recent_items = []
            
            if isinstance(data, list):
                for item in data:
                    if not item.get("assigned", False):
                        unassigned_count += 1
                        recent_items.append({
                            "id": item.get("id"),
                            "player_name": item.get("player_name"),
                            "sport": item.get("sport"),
                            "created_at": item.get("created_at")
                        })
            
            summary = {
                "unassigned_count": unassigned_count,
                "recent_unassigned": recent_items[:5],
                "last_checked": datetime.now(timezone.utc).isoformat()
            }
            
            return f"⏱️ Inbox Update Check:\n{json.dumps(summary, indent=2)}"
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e.response.status_code}")
        return f"❌ Update Check Failed: {e.response.status_code}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

# === SERVER STARTUP ===
if __name__ == "__main__":
    logger.info("Starting NPID Video Team MCP server...")
    
    # Add startup checks
    if not NPID_XSRF_TOKEN:
        logger.warning("NPID_XSRF_TOKEN not set - authentication may fail")
    if not NPID_SESSION:
        logger.warning("NPID_SESSION not set - authentication may fail")
    
    try:
        mcp.run(transport='stdio')
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
