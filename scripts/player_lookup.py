#!/usr/bin/env python3
"""
Player Lookup Selenium Automation Script
Automates player profile lookups and data extraction from NPID
"""

import argparse
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import json
import os

def setup_driver():
    """Initialize Chrome WebDriver with appropriate options"""
    chrome_options = Options()
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
    
    # Use system Chrome if available
    chrome_options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except Exception as e:
        print(f"ERROR: Failed to initialize Chrome driver: {e}")
        return None

def search_player_by_name(driver, player_name):
    """Search for a player by name on NPID"""
    try:
        print(f"Searching for player: {player_name}")
        
        # Navigate to NPID search page
        driver.get("https://nationalprospectid.com/search")
        time.sleep(2)
        
        # Find and fill search box
        search_box = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[placeholder*='search'], input[name*='search'], input[type='search']"))
        )
        
        search_box.clear()
        search_box.send_keys(player_name)
        
        # Submit search
        search_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], .search-button, .btn-search")
        search_button.click()
        
        # Wait for results
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".search-results, .player-card, .result"))
        )
        
        # Extract search results
        results = []
        result_elements = driver.find_elements(By.CSS_SELECTOR, ".player-card, .search-result, .result-item")
        
        for element in result_elements[:5]:  # Limit to first 5 results
            try:
                name = element.find_element(By.CSS_SELECTOR, ".name, .player-name, h3, h4").text
                link = element.find_element(By.TAG_NAME, "a").get_attribute("href")
                
                # Try to get additional info
                sport = ""
                class_year = ""
                try:
                    sport = element.find_element(By.CSS_SELECTOR, ".sport, .player-sport").text
                    class_year = element.find_element(By.CSS_SELECTOR, ".class, .grad-year").text
                except:
                    pass
                
                results.append({
                    "name": name,
                    "link": link,
                    "sport": sport,
                    "class": class_year
                })
            except:
                continue
        
        print(f"Found {len(results)} search results")
        for result in results:
            print(f"  - {result['name']} ({result['sport']} {result['class']}) - {result['link']}")
        
        return results
        
    except Exception as e:
        print(f"ERROR: Search failed: {e}")
        return []

def lookup_player_profile(driver, player_name):
    """Lookup detailed player profile information"""
    try:
        print(f"Looking up profile for: {player_name}")
        
        # First search for the player
        results = search_player_by_name(driver, player_name)
        
        if not results:
            print("No search results found")
            return None
        
        # Navigate to first result
        first_result = results[0]
        driver.get(first_result["link"])
        time.sleep(3)
        
        # Extract profile information
        profile = {}
        
        try:
            # Basic info
            profile["name"] = driver.find_element(By.CSS_SELECTOR, ".player-name, h1, .name").text
            profile["sport"] = driver.find_element(By.CSS_SELECTOR, ".sport, .player-sport").text
            profile["class"] = driver.find_element(By.CSS_SELECTOR, ".class, .grad-year, .graduation").text
            profile["position"] = driver.find_element(By.CSS_SELECTOR, ".position, .player-position").text
            profile["school"] = driver.find_element(By.CSS_SELECTOR, ".school, .high-school").text
            profile["state"] = driver.find_element(By.CSS_SELECTOR, ".state, .location").text
        except Exception as e:
            print(f"Warning: Could not extract some basic info: {e}")
        
        # Extract videos
        videos = []
        try:
            video_elements = driver.find_elements(By.CSS_SELECTOR, ".video, .video-item, .highlight")
            for video in video_elements[:10]:  # Limit to 10 videos
                try:
                    title = video.find_element(By.CSS_SELECTOR, ".title, .video-title, h3, h4").text
                    link = video.find_element(By.TAG_NAME, "a").get_attribute("href")
                    videos.append({"title": title, "link": link})
                except:
                    continue
        except:
            pass
        
        profile["videos"] = videos
        profile["video_count"] = len(videos)
        
        print(f"Profile extracted successfully:")
        print(f"  Name: {profile.get('name', 'N/A')}")
        print(f"  Sport: {profile.get('sport', 'N/A')}")
        print(f"  Class: {profile.get('class', 'N/A')}")
        print(f"  Videos: {len(videos)}")
        
        return profile
        
    except Exception as e:
        print(f"ERROR: Profile lookup failed: {e}")
        return None

def export_player_data(driver, player_name):
    """Export player data to JSON file"""
    try:
        profile = lookup_player_profile(driver, player_name)
        
        if profile:
            # Save to file
            filename = f"player_data_{player_name.replace(' ', '_').lower()}.json"
            filepath = os.path.join(os.path.expanduser("~/Desktop"), filename)
            
            with open(filepath, 'w') as f:
                json.dump(profile, f, indent=2)
            
            print(f"Player data exported to: {filepath}")
            return filepath
        else:
            print("No profile data to export")
            return None
            
    except Exception as e:
        print(f"ERROR: Export failed: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Player Lookup Automation")
    parser.add_argument("--player_name", required=True, help="Player name to lookup")
    parser.add_argument("--action", default="lookup", choices=["lookup", "search", "export", "update"],
                       help="Action to perform")
    
    args = parser.parse_args()
    
    print(f"Starting player lookup automation...")
    print(f"Player: {args.player_name}")
    print(f"Action: {args.action}")
    
    driver = setup_driver()
    if not driver:
        return
    
    try:
        if args.action == "search":
            results = search_player_by_name(driver, args.player_name)
            print(f"Search completed. Found {len(results)} results.")
            
        elif args.action == "lookup":
            profile = lookup_player_profile(driver, args.player_name)
            if profile:
                print("--- PLAYER LOOKUP SUCCESSFUL ---")
            else:
                print("--- PLAYER LOOKUP FAILED ---")
                
        elif args.action == "export":
            filepath = export_player_data(driver, args.player_name)
            if filepath:
                print("--- DATA EXPORT SUCCESSFUL ---")
            else:
                print("--- DATA EXPORT FAILED ---")
                
        elif args.action == "update":
            print("Update functionality not yet implemented")
            
        print("--- AUTOMATION COMPLETED SUCCESSFULLY ---")
        
    except Exception as e:
        print(f"ERROR: Automation failed: {e}")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    main()