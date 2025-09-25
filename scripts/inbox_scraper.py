#!/usr/bin/python3
"""
NPID Inbox Scraper with improved error handling and logging
Based on the architecture analysis for better Selenium integration
"""
import sys
import json
import traceback
import time
import argparse
import os
import tempfile
import shutil
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# NPID Inbox URL
INBOX_URL = "https://dashboard.nationalpid.com/admin/videomailbox"

def build_driver(headless=True, debug=False):
    """Build Chrome driver with robust configuration"""
    opts = Options()
    
    if headless:
        # Use new headless mode for better compatibility
        opts.add_argument("--headless=new")
    
    # Essential flags for stability
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,800")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    
    # Use a persistent profile to maintain the login session
    profile_dir = os.path.expanduser("~/selenium_chrome_profile_scout")
    opts.add_argument(f"--user-data-dir={profile_dir}")
    
    # Create directory if it doesn't exist
    os.makedirs(profile_dir, exist_ok=True)
    
    # Suppress logs unless debugging
    if not debug:
        opts.add_argument("--disable-logging")
        opts.add_argument("--log-level=3")
        opts.add_experimental_option('excludeSwitches', ['enable-logging'])
    
    # Check for Chrome binary on macOS
    chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
    
    for chrome_path in chrome_paths:
        if os.path.exists(chrome_path):
            opts.binary_location = chrome_path
            break
    else:
        # Check if Chrome is in PATH
        if shutil.which("google-chrome") is None and shutil.which("chrome") is None:
            raise RuntimeError(
                "Chrome not found. Please install Google Chrome or set CHROME_PATH environment variable"
            )
    
    # Try to use existing chromedriver first, fall back to webdriver-manager
    chromedriver_paths = [
        "/opt/homebrew/bin/chromedriver",  # Homebrew M1
        "/usr/local/bin/chromedriver",      # Homebrew Intel
        "/usr/bin/chromedriver",            # System
    ]
    
    chromedriver_path = None
    for path in chromedriver_paths:
        if os.path.exists(path):
            chromedriver_path = path
            if debug:
                print(f"Found chromedriver at: {path}", file=sys.stderr)
            break
    
    if chromedriver_path:
        service = Service(executable_path=chromedriver_path)
    else:
        # Fall back to webdriver-manager
        import platform
        if platform.machine() == "arm64" and platform.system() == "Darwin":
            os.environ['WDM_ARCHITECTURE'] = 'arm64'
        
        service = Service(ChromeDriverManager().install())
    
    try:
        driver = webdriver.Chrome(service=service, options=opts)
        
        # Log versions for debugging
        if debug:
            print(f"Selenium version: {webdriver.__version__}", file=sys.stderr)
            browser_version = driver.capabilities.get('browserVersion', 'Unknown')
            print(f"Chrome version: {browser_version}", file=sys.stderr)
            driver_version = driver.capabilities.get('chrome', {}).get('chromedriverVersion', 'Unknown')
            print(f"ChromeDriver version: {driver_version}", file=sys.stderr)
            print(f"Using profile: {profile_dir}", file=sys.stderr)
        
        return driver, profile_dir
    except Exception as e:
        # Don't clean up persistent profile on failure
        raise

def wait_for_login_if_needed(driver, wait, debug=False):
    """Check if login is required and handle it"""
    try:
        # Check if we're on a login page
        if "login" in driver.current_url.lower() or "sign" in driver.current_url.lower():
            if debug:
                print("Login page detected", file=sys.stderr)
            
            # Look for common login form elements
            login_indicators = [
                (By.ID, "email"),
                (By.NAME, "email"),
                (By.ID, "username"),
                (By.NAME, "username"),
                (By.CSS_SELECTOR, "input[type='email']"),
                (By.CSS_SELECTOR, "input[type='password']"),
            ]
            
            for by, value in login_indicators:
                try:
                    wait.until(EC.presence_of_element_located((by, value)))
                    raise RuntimeError(
                        "Login required. Please run without --headless to login first, "
                        "or ensure valid session cookies are available"
                    )
                except TimeoutException:
                    continue
    except Exception as e:
        if "Login required" in str(e):
            raise
        # Not a login page, continue

