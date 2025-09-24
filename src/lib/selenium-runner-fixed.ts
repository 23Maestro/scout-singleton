import { exec } from "child_process";
import path from "path";

export interface InboxThread {
  thread_id: string;
  message_id: string;
  player_id: string;
  subject: string;
  player_name: string;
  email: string;
  content: string;
  contactid: string;
  is_assigned: boolean;
  assigned_to: string | null;
  received_at: string;
  created_at: string;
}

export async function runSeleniumInboxExtraction(): Promise<InboxThread[]> {
  console.log("🚀 runSeleniumInboxExtraction called with MEMORY-OPTIMIZED version!");
  return new Promise((resolve, reject) => {
    const scriptPath = "/Users/singleton23/Raycast/scout-singleton/scripts/extract_inbox_data_minimal.py";
    console.log("🔍 Using memory-optimized minimal version to prevent Node.js OOM");
    
    const command = `python3 "${scriptPath}" --headless`;
    console.log("🔍 Command:", command);
    
    exec(command, {
      env: {
        ...process.env,
        PATH: "/Library/Frameworks/Python.framework/Versions/3.13/bin:/opt/homebrew/bin:" + process.env.PATH,
        CHROME_DRIVER_PATH: "/opt/homebrew/bin/chromedriver",
        DISPLAY: ":0",
        XDG_RUNTIME_DIR: "/tmp"
      },
      maxBuffer: 1024 * 512, // Reduced buffer size (512KB vs 10MB)
      timeout: 60000, // Reduced timeout (60s vs 120s)
      cwd: "/Users/singleton23/Raycast/scout-singleton"
    }, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Python script error:", error);
        console.error("❌ stderr:", stderr);
        reject(new Error(`Python script failed: ${error.message}`));
        return;
      }      
      if (stderr && stderr.includes("Error")) {
        console.error("❌ Python script stderr:", stderr);
      }
      
      try {
        const output = stdout.trim();
        console.log("🔍 Raw output length:", output.length);
        
        // Handle the minimal API response format
        let result;
        if (output.startsWith('{')) {
          // Handle {threads: [...], total: X, unread: Y} format
          const parsed = JSON.parse(output);
          result = parsed.threads || [];
          console.log(`✅ Minimal API success: ${result.length} threads, ${parsed.unread} unread`);
        } else {
          throw new Error("Unexpected output format");
        }
        
        // Transform minimal data to match expected format
        const transformedResult = result.map((thread: any, index: number) => ({
          thread_id: `thread-${thread.id}`,
          message_id: thread.id,
          player_id: `player-${thread.id}`,
          subject: "Video Request",
          player_name: thread.name || `Thread ${index + 1}`,
          email: `${thread.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
          content: `Thread from ${thread.name}`,
          contactid: `contact-${thread.id}`,
          is_assigned: thread.status === "assigned",
          assigned_to: thread.status === "assigned" ? "Jerami Singleton" : null,
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }));
        
        resolve(transformedResult);
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        console.error("❌ Raw output (first 500 chars):", output.substring(0, 500));
        reject(new Error(`Failed to parse JSON output: ${parseError}`));
      }
    });
  });
}
