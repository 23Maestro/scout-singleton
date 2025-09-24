#!/usr/bin/env python3
"""
Fixed NPID Inbox Extraction Script for Raycast Integration
- Fixed Chrome driver initialization
- Better error handling for Raycast execution
- Improved timeout handling
- Debug logging for troubleshooting
"""

import time
import argparse
import os
import sys
import json
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# NPID Inbox URL
INBOX_URL = "https://dashboard.nationalpid.com/admin/videomailbox"

def debug_log(message):
    """Print debug message with timestamp"""
    print(f"[{time.strftime('%H:%M:%S')}] {message}", file=sys.stderr)

def extract_inbox_data(driver):
    """Extract inbox thread data from NPID with improved error handling"""
    debug_log("Starting inbox data extraction from NPID")
    wait = WebDriverWait(driver, 30)
    
    try:
        # Navigate to inbox page
        debug_log(f"Navigating to: {INBOX_URL}")
        driver.get(INBOX_URL)
        
        # Wait for page load with better detection
        debug_log("Waiting for page to load...")
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        
        # Additional wait for dynamic content - longer in headless mode
        time.sleep(10)
        debug_log("Page loaded successfully")
        
        # Wait for any loading indicators to disappear
        try:
            wait.until_not(EC.presence_of_element_located((By.CSS_SELECTOR, ".loading, .spinner, [class*='loading']")))
            debug_log("Loading indicators cleared")
        except TimeoutException:
            debug_log("No loading indicators found or timeout waiting for them")
        
        # Verify we're on the correct page
        if "videomailbox" not in driver.current_url.lower():
            debug_log(f"WARNING: Unexpected URL: {driver.current_url}")
            return []
        
        # Look for thread elements with multiple selector strategies
        thread_selectors = [
            "[id^='message_id']",
            ".message-thread",
            "[data-message-id]",
            ".inbox-item",
            "div[onclick*='message']",
            "tr[onclick*='message']",
            ".thread-item",
            "[class*='message']",
            "[class*='thread']"
        ]
        
        thread_elements = []
        for selector in thread_selectors:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            if elements:
                thread_elements = elements
                debug_log(f"Found {len(elements)} threads using selector: {selector}")
                break
        
        if not thread_elements:
            debug_log("No thread elements found with any selector")
            # Enhanced fallback: look for any clickable inbox items
            fallback_selectors = [
                "//div[contains(@class, 'inbox') or contains(@id, 'message')]",
                "//tr[contains(@class, 'inbox') or contains(@id, 'message')]",
                "//div[contains(@onclick, 'message')]",
                "//tr[contains(@onclick, 'message')]",
                "//*[contains(@class, 'row') and contains(@onclick, 'message')]"
            ]
            
            for xpath in fallback_selectors:
                elements = driver.find_elements(By.XPATH, xpath)
                if elements:
                    thread_elements = elements
                    debug_log(f"Fallback search found {len(elements)} elements using XPath: {xpath}")
                    break
            
            if not thread_elements:
                debug_log("No elements found with any fallback selector")
        
        # Extract thread data
        all_threads = []
        for i, thread_element in enumerate(thread_elements[:24]):  # Limit to 24 for testing
            try:
                # Get basic identifiers
                thread_id = thread_element.get_attribute("id") or f"thread-{i}"
                message_id = thread_id.replace("message_id", "") if "message_id" in thread_id else str(i)
                
                # Get all text content
                thread_text = thread_element.text.strip()
                if not thread_text:
                    continue
                
                # Extract email - prioritize non-videoteam emails
                email_matches = re.findall(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', thread_text)
                
                # Filter out videoteam emails and find the actual sender
                sender_emails = [email for email in email_matches if 'videoteam@prospectid.com' not in email.lower()]
                
                if sender_emails:
                    # Use the first non-videoteam email found
                    email = sender_emails[0]
                elif email_matches:
                    # Fallback to any email if no non-videoteam emails found
                    email = email_matches[0]
                else:
                    email = f"unknown{i}@example.com"
                
                # Extract name (first line or first word sequence)
                lines = thread_text.split('\n')
                name_candidate = lines[0].strip() if lines else ""
                
                # Clean up name (remove dates, emails, etc.)
                name_match = re.search(r'^([A-Za-z\s]+)', name_candidate)
                player_name = name_match.group(1).strip() if name_match else f"Player {i+1}"
                
                # Remove common non-name patterns
                if any(pattern in player_name.lower() for pattern in ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'subject:', 're:']):
                    player_name = f"Player {i+1}"
                
                # Extract subject/topic
                subject_match = re.search(r'(Re: [^\n]+)', thread_text, re.IGNORECASE)
                subject = subject_match.group(1) if subject_match else "Video Request"
                
                # Extract date information
                date_match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+', thread_text)
                date = date_match.group(0) if date_match else ""
                
                # Determine assignment status (multiple methods)
                is_assigned = False  # Default to unassigned (more likely for inbox)
                
                # Method 1: Look for assign button (primary indicator)
                try:
                    assign_button = thread_element.find_element(By.CSS_SELECTOR, "#assignvideoteam, .assign-btn, [onclick*='assign'], button[onclick*='assign']")
                    is_assigned = False  # Has assign button = unassigned
                    debug_log(f"Thread {i+1}: UNASSIGNED (has assign button)")
                except NoSuchElementException:
                    # Method 2: Look for assigned indicator text
                    if "assigned to" in thread_text.lower() or "owner:" in thread_text.lower() or "jerami" in thread_text.lower():
                        is_assigned = True
                        debug_log(f"Thread {i+1}: ASSIGNED (has assignment text)")
                    else:
                        # Method 3: Look for "Assign" text in the element
                        if "assign" in thread_text.lower() and "video" in thread_text.lower():
                            is_assigned = False
                            debug_log(f"Thread {i+1}: UNASSIGNED (has assign text)")
                        else:
                            # Default to unassigned if unclear
                            is_assigned = False
                            debug_log(f"Thread {i+1}: UNASSIGNED (default - no clear assignment)")
                
                # Create thread data structure
                thread_data = {
                    "thread_id": f"thread-{message_id}",
                    "message_id": message_id,
                    "player_id": f"pid-{message_id}",
                    "subject": subject,
                    "player_name": player_name,
                    "email": email,
                    "content": thread_text[:500],  # First 500 characters
                    "contactid": f"contact-{message_id}",
                    "is_assigned": is_assigned,
                    "assigned_to": "Jerami Singleton" if is_assigned else None,
                    "received_at": date,
                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
                }
                
                all_threads.append(thread_data)
                debug_log(f"✅ Thread {i+1}: {player_name} - {'ASSIGNED' if is_assigned else 'UNASSIGNED'}")
                
            except Exception as e:
                debug_log(f"❌ Error processing thread {i+1}: {e}")
                continue
        
        # Summary
        assigned_count = sum(1 for t in all_threads if t["is_assigned"])
        unassigned_count = len(all_threads) - assigned_count
        
        debug_log(f"Extraction complete: {len(all_threads)} total, {assigned_count} assigned, {unassigned_count} unassigned")
        
        return all_threads
        
    except Exception as e:
        debug_log(f"❌ Critical error in extraction: {e}")
        return []