def fetch_inbox_items(driver, debug=False):
    """Extract inbox data with explicit waits and better error handling"""
    wait = WebDriverWait(driver, 20)
    
    try:
        # Navigate to inbox
        driver.get(INBOX_URL)
        
        # Wait for page to load
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        
        # Check for login requirement
        wait_for_login_if_needed(driver, wait, debug)
        
        # Wait for inbox content with correct selector
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#inbox_tab div[id^='message_id']")))
        
        if debug:
            print("Inbox loaded successfully", file=sys.stderr)
        
        # Extract thread data
        inbox_items = []
        unread_count = 0
        
        # Find all message elements with correct selector
        message_elements = driver.find_elements(By.CSS_SELECTOR, "#inbox_tab div[id^='message_id']")
        
        if debug:
            print(f"Found {len(message_elements)} message elements", file=sys.stderr)
        
        for i, message_element in enumerate(message_elements[:50]):  # Limit to 50 messages
            try:
                # Extract message ID from the element's ID
                message_id = message_element.get_attribute("id").replace("message_id", "")
                
                # Get thread text content
                thread_text = message_element.text.strip()
                lines = thread_text.split('\n') if thread_text else []
                
                # Extract sender name (first line, limited to 50 chars)
                sender_name = lines[0][:50].strip() if lines else f'Message {i+1}'
                
                # Extract subject from second line if available
                subject = lines[1].strip() if len(lines) > 1 else ""
                
                # Extract timestamp from third line if available
                timestamp = lines[2].strip() if len(lines) > 2 else ""
                
                # Extract content from the message
                content = ""
                if len(lines) > 3:
                    # Join all lines after the first 3 (name, subject, timestamp) as content
                    content = '\n'.join(lines[3:]).strip()
                
                # Detect if this is a reply with your signature
                is_reply_with_signature = False
                signature_indicators = [
                    "Jerami Singleton",
                    "Content Creator at Prospect ID",
                    "Phone (407) 473-3637",
                    "Email videoteam@prospectid.com",
                    "Web www.nationalpid.com",
                    "---- On",
                    "wrote: ----"
                ]
                
                if any(indicator in content for indicator in signature_indicators):
                    is_reply_with_signature = True
                    # Extract only the new message part (before your signature)
                    signature_start = content.find("---- On")
                    if signature_start != -1:
                        content = content[:signature_start].strip()
                
                # Try to extract hidden email elements using JavaScript
                try:
                    # Execute JavaScript to get hidden email elements
                    hidden_email = driver.execute_script("""
                        var element = arguments[0];
                        var emailSelectors = [
                            'input[type="email"]',
                            'input[name*="email"]',
                            'input[id*="email"]',
                            '.email',
                            '[data-email]',
                            'span[title*="@"]',
                            'a[href^="mailto:"]'
                        ];
                        
                        for (var i = 0; i < emailSelectors.length; i++) {
                            var emailEl = element.querySelector(emailSelectors[i]);
                            if (emailEl) {
                                return emailEl.value || emailEl.textContent || emailEl.getAttribute('title') || emailEl.getAttribute('href')?.replace('mailto:', '');
                            }
                        }
                        
                        // Look for email patterns in hidden attributes
                        var allElements = element.querySelectorAll('*');
                        for (var j = 0; j < allElements.length; j++) {
                            var el = allElements[j];
                            var attrs = ['data-email', 'data-sender', 'data-from', 'title', 'aria-label'];
                            for (var k = 0; k < attrs.length; k++) {
                                var attr = el.getAttribute(attrs[k]);
                                if (attr && attr.includes('@')) {
                                    return attr;
                                }
                            }
                        }
                        
                        return null;
                    """, message_element)
                    
                    if hidden_email and '@' in hidden_email:
                        # Use the extracted email as the sender name if it's more reliable
                        if not sender_name or sender_name == f'Message {i+1}':
                            sender_name = hidden_email
                        
                except Exception as e:
                    if debug:
                        print(f"Could not extract hidden email for message {i}: {e}", file=sys.stderr)
                
                # Try to extract contact ID from element attributes
                contact_id = ""
                try:
                    # Look for contact ID in various attributes
                    contact_attrs = ['data-contact-id', 'data-contactid', 'data-player-id', 'data-playerid']
                    for attr in contact_attrs:
                        contact_id = message_element.get_attribute(attr)
                        if contact_id:
                            break
                    
                    # If not found in attributes, try JavaScript
                    if not contact_id:
                        contact_id = driver.execute_script("""
                            var element = arguments[0];
                            var contactSelectors = [
                                '[data-contact-id]',
                                '[data-contactid]',
                                '[data-player-id]',
                                '[data-playerid]',
                                '.contact-id',
                                '.player-id'
                            ];
                            
                            for (var i = 0; i < contactSelectors.length; i++) {
                                var el = element.querySelector(contactSelectors[i]);
                                if (el) {
                                    return el.textContent || el.getAttribute('data-contact-id') || el.getAttribute('data-contactid') || el.getAttribute('data-player-id') || el.getAttribute('data-playerid');
                                }
                            }
                            return null;
                        """, message_element)
                        
                except Exception as e:
                    if debug:
                        print(f"Could not extract contact ID for message {i}: {e}", file=sys.stderr)
                
                # Check assignment status - look for assign button
                is_assigned = True
                try:
                    message_element.find_element(By.CSS_SELECTOR, ".assign_video_team")
                    is_assigned = False  # Has assign button = unassigned
                except NoSuchElementException:
                    is_assigned = True   # No assign button = assigned
                
                # If not assigned, increment unread count
                if not is_assigned:
                    unread_count += 1
                
                # Build message data
                message_data = {
                    "id": message_id,
                    "thread_id": f"thread-{message_id}",
                    "player_id": f"pid-{message_id}",
                    "contactid": contact_id or f"contact-{message_id}",
                    "name": sender_name,
                    "email": hidden_email or sender_name,  # Use extracted email if available
                    "subject": subject,
                    "content": content,
                    "status": "assigned" if is_assigned else "unassigned",
                    "timestamp": timestamp,
                    "is_reply_with_signature": is_reply_with_signature,
                    "preview": thread_text[:100] + "..." if len(thread_text) > 100 else thread_text
                }
                
                inbox_items.append(message_data)
                
            except Exception as e:
                if debug:
                    print(f"Error processing message {i}: {e}", file=sys.stderr)
                continue
        
        return {
            "status": "ok",
            "threads": inbox_items,
            "total": len(inbox_items),
            "unread": unread_count,
            "source": "selenium"
        }
        
    except Exception as e:
        error_msg = str(e)
        if "login" in error_msg.lower():
            error_type = "auth_required"
        elif "timeout" in error_msg.lower():
            error_type = "timeout"
        else:
            error_type = "unknown"
        
        return {
            "status": "error",
            "error": error_msg,
            "error_type": error_type,
            "threads": [],
            "total": 0,
            "unread": 0,
            "source": "selenium"
        }

def main():
    """Main entry point with proper error handling"""
    parser = argparse.ArgumentParser(description='Extract NPID inbox data with improved error handling')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging to stderr')
    args = parser.parse_args()
    
    driver = None
    profile_dir = None
    
    try:
        # Build driver
        driver, profile_dir = build_driver(headless=args.headless, debug=args.debug)
        
        # Fetch inbox data
        result = fetch_inbox_items(driver, debug=args.debug)
        
        # Output JSON result to stdout
        print(json.dumps(result))
        sys.stdout.flush()
        
        # Exit with appropriate code
        sys.exit(0 if result["status"] == "ok" else 1)
        
    except Exception as e:
        # Print full traceback to stderr for debugging
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        
        # Output error JSON to stdout for parsing
        error_result = {
            "status": "error",
            "error": str(e),
            "error_type": "driver_init" if driver is None else "runtime",
            "threads": [],
            "total": 0,
            "unread": 0,
            "source": "selenium"
        }
        print(json.dumps(error_result))
        sys.stdout.flush()
        
        sys.exit(1)
        
    finally:
        # Clean up
        if driver:
            try:
                driver.quit()
            except:
                pass
        
        # We are using a persistent profile, so we do not clean it up.
        pass

if __name__ == "__main__":
    main()
