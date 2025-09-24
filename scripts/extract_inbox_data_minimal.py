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
    """Extract minimal inbox thread data from NPID"""
    wait = WebDriverWait(driver, 30)
    
    try:
        driver.get(INBOX_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(3)
        
        # Get total unread count
        try:
            unread_element = driver.find_element(By.CSS_SELECTOR, "#unreadcnt")
            total_unread = int(unread_element.text.strip())
        except:
            total_unread = 0
        
        # Extract minimal thread data
        all_threads = []
        
        # Find all thread containers
        thread_elements = driver.find_elements(By.CSS_SELECTOR, "[id^='message_id']")
        
        for i, thread_element in enumerate(thread_elements[:25]):  # Limit to first 25 threads
            try:
                thread_id = thread_element.get_attribute("id")
                message_id = thread_id.replace("message_id", "") if thread_id else f"thread-{i}"
                
                # Get only first line of thread text (sender name)
                thread_text = thread_element.text.strip()
                first_line = thread_text.split('\n')[0] if thread_text else f'Thread {i+1}'
                
                # Extract minimal sender name (first 30 chars max)
                sender_name = first_line[:30].strip()
                
                # Check if thread has assign button (unassigned indicator)
                try:
                    thread_element.find_element(By.CSS_SELECTOR, "#assignvideoteam")
                    is_assigned = False
                except NoSuchElementException:
                    is_assigned = True
                
                # Minimal data structure
                thread_data = {
                    "id": message_id,
                    "name": sender_name,
                    "status": "assigned" if is_assigned else "unassigned"
                }
                all_threads.append(thread_data)
                
            except Exception:
                continue
        
        return {
            "threads": all_threads,
            "total": len(all_threads),
            "unread": total_unread
        }
        
    except Exception as e:
        return {"error": str(e), "threads": [], "total": 0, "unread": 0}

def main():
    parser = argparse.ArgumentParser(description='Extract minimal NPID inbox data')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    args = parser.parse_args()
    
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.chrome.options import Options

    options = Options()
    user_data_dir = os.path.expanduser("~/selenium_chrome_profile")
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-logging")
    options.add_argument("--log-level=3")  # Suppress Chrome logs
    
    if args.headless:
        options.add_argument('--headless')
    
    chromedriver_path = "/opt/homebrew/bin/chromedriver"
    service = ChromeService(executable_path=chromedriver_path)
    
    driver = None
    try:
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(5)
        
        result = extract_inbox_data(driver)
        
        # Output ONLY the JSON result (no debug prints)
        sys.stdout.write(json.dumps(result))
        sys.stdout.flush()
        
    except Exception as e:
        sys.stdout.write(json.dumps({"error": str(e), "threads": [], "total": 0, "unread": 0}))
        sys.stdout.flush()
        sys.exit(1)
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()
