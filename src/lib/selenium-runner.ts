import { exec } from "child_process";
import path from "path";

export interface SeleniumSearchResult {
  playerId?: string;
  profileUrl?: string;
  athleteName?: string;
  sport?: string;
  gradYear?: string;
  city?: string;
  state?: string;
  highSchool?: string;
  positions?: string[];
}

interface PythonSearchResult {
  player_id?: string;
  profile_url?: string;
  athlete_name?: string;
  name?: string;
  sport?: string;
  grad_year?: string;
  class_of?: string;
  city?: string;
  state?: string;
  high_school?: string;
  positions?: string[];
}

export async function runSeleniumPlayerSearch(athleteName: string): Promise<SeleniumSearchResult[]> {
  return new Promise((resolve, reject) => {
    // Use relative path to the Python script from the project root
    const scriptPath = path.join(__dirname, "..", "..", "scripts", "extract_video_progress.py");
    
    const command = `"/Library/Frameworks/Python.framework/Versions/3.13/bin/python3" "${scriptPath}" --athlete_name "${athleteName}"`;
    console.log("🔍 Player search command:", command);
    
    exec(command, {
      env: {
        ...process.env,
        PATH: "/Library/Frameworks/Python.framework/Versions/3.13/bin:" + process.env.PATH,
        PYTHON_PATH: "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
      }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Python player search error:", error);
        reject(new Error(`Python player search failed: ${error.message}`));
        return;
      }
      
      if (stderr) {
        console.error("❌ Python player search stderr:", stderr);
      }
      
      try {
        const results = JSON.parse(stdout);
        
        // Map the results to our interface
        const mappedResults: SeleniumSearchResult[] = results.map((result: PythonSearchResult) => ({
          playerId: result.player_id,
          profileUrl: result.profile_url,
          athleteName: result.athlete_name || result.name,
          sport: result.sport,
          gradYear: result.grad_year || result.class_of,
          city: result.city,
          state: result.state,
          highSchool: result.high_school,
          positions: result.positions,
        }));

        console.log("✅ Python player search success, parsed", mappedResults.length, "results");
        resolve(mappedResults);
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        console.error("❌ Raw output:", stdout);
        reject(new Error(`Failed to parse JSON output: ${parseError}`));
      }
    });
  });
}

export async function runSeleniumNonHeadless(athleteName: string): Promise<SeleniumSearchResult[]> {
  // This runs the selenium script in non-headless mode for manual intervention
  return runSeleniumPlayerSearch(athleteName);
}

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
  console.log("🚀 runSeleniumInboxExtraction called!");
  return new Promise((resolve, reject) => {
    // Use the inbox extraction script
    // Use absolute path to the correct inbox extraction script
    const scriptPath = "/Users/singleton23/Raycast/scout-singleton/scripts/extract_inbox_data_fixed.py";
    console.log("🔍 Using inbox extraction script:", scriptPath);
    console.log("🔍 Python path: python3 (system default)");
    
    const command = `python3 "${scriptPath}" --headless`;
    console.log("🔍 Command:", command);
    
    exec(command, {
      env: {
        ...process.env,
        PATH: "/Library/Frameworks/Python.framework/Versions/3.13/bin:" + process.env.PATH,
        PYTHON_PATH: "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
      }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Python script error:", error);
        reject(new Error(`Python script failed: ${error.message}`));
        return;
      }
      
      if (stderr) {
        console.error("❌ Python script stderr:", stderr);
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log("✅ Python script success, parsed", result.length, "threads");
        resolve(result);
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        console.error("❌ Raw output:", stdout);
        reject(new Error(`Failed to parse JSON output: ${parseError}`));
      }
    });
  });
}

