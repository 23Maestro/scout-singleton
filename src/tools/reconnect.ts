import { Tool, showToast, Toast } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const execAsync = promisify(exec);

type Input = {
  /** The method to use for token refresh */
  method: "manual" | "check";
};

export default async function (input: Input) {
  const { method } = input;
  
  try {
    switch (method) {
      case "manual":
        await executeManualTokenRefresh();
        break;
      case "check":
        // First check if tokens are expired, then refresh if needed
        const needsRefresh = await checkTokenStatus();
        if (needsRefresh) {
          await showToast({
            style: Toast.Style.Animated,
            title: "Tokens Expired",
            message: "Refreshing tokens automatically...",
          });
          await executeManualTokenRefresh();
        }
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Token Refresh Failed",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
    throw error;
  }
}

async function executeManualTokenRefresh() {
  await showToast({
    style: Toast.Style.Animated,
    title: "Refreshing Tokens",
    message: "Following your reliable manual method...",
  });

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔍 Attempt ${attempts}/${maxAttempts}`);

    try {
      // Step 1: Get fresh login token (EXACT from your guide line 13)
      console.log('🔍 Step 1: Getting fresh login token...');
      const { stdout: tokenOutput } = await execAsync(
        `curl -s -c cookies.txt 'https://dashboard.nationalpid.com/auth/login' | grep 'name="_token"' | sed 's/.*value="\\([^"]*\\)".*/\\1/'`
      );
      
      const token = tokenOutput.trim();
      if (!token || token.includes('var csrfToken') || token.length < 10) {
        throw new Error(`Failed to extract clean login token: "${token}"`);
      }

      console.log('🔍 Extracted token:', token.substring(0, 20) + '...');

      // Step 2: Login (EXACT from your guide lines 18-22)
      console.log('🔍 Step 2: Logging in...');
      const loginResult = await execAsync(
        `TOKEN="${token}" && curl -s -c cookies.txt -b cookies.txt -X POST 'https://dashboard.nationalpid.com/auth/login' -d "email=jsingleton@prospectid.com&password=YBh%40Y8Us%401%26qwd%24&_token=$TOKEN" -H 'Content-Type: application/x-www-form-urlencoded' -L > /dev/null`
      );

      // Step 3: Extract tokens (EXACT from your guide lines 26-27)
      console.log('🔍 Step 3: Extracting tokens...');
      const { stdout: xsrfToken } = await execAsync(`grep XSRF-TOKEN cookies.txt | cut -f7`);
      const { stdout: sessionCookie } = await execAsync(`grep myapp_session cookies.txt | cut -f7`);
      
      if (!xsrfToken.trim() || !sessionCookie.trim()) {
        throw new Error("Failed to extract XSRF token or session cookie");
      }

      // Step 4: Create token file (EXACT from your guide lines 29-37)
      console.log('🔍 Step 4: Creating token file...');
      const { stdout: refreshedAt } = await execAsync(`date -u +%Y-%m-%dT%H:%M:%S.000Z`);
      const { stdout: expiresAt } = await execAsync(`date -u -v+90M +%Y-%m-%dT%H:%M:%S.000Z`);
      
      const tokenData = {
        xsrf_token: xsrfToken.trim(),
        session_cookie: sessionCookie.trim(),
        form_token: xsrfToken.trim(),
        refreshed_at: refreshedAt.trim(),
        expires_at: expiresAt.trim()
      };

      await writeFile(
        "/Users/singleton23/Raycast/scout-singleton/state/npid_tokens.json",
        JSON.stringify(tokenData, null, 2)
      );

      // Step 5: Test the tokens (from your guide)
      console.log('🔍 Step 5: Testing tokens...');
      const { stdout: testOutput } = await execAsync(
        `curl -s 'https://dashboard.nationalpid.com/rulestemplates/template/videoteammessagelist?athleteid=&user_timezone=America/New_York&type=inbox&is_mobile=&filter_self=Me/Un&refresh=false&page_start_number=1&search_text=' -H 'Accept: text/html' -b "XSRF-TOKEN=${xsrfToken.trim()}; myapp_session=${sessionCookie.trim()}" | head -5`
      );

      if (testOutput.includes('<div class="ImageProfile"')) {
        // Clean up (from your guide)
        await execAsync("rm -f cookies.txt");

        await showToast({
          style: Toast.Style.Success,
          title: "Tokens Refreshed!",
          message: `Expires at ${new Date(expiresAt.trim()).toLocaleTimeString()}`,
        });

        console.log('🔍 Token refresh completed successfully');
        return; // Success!
      } else {
        throw new Error("Tokens don't work - still getting login page");
      }

    } catch (error) {
      console.log(`🔍 Attempt ${attempts} failed:`, error);
      
      // Clean up cookies on failure
      await execAsync("rm -f cookies.txt").catch(() => {});
      
      if (attempts >= maxAttempts) {
        throw new Error(`Token refresh failed after ${maxAttempts} attempts. Last error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}


async function checkTokenStatus(): Promise<boolean> {
  try {
    const tokenPath = "/Users/singleton23/Raycast/scout-singleton/state/npid_tokens.json";
    const tokenData = JSON.parse(await readFile(tokenPath, "utf-8"));
    
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const timeLeft = expiresAt.getTime() - now.getTime();
    
    // Test if tokens actually work by making a real API call
    const { stdout: testOutput } = await execAsync(
      `curl -s 'https://dashboard.nationalpid.com/rulestemplates/template/videoteammessagelist?athleteid=&user_timezone=America/New_York&type=inbox&is_mobile=&filter_self=Me/Un&refresh=false&page_start_number=1&search_text=' -H 'Accept: text/html' -b "XSRF-TOKEN=${tokenData.xsrf_token}; myapp_session=${tokenData.session_cookie}" | head -5`
    );

    // Check if we get login page (tokens expired) or actual data
    const isExpired = testOutput.includes('<title>National Prospect ID | Login</title>');
    const isWorking = testOutput.includes('<div class="ImageProfile"');

    if (isExpired) {
      console.log('🔍 Token check: EXPIRED - getting login page');
      return true; // Needs refresh
    } else if (isWorking) {
      const minutesLeft = Math.floor(timeLeft / (1000 * 60));
      console.log(`🔍 Token check: VALID - ${minutesLeft} minutes remaining`);
      await showToast({
        style: Toast.Style.Success,
        title: "Tokens Valid",
        message: `${minutesLeft} minutes remaining`,
      });
      return false; // No refresh needed
    } else {
      console.log('🔍 Token check: UNKNOWN - unexpected response');
      return true; // Needs refresh to be safe
    }
  } catch (error) {
    console.log('🔍 Token check: ERROR -', error);
    return true; // Needs refresh on error
  }
}

export const confirmation: Tool.Confirmation<Input> = async (input) => {
  // Return undefined to skip confirmation - allows for silent execution
  // This enables the AI to automatically refresh tokens without user interaction
  return undefined;
};