def setup_chrome_driver(headless=True):
    """Setup Chrome driver with robust configuration"""
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.chrome.options import Options
    import tempfile
    import shutil

    debug_log("Setting up Chrome driver...")
    
    options = Options()
    
    # Create a unique profile directory to avoid locks
    import tempfile
    user_data_dir = tempfile.mkdtemp(prefix="selenium_chrome_profile_raycast_")
    debug_log(f"Created unique profile directory: {user_data_dir}")
    
    # Copy only the essential authentication files from the original profile
    base_profile = os.path.expanduser("~/selenium_chrome_profile")
    if os.path.exists(base_profile):
        debug_log(f"Copying authentication files from: {base_profile}")
        try:
            # Create Default directory first
            default_dir = os.path.join(user_data_dir, "Default")
            os.makedirs(default_dir, exist_ok=True)
            
            # Copy only the essential files for authentication
            essential_files = [
                "Cookies", "Login Data", "Local State", "Preferences", 
                "Secure Preferences", "Web Data"
            ]
            
            # Copy root-level files
            for file_name in essential_files:
                src_path = os.path.join(base_profile, file_name)
                if os.path.exists(src_path):
                    dst_path = os.path.join(user_data_dir, file_name)
                    try:
                        shutil.copy2(src_path, dst_path)
                        debug_log(f"Copied: {file_name}")
                    except Exception as e:
                        debug_log(f"Skipped {file_name}: {e}")
            
            # Copy Default directory files
            default_files = ["Preferences", "Cookies", "Login Data", "Web Data"]
            for file_name in default_files:
                src_path = os.path.join(base_profile, "Default", file_name)
                if os.path.exists(src_path):
                    dst_path = os.path.join(default_dir, file_name)
                    try:
                        shutil.copy2(src_path, dst_path)
                        debug_log(f"Copied: Default/{file_name}")
                    except Exception as e:
                        debug_log(f"Skipped Default/{file_name}: {e}")
            
            debug_log("Authentication files copied successfully")
        except Exception as e:
            debug_log(f"Failed to copy authentication files: {e}")
    else:
        debug_log("No base profile found, using fresh profile")
    
    debug_log(f"Using profile directory: {user_data_dir}")
    
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-web-security")
    options.add_argument("--allow-running-insecure-content")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--disable-features=VizDisplayCompositor")
    
    if headless:
        options.add_argument('--headless')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-web-security')
        options.add_argument('--disable-features=VizDisplayCompositor')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        debug_log("Running in HEADLESS mode")
    else:
        options.add_argument("--start-maximized")
        debug_log("Running in VISIBLE mode")
    
    # Chrome driver path
    chromedriver_path = "/opt/homebrew/bin/chromedriver"
    
    if not os.path.exists(chromedriver_path):
        raise FileNotFoundError(f"ChromeDriver not found at {chromedriver_path}")
    
    debug_log(f"Using ChromeDriver: {chromedriver_path}")
    
    try:
        service = ChromeService(executable_path=chromedriver_path)
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(10)
        
        # Test the driver
        driver.get("https://www.google.com")
        debug_log("✅ Chrome driver setup successful")
        
        return driver, user_data_dir
    except Exception as e:
        debug_log(f"❌ Chrome driver setup failed: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description='Extract NPID inbox data using Selenium')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode (default)')
    parser.add_argument('--visible', action='store_true', help='Run in visible mode for debugging')
    args = parser.parse_args()
    
    # Determine headless mode
    headless = not args.visible  # Default to headless unless --visible is specified
    
    driver = None
    user_data_dir = None
    try:
        debug_log("🚀 Starting NPID inbox extraction...")
        
        # Setup Chrome driver
        driver, user_data_dir = setup_chrome_driver(headless=headless)
        
        # Extract inbox data
        debug_log("📥 Extracting inbox threads...")
        threads = extract_inbox_data(driver)
        
        # Output results as clean JSON to stdout (exactly like terminal version)
        print(json.dumps(threads, indent=2))
        debug_log(f"✅ Extraction complete - {len(threads)} threads")
        
        return 0
        
    except Exception as e:
        debug_log(f"❌ Script failed: {e}")
        
        # Output error as JSON for Raycast
        error_output = {
            "error": str(e),
            "threads": []
        }
        print(json.dumps(error_output))
        return 1
        
    finally:
        if driver:
            debug_log("🔄 Closing Chrome driver...")
            try:
                driver.quit()
            except:
                pass
            debug_log("✅ Chrome driver closed")
            
            # Clean up temporary profile directory
            try:
                if user_data_dir and os.path.exists(user_data_dir):
                    debug_log(f"🧹 Cleaning up temporary profile: {user_data_dir}")
                    shutil.rmtree(user_data_dir, ignore_errors=True)
            except:
                pass

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
