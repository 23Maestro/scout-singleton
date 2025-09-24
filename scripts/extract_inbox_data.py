#!/usr/bin/python3
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

def extract_inbox_data(driver):
    """Extract inbox thread data from NPID"""
    print("Extracting inbox data from NPID")
    wait = WebDriverWait(driver, 30)
    
    try:
        # Navigate to inbox page
        print(f"Navigating to: {INBOX_URL}")
        driver.get(INBOX_URL)
        
        # Wait for page load
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        print("Inbox page loaded successfully")
        
        # Wait a bit for dynamic content to load
        time.sleep(3)
        
        # Debug: Check what's actually on the page
        print("Page title:", driver.title)
        print("Current URL:", driver.current_url)
        
        # Check if we're on the right page
        if "videomailbox" not in driver.current_url:
            print("WARNING: Not on the expected inbox page")
        
        # Debug: Look for any elements with 'message' in the ID
        all_elements = driver.find_elements(By.XPATH, "//*[contains(@id, 'message')]")
        print(f"Found {len(all_elements)} elements with 'message' in ID")
        for i, el in enumerate(all_elements[:5]):  # Show first 5
            print(f"  Element {i}: {el.get_attribute('id')}")
        
        # Get total unread count
        try:
            unread_element = driver.find_element(By.CSS_SELECTOR, "#unreadcnt")
            total_unread = int(unread_element.text.strip())
            print(f"Total unread messages: {total_unread}")
        except:
            print("Could not get unread count")
            total_unread = 0
        
        # Extract all threads with pagination
        all_threads = []
        page_count = 0
        
        while True:
            page_count += 1
            print(f"Processing page {page_count}...")
            
            # Find all thread containers
            thread_elements = driver.find_elements(By.CSS_SELECTOR, "[id^='message_id']")
            print(f"Found {len(thread_elements)} threads on page {page_count}")
            
            if not thread_elements:
                print("No more threads found")
                break
            
            # Extract data from each thread
            for thread_element in thread_elements:
                try:
                    thread_id = thread_element.get_attribute("id")
                    message_id = thread_id.replace("message_id", "") if thread_id else f"thread-{len(all_threads)}"
                    
                    # Get thread text content
                    thread_text = thread_element.text.strip()
                    
                    # Extract email from thread content
                    email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', thread_text)
                    email = email_match.group(1) if email_match else ''
                    
                    # Extract sender name (first name in the thread)
                    name_match = re.search(r'^([A-Za-z\s]+)', thread_text)
                    sender_name = name_match.group(1).strip() if name_match else 'Unknown Sender'
                    
                    # Extract subject (look for "Re:" patterns)
                    subject_match = re.search(r'(Re: [^\n]+)', thread_text)
                    subject = subject_match.group(1) if subject_match else 'Video Request'
                    
                    # Extract date
                    date_match = re.search(r'(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun) \d+', thread_text)
                    date = date_match.group(0) if date_match else ''
                    
                    # Check if thread has assign button (unassigned indicator)
                    try:
                        assign_button = thread_element.find_element(By.CSS_SELECTOR, "#assignvideoteam")
                        is_assigned = False  # Has assign button = unassigned
                    except NoSuchElementException:
                        is_assigned = True   # No assign button = assigned
                    
                    # Only add if we have meaningful data
                    if sender_name and sender_name != 'Unknown Sender':
                        thread_data = {
                            "thread_id": f"thread-{message_id}",
                            "message_id": message_id,
                            "player_id": f"player-{message_id}",
                            "subject": subject,
                            "player_name": sender_name,
                            "email": email,
                            "content": thread_text[:500],  # First 500 chars
                            "contactid": f"contact-{message_id}",
                            "is_assigned": is_assigned,
                            "assigned_to": "Jerami Singleton" if is_assigned else None,
                            "received_at": date,
                            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
                        }
                        all_threads.append(thread_data)
                        print(f"Extracted thread: {sender_name} - {'ASSIGNED' if is_assigned else 'UNASSIGNED'}")
                
                except Exception as e:
                    print(f"Error processing thread: {e}")
                    continue
            
            # Try to load more threads by scrolling to bottom
            try:
                bottom_element = driver.find_element(By.CSS_SELECTOR, "#videoteammailbox > div.x-main.full > div > div.content.inner_dater > div:nth-child(2) > div.tab-content.col-md-4.col-sm-4.col-xs-12.autoht.toggledivs > div.scrolllist > div > div > div.bottom-space")
                driver.execute_script("arguments[0].scrollIntoView(true);", bottom_element)
                time.sleep(2)  # Wait for new content to load
                
                # Check if new threads were loaded
                new_thread_elements = driver.find_elements(By.CSS_SELECTOR, "[id^='message_id']")
                if len(new_thread_elements) <= len(thread_elements):
                    print("No new threads loaded, stopping pagination")
                    break
                    
            except NoSuchElementException:
                print("Bottom element not found, stopping pagination")
                break
            except Exception as e:
                print(f"Error during pagination: {e}")
                break
        
        # Count assigned vs unassigned
        assigned_count = sum(1 for thread in all_threads if thread["is_assigned"])
        unassigned_count = sum(1 for thread in all_threads if not thread["is_assigned"])
        
        print(f"Extraction complete:")
        print(f"  Total threads: {len(all_threads)}")
        print(f"  Assigned: {assigned_count}")
        print(f"  Unassigned: {unassigned_count}")
        print(f"  Expected unread: {total_unread}")
        
        return all_threads
        
    except Exception as e:
        print(f"Error extracting inbox data: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description='Extract NPID inbox data using Selenium')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    args = parser.parse_args()
    
    # Setup Chrome options (same as extract_video_progress.py)
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.chrome.options import Options

    options = Options()
    # SAME USER DATA DIR AS video_updates.py
    user_data_dir = os.path.expanduser("~/selenium_chrome_profile")
    print(f"Using user data directory: {user_data_dir}")
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--start-maximized")
    
    if args.headless:
        options.add_argument('--headless')
    
    # Use system ChromeDriver instead of WebDriverManager
    chromedriver_path = "/opt/homebrew/bin/chromedriver"
    print(f"Using system ChromeDriver: {chromedriver_path}")
    service = ChromeService(executable_path=chromedriver_path)
    
    driver = None
    try:
        print("Starting Chrome driver...")
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(5)
        
        # Extract inbox data
        threads = extract_inbox_data(driver)
        
        # Output as JSON
        print(json.dumps(threads, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()
