export interface SeleniumSearchResult {
  player_id?: string;
  athleteName?: string;
  sport?: string;
  gradYear?: string;
  city?: string;
  state?: string;
  highSchool?: string;
  positions?: string;
}

import { exec } from 'child_process';
import path from 'path';

export async function runSeleniumPlayerSearch(athleteName: string): Promise<SeleniumSearchResult[]> {
  console.log(`🚀 runSeleniumPlayerSearch called for: ${athleteName}`);
  
  return new Promise((resolve, reject) => {
    // Use absolute path like in the working v2 extension
    const scriptPath = '/Users/singleton23/Raycast/scout-singleton/scripts/search_player.py';
    console.log('🔍 Using Python script for player search:', scriptPath);

    const command = `python3 "${scriptPath}" --athlete_name "${athleteName}" --headless`;
    console.log('🔍 Command:', command);

    exec(
      command,
      {
        env: {
          ...process.env,
          PATH: '/Library/Frameworks/Python.framework/Versions/3.13/bin:/opt/homebrew/bin:' + process.env.PATH,
          CHROME_DRIVER_PATH: '/opt/homebrew/bin/chromedriver',
          DISPLAY: ':0',
          XDG_RUNTIME_DIR: '/tmp',
        },
        maxBuffer: 1024 * 1024, // 1MB buffer
        timeout: 60000, // 60 second timeout
        cwd: process.cwd(),
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Python script error:', error);
          console.error('❌ stderr:', stderr);
          reject(new Error(`Player search failed: ${error.message}`));
          return;
        }
        
        if (stderr && stderr.includes('Error')) {
          console.error('❌ Python script stderr:', stderr);
        }

        try {
          const output = stdout.trim();
          console.log('🔍 Raw output:', output);

          if (!output) {
            console.log('⚠️ No output from search script');
            resolve([]);
            return;
          }

          // Parse JSON output from Python script
          const results = JSON.parse(output);
          console.log(`✅ Found ${results.length} player(s)`);
          
          // Convert to SeleniumSearchResult format
          const searchResults: SeleniumSearchResult[] = results.map((result: any) => ({
            player_id: result.player_id,
            athleteName: result.athleteName,
            sport: result.sport,
            gradYear: result.gradYear,
            city: result.city,
            state: result.state,
            highSchool: result.highSchool,
            positions: result.positions,
          }));

          resolve(searchResults);
        } catch (parseError) {
          console.error('❌ JSON parse error:', parseError);
          console.error('❌ Raw output (first 500 chars):', stdout.substring(0, 500));
          reject(new Error(`Failed to parse search results: ${parseError}`));
        }
      },
    );
  });
}
