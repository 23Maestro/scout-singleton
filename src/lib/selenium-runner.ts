import { spawn } from "child_process";
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
  positions?: string;
}

export async function runSeleniumPlayerSearch(athleteName: string): Promise<SeleniumSearchResult[]> {
  return new Promise((resolve, reject) => {
    // Path to the Python script in the scripts directory
    const scriptPath = path.join(__dirname, "..", "..", "scripts", "player_lookup.py");
    
    const pythonProcess = spawn("python3", [scriptPath, athleteName], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Selenium script failed: ${errorOutput}`));
        return;
      }

      try {
        // Parse the JSON output from the Python script
        const results = JSON.parse(output);
        
        // Map the results to our interface
        const mappedResults: SeleniumSearchResult[] = results.map((result: any) => ({
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

        resolve(mappedResults);
      } catch (error) {
        reject(new Error(`Failed to parse Selenium script output: ${error}`));
      }
    });

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to start Selenium script: ${error.message}`));
    });
  });
}

export async function runSeleniumNonHeadless(athleteName: string): Promise<SeleniumSearchResult[]> {
  // This runs the selenium script in non-headless mode for manual intervention
  return runSeleniumPlayerSearch(athleteName);
}
