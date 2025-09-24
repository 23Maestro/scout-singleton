import { spawn } from 'node:child_process';
import path from 'node:path';

export interface InboxThread {
  id: string;
  name: string;
  sport?: string;
  class?: string;
  status: 'assigned' | 'unassigned';
  timestamp?: string;
  preview?: string;
}

export interface InboxResult {
  status: 'ok' | 'error';
  threads: InboxThread[];
  total: number;
  unread: number;
  source: string;
  error?: string;
  error_type?: string;
}

export interface SeleniumOptions {
  headless?: boolean;
  debug?: boolean;
  timeout?: number;
}

/**
 * Run the improved inbox scraper with better error handling
 */
export async function runInboxScraper(options: SeleniumOptions = {}): Promise<InboxResult> {
  const { headless = true, debug = false, timeout = 60000 } = options;

  return new Promise((resolve, reject) => {
    // Use the new improved scraper - use absolute path to avoid path resolution issues
    const scriptPath = '/Users/singleton23/Raycast/scout-singleton/scripts/inbox_scraper.py';

    const args = [scriptPath];
    if (headless) args.push('--headless');
    if (debug) args.push('--debug');

    console.log('🚀 Running inbox scraper with args:', args);

    // Use spawn for better streaming and error handling - use full path to Python
    const child = spawn('/Library/Frameworks/Python.framework/Versions/3.13/bin/python3', args, {
      env: {
        ...process.env,
        // Ensure Python unbuffered mode for real-time output
        PYTHONUNBUFFERED: '1',
        // Add common paths for Chrome/ChromeDriver
        PATH: [
          '/opt/homebrew/bin',
          '/usr/local/bin',
          '/Library/Frameworks/Python.framework/Versions/3.13/bin',
          process.env.PATH,
        ].join(':'),
      },
      cwd: path.join(__dirname, '..', '..'), // Project root
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000); // Force kill after 5s
    }, timeout);

    // Collect stdout
    child.stdout.on('data', (chunk) => {
      const data = chunk.toString();
      stdout += data;
      if (debug) {
        console.log('[PY STDOUT]', data.trim());
      }
    });

    // Stream stderr for debugging
    child.stderr.on('data', (chunk) => {
      const data = chunk.toString();
      stderr += data;
      console.error('[PY STDERR]', data.trim());
    });

    // Handle process exit
    child.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        return reject(new Error(`Python script timed out after ${timeout}ms`));
      }

      // Try to parse JSON output regardless of exit code
      try {
        const result = JSON.parse(stdout);

        // Add stderr to result if there was an error
        if (code !== 0 && stderr) {
          result.debug_stderr = stderr;
        }

        // Resolve with the parsed result
        resolve(result);
      } catch (parseError) {
        // If we can't parse JSON, create an error result
        const errorResult: InboxResult = {
          status: 'error',
          error: `Exit code ${code}. Failed to parse JSON: ${parseError}`,
          error_type: 'parse_error',
          threads: [],
          total: 0,
          unread: 0,
          source: 'selenium',
        };

        // Include raw output for debugging
        if (stdout) {
          console.error('Raw stdout:', stdout);
        }
        if (stderr) {
          errorResult.error += `\nStderr: ${stderr}`;
        }

        if (code === 0) {
          // If exit was successful but JSON parsing failed, reject
          reject(new Error(`Invalid JSON output: ${stdout}\nStderr: ${stderr}`));
        } else {
          // Return error result for non-zero exit codes
          resolve(errorResult);
        }
      }
    });

    // Handle spawn errors
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error('❌ Failed to spawn Python process:', error);

      const errorResult: InboxResult = {
        status: 'error',
        error: `Failed to start Python: ${error.message}`,
        error_type: 'spawn_error',
        threads: [],
        total: 0,
        unread: 0,
        source: 'selenium',
      };

      resolve(errorResult);
    });
  });
}

/**
 * Legacy function for backward compatibility
 */
export async function runSeleniumInboxExtraction(): Promise<InboxThread[]> {
  console.log('🚀 runSeleniumInboxExtraction called (using improved scraper)');

  try {
    const result = await runInboxScraper({ headless: true });

    if (result.status === 'error') {
      console.error('❌ Inbox scraper error:', result.error);
      throw new Error(result.error || 'Unknown scraper error');
    }

    console.log(`✅ Successfully extracted ${result.threads.length} threads`);
    return result.threads;
  } catch (error) {
    console.error('❌ Failed to run inbox scraper:', error);
    throw error;
  }
}

/**
 * Test function to verify Selenium setup
 */
export async function testSeleniumSetup(): Promise<boolean> {
  console.log('🧪 Testing Selenium setup...');

  try {
    const result = await runInboxScraper({
      headless: true,
      debug: true,
      timeout: 30000,
    });

    console.log('✅ Selenium test result:', {
      status: result.status,
      threadsFound: result.total,
      hasError: !!result.error,
    });

    return result.status === 'ok';
  } catch (error) {
    console.error('❌ Selenium test failed:', error);
    return false;
  }
}
