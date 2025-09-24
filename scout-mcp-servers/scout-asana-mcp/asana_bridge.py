#!/usr/bin/env python3
"""
Simple HTTP bridge for Asana MCP server - for scout-singleton Raycast extension
"""
import http.server
import socketserver
import json
import subprocess
import os
import sys
from urllib.parse import urlparse, parse_qs

PORT = 8001

class MCPBridgeHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/mcp-call':
            self.handle_mcp_call()
        else:
            self.send_error(404)
    
    def handle_mcp_call(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            tool = data.get('tool')
            args = data.get('arguments', {})
            
            # Call the MCP server
            result = self.call_mcp_tool(tool, args)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'success': True,
                'data': result
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'success': False,
                'error': str(e)
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def call_mcp_tool(self, tool, args):
        """Call the MCP tool and return the result"""
        try:
            # Import the MCP server directly instead of subprocess
            import asana_server
            
            # Get the tool function from the server
            if hasattr(asana_server, tool):
                tool_func = getattr(asana_server, tool)
                
                # Call the tool function directly
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(tool_func(**args))
                    return result
                finally:
                    loop.close()
            else:
                raise Exception(f"Tool {tool} not found")
                
        except Exception as e:
            raise Exception(f"Error calling MCP tool: {str(e)}")
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == "__main__":
    print(f"🚀 Asana MCP Bridge running on http://localhost:{PORT}")
    print(f"🎯 Ready for scout-singleton Raycast extension calls")
    
    with socketserver.TCPServer(("", PORT), MCPBridgeHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Shutting down Asana MCP Bridge")
            httpd.shutdown()
