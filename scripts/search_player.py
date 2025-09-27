#!/usr/bin/env python3
"""
Selenium Player Search using Official Selenium Manager (Beta)
Based on the official Selenium Manager documentation and working v2 extension
"""
import time
import argparse
import json
import sys
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Configuration
BASE_URL = "https://dashboard.nationalpid.com/videoteammsg/videomailprogress"
SEARCH_FIELD_SELECTOR = "#progresstab > div:nth-child(2) > div > div.content > div:nth-child(1) > div.col-md-11.col-sm-9 > div > div.col-md-3.col-sm-5.col-xs-12.form-group.search_form > div > input"
PERSON_ICON_SELECTOR = "#progresstab > div:nth-child(2) > div > div.content > div.col-md-12.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(1) > a:nth-child(2) > i"
DEFAULT_WAIT_TIMEOUT = 30

def search_player(athlete_name, headless=True):
    """Search for a player using official Selenium Manager (Beta)"""
    print(f"🔍 Searching for player: {athlete_name}")
    
    driver = None
    try:
        # OFFICIAL SELENIUM MANAGER (BETA) IMPLEMENTATION
        # This is the correct way as per Selenium documentation
        from selenium.webdriver.chrome.service import Service as ChromeService
        from selenium.webdriver.chrome.options import Options
        
        # Chrome options for NPID website
        options = Options()
        if headless:
            options.add_argument("--headless")
        
        # Use unique Chrome profile for session management
        import uuid
        user_data_dir = os.path.expanduser(f"~/selenium_chrome_profile_{uuid.uuid4().hex[:8]}")
        print(f"Using user data directory: {user_data_dir}")
        options.add_argument(f"--user-data-dir={user_data_dir}")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--start-maximized")
        
        # OFFICIAL SELENIUM MANAGER (BETA) - No manual driver management needed!
        # Selenium Manager automatically handles driver discovery, download, and caching
        # This is the official approach as documented in Selenium Manager (Beta) docs
        print("🚀 Using Official Selenium Manager (Beta) - automatic driver management")
        service = ChromeService()  # No executable_path needed - Selenium Manager handles it!
        
        print("Creating WebDriver with Selenium Manager...")
        driver = webdriver.Chrome(service=service, options=options)
        print(f"✅ WebDriver created successfully")
        print(f"Browser: {driver.capabilities.get('browserName', 'unknown')}")
        print(f"Browser version: {driver.capabilities.get('browserVersion', 'unknown')}")
        driver.implicitly_wait(5)
        
        wait = WebDriverWait(driver, DEFAULT_WAIT_TIMEOUT)
        
        # Navigate to the video progress page
        print(f"🌐 Navigating to: {BASE_URL}")
        driver.get(BASE_URL)
        
        # Wait for page to load and find search field
        print("⏳ Waiting for search field...")
        search_field = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
        
        # Search for the athlete
        print(f"🔍 Searching for: {athlete_name}")
        search_field.clear()
        search_field.send_keys(athlete_name)
        time.sleep(3)  # Wait for search results
        
        # Look for the first result (person icon)
        print("👤 Looking for player profile...")
        try:
            person_icon = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, PERSON_ICON_SELECTOR)))
            person_anchor = person_icon.find_element(By.XPATH, "./ancestor::a[1]")
            
            # Extract player ID from the href
            profile_url = person_anchor.get_attribute("href")
            if profile_url and "/athlete/profile/" in profile_url:
                player_id = profile_url.split("/athlete/profile/")[-1]
                print(f"✅ Found player ID: {player_id}")
                
                # Try to extract more info from the table row
                row = person_icon.find_element(By.XPATH, "./ancestor::tr[1]")
                cells = row.find_elements(By.TAG_NAME, "td")
                
                result = {
                    "player_id": player_id,
                    "athleteName": athlete_name,
                    "profile_url": profile_url
                }
                
                # Try to extract additional info from table cells
                if len(cells) >= 4:
                    # Assuming standard table structure: Name, Sport, Grad Year, etc.
                    try:
                        sport_cell = cells[1] if len(cells) > 1 else None
                        grad_year_cell = cells[2] if len(cells) > 2 else None
                        city_cell = cells[3] if len(cells) > 3 else None
                        
                        if sport_cell:
                            result["sport"] = sport_cell.text.strip()
                        if grad_year_cell:
                            result["gradYear"] = grad_year_cell.text.strip()
                        if city_cell:
                            result["city"] = city_cell.text.strip()
                    except Exception as e:
                        print(f"⚠️ Could not extract additional info: {e}")
                
                return [result]
            else:
                print("❌ Could not extract player ID from profile URL")
                return []
                
        except TimeoutException:
            print("❌ No player found with that name")
            return []
            
    except Exception as e:
        print(f"❌ Error during search: {e}")
        return []
    finally:
        if driver:
            print("Closing the browser...")
            driver.quit()

def main():
    parser = argparse.ArgumentParser(description="Search for a player using Official Selenium Manager (Beta)")
    parser.add_argument('--athlete_name', required=True, help="Name of the athlete to search for")
    parser.add_argument('--headless', action='store_true', default=True, help="Run in headless mode")
    
    args = parser.parse_args()
    
    try:
        results = search_player(args.athlete_name, args.headless)
        print(json.dumps(results, indent=2))
    except Exception as e:
        print(f"❌ Search failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()