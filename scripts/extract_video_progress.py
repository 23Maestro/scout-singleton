#!/usr/bin/python3
import time
import argparse
import os
import sys
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# SAME BASE URL AND SELENIUM SETUP AS video_updates.py
BASE_URL = "https://dashboard.nationalpid.com/videoteammsg/videomailprogress"
SEARCH_FIELD_SELECTOR = "#progresstab > div:nth-child(2) > div > div.content > div:nth-child(1) > div.col-md-11.col-sm-9 > div > div.col-md-3.col-sm-5.col-xs-12.form-group.search_form > div > input"

# Your CSS selectors for data extraction
PROGRESS_SELECTORS = {
    "athlete_name": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(2)",
    "grad_year": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(3)",
    "sport": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(4)",
    "city_state": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(5)",
    "high_school": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(6)",
    "positions": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(7) > span",
    "stage": "#stage_value_11502",
    "status": "#status_value_11502",
    "contact": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(10)",
    "due_date": "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(2) > td:nth-child(12)"
}

def extract_video_progress_data(driver, athlete_name):
    """Extract video progress data using ATHLETE NAME (not URL)"""
    print(f"Extracting video progress data for athlete: {athlete_name}")
    wait = WebDriverWait(driver, 30)
    
    try:
        # Navigate to progress page
        print(f"Navigating to: {BASE_URL}")
        driver.get(BASE_URL)
        
        # Wait for page load and search field
        search_field = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
        print("Video progress page loaded successfully")
        
        # SEARCH USING ATHLETE NAME (not URL)
        search_field.clear()
        search_field.send_keys(athlete_name)
        print(f"Searched for athlete name: {athlete_name}")
        time.sleep(5)  # Longer wait for search results to load
        
        # Find the correct row for the searched athlete (DYNAMIC, not hardcoded)
        progress_data = {}
        target_row = None
        
        try:
            # Get all table rows
            table_rows = driver.find_elements(By.CSS_SELECTOR, 
                "#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr")
            
            print(f"Found {len(table_rows)} rows in progress table")
            
            # Find the row containing our searched athlete
            for i, row in enumerate(table_rows, 1):
                try:
                    # Check if this row contains the athlete name we searched for
                    row_text = row.text.lower()
                    search_name = athlete_name.lower()
                    
                    if search_name in row_text:
                        target_row = i
                        print(f"Found athlete '{athlete_name}' in row {i}")
                        break
                except:
                    continue
            
            if not target_row:
                # Fallback: use first row if exact match not found
                target_row = 1
                print(f"Could not find exact match for '{athlete_name}', using first row as fallback")
                
        except Exception as e:
            print(f"Could not find table rows: {e}")
            target_row = 1
        
        # Set athlete name from search input (we already know this!)
        progress_data["athlete_name"] = athlete_name
        print(f"✓ athlete_name: {athlete_name} (from search input)")
        
        # Extract OTHER data from the CORRECT row (dynamic)
        dynamic_selectors = {
            "grad_year": f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(2)",
            "sport": f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(3)",
            "city": f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(4)",
            "state": f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(5)",
            "high_school": f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(6)",
            "positions": f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(7)",
        }
        
        for field, selector in dynamic_selectors.items():
            try:
                element = driver.find_element(By.CSS_SELECTOR, selector)
                value = element.text.strip()
                
                # Handle positions format for Asana (commas → pipes)
                if field == "positions" and value:
                    value = value.replace(",", " |")
                
                # Store the extracted value
                progress_data[field] = value
                    
                print(f"✓ {field}: {value}")
                
            except Exception as e:
                print(f"✗ Could not extract {field}: {e}")
                progress_data[field] = ""
        
        # Handle stage/status with dynamic IDs (these might also need to be row-specific)
        try:
            stage_element = driver.find_element(By.CSS_SELECTOR, f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td > select[name*='stage'] option[selected]")
            progress_data["stage"] = stage_element.text.strip()
            print(f"✓ stage: {progress_data['stage']}")
        except:
            try:
                stage_element = driver.find_element(By.CSS_SELECTOR, "#stage_value_11502")
                progress_data["stage"] = stage_element.text.strip()
                print(f"✓ stage (fallback): {progress_data['stage']}")
            except:
                progress_data["stage"] = ""
                print("✗ Could not extract stage")
        
        try:
            status_element = driver.find_element(By.CSS_SELECTOR, f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td > select[name*='status'] option[selected]")
            progress_data["status"] = status_element.text.strip()
            print(f"✓ status: {progress_data['status']}")
        except:
            try:
                status_element = driver.find_element(By.CSS_SELECTOR, "#status_value_11502")
                progress_data["status"] = status_element.text.strip()
                print(f"✓ status (fallback): {progress_data['status']}")
            except:
                progress_data["status"] = ""
                print("✗ Could not extract status")
        
        # Extract assignee (maps to contact in Asana) and due date from correct row
        try:
            assignee_element = driver.find_element(By.CSS_SELECTOR, f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(10)")
            progress_data["assignee"] = assignee_element.text.strip()
            print(f"✓ assignee: {progress_data['assignee']}")
        except Exception as e:
            progress_data["assignee"] = ""
            print(f"✗ Could not extract assignee: {e}")
        
        try:
            due_date_element = driver.find_element(By.CSS_SELECTOR, f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(11)")
            progress_data["due_date"] = due_date_element.text.strip()
            print(f"✓ due_date: {progress_data['due_date']}")
        except:
            # Try alternative column
            try:
                due_date_element = driver.find_element(By.CSS_SELECTOR, f"#progresstab > div:nth-child(2) > div > div.content > div.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child({target_row}) > td:nth-child(12)")
                progress_data["due_date"] = due_date_element.text.strip()
                print(f"✓ due_date (alt column): {progress_data['due_date']}")
            except Exception as e:
                progress_data["due_date"] = ""
                print(f"✗ Could not extract due_date: {e}")
        
        print(f"Successfully extracted data for: {athlete_name}")
        return progress_data
        
    except Exception as e:
        print(f"ERROR: Failed to extract video progress data: {e}")
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract video progress data for an athlete")
    parser.add_argument('--athlete_name', required=True, help="Name of the athlete to search for")
    args = parser.parse_args()

    print("Setting up WebDriver with SAME PERSISTENT CHROME PROFILE as video_updates.py...")
    driver = None
    try:
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
        
        # Use system ChromeDriver instead of WebDriverManager
        chromedriver_path = "/opt/homebrew/bin/chromedriver"
        print(f"Using system ChromeDriver: {chromedriver_path}")
        service = ChromeService(executable_path=chromedriver_path)
        
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(5)

        # Extract data
        data = extract_video_progress_data(driver, args.athlete_name)
        
        if data:
            print("--- VIDEO PROGRESS DATA EXTRACTION SUCCESSFUL ---")
            # Output as array for TypeScript compatibility
            print(json.dumps([data], indent=2))
        else:
            print("--- VIDEO PROGRESS DATA EXTRACTION FAILED ---")
            print(json.dumps([], indent=2))

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            driver.quit()
