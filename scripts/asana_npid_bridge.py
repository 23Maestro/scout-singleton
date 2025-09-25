#!/usr/bin/env python3
"""
Asana-NPID Bridge: Redirect to working selenium automation
"""
import sys
import subprocess

# Redirect to the working video_updates.py for Asana-NPID integration
if __name__ == "__main__":
    working_script = "/Volumes/HomeSSD/developer/playerid-updates-v2/video_updates.py"
    # Forward all arguments to the working automation
    subprocess.run([sys.executable, working_script] + sys.argv[1:])
    sys.exit(0)

# Original bridge code below for reference (inactive)

# Asana API configuration
import os
ASANA_TOKEN = os.environ.get("ASANA_ACCESS_TOKEN", "")
ASANA_BASE_URL = "https://app.asana.com/api/1.0"
DEFAULT_WAIT_TIMEOUT = 15

def get_asana_tasks_without_player_ids():
    """Fetch Asana tasks that don't have PlayerID filled"""
    if not ASANA_TOKEN:
        raise ValueError("ASANA_ACCESS_TOKEN environment variable is required")
    headers = {"Authorization": f"Bearer {ASANA_TOKEN}"}
    
    # Get workspaces
    response = requests.get(f"{ASANA_BASE_URL}/workspaces", headers=headers)
    workspaces = response.json()["data"]
    
    # Find National Prospect ID workspace
    workspace = next((w for w in workspaces if w["name"] == "National Prospect ID"), workspaces[0])
    
    # Get tasks
    params = {
        "assignee": "me",
        "workspace": workspace["gid"],
        "opt_fields": "id,name,custom_fields,permalink_url",
        "completed_since": "now"
    }
    
    response = requests.get(f"{ASANA_BASE_URL}/tasks", headers=headers, params=params)
    tasks = response.json()["data"]
    
    # Filter tasks without PlayerID
    tasks_without_ids = []
    for task in tasks:
        player_id = None
        player_id_field_gid = None
        
        for field in task.get("custom_fields", []):
            if field["name"] == "PlayerID":
                player_id = field.get("display_value", "")
                player_id_field_gid = field["gid"]
                break
        
        if not player_id or player_id.strip() == "":
            tasks_without_ids.append({
                "id": task["gid"],
                "name": task["name"],
                "player_id_field_gid": player_id_field_gid,
                "permalink_url": task["permalink_url"]
            })
    
    return tasks_without_ids

def search_player_on_npid(driver, player_name):
    """Search for player on NPID video progress page"""
    print(f"  🔍 Searching for: {player_name}")
    
    try:
        # Navigate to video progress page - try multiple potential URLs
        urls_to_try = [
            "https://dashboard.nationalpid.com/videoteam/progress",
            "https://dashboard.nationalpid.com/video/progress",
            "https://dashboard.nationalpid.com/tasks",
            "https://dashboard.nationalpid.com/search"
        ]

        wait = WebDriverWait(driver, DEFAULT_WAIT_TIMEOUT)
        search_input = None

        for url in urls_to_try:
            try:
                driver.get(url)
                time.sleep(2)
                # Try to find search input
                search_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='search'], input[placeholder*='search'], input[name*='search']")))
                print(f"  ✅ Found search on URL: {url}")
                break
            except TimeoutException:
                print(f"  ❌ No search found on URL: {url}")
                continue

        if not search_input:
            raise Exception("Could not find search functionality on any NPID page")
        
        # Clear and enter player name
        search_input.clear()
        search_input.send_keys(player_name)
        time.sleep(2)  # Let search results load
        
        # Look for player name in results
        page_text = driver.find_element(By.TAG_NAME, "body").text
        
        # Try to find and click the player icon/link - multiple selectors
        player_link_selectors = [
            "a[href*='/athlete/profile/']",
            "a[href*='/player/']",
            "a[href*='/profile/']",
            ".player-link",
            ".athlete-link",
            "a[href*='/athlete/']"
        ]

        profile_url = None
        for selector in player_link_selectors:
            player_links = driver.find_elements(By.CSS_SELECTOR, selector)
            for link in player_links:
                link_text = link.get_attribute("outerHTML").lower()
                if player_name.lower() in link_text or any(name_part.lower() in link_text for name_part in player_name.split()):
                    profile_url = link.get_attribute("href")
                    print(f"  ✅ Found profile: {profile_url}")
                    return profile_url

        if not profile_url:
            # Try to extract player ID from table rows or other elements
            rows = driver.find_elements(By.CSS_SELECTOR, "tr, .player-row, .result-row")
            for row in rows:
                if player_name.lower() in row.text.lower():
                    # Look for links in this row
                    links = row.find_elements(By.TAG_NAME, "a")
                    for link in links:
                        href = link.get_attribute("href")
                        if href and ("player" in href or "athlete" in href or "profile" in href):
                            print(f"  ✅ Found profile in row: {href}")
                            return href
        
        print(f"  ❌ Player not found in search results")
        return None
        
    except Exception as e:
        print(f"  ❌ Search error: {str(e)}")
        return None

def extract_athlete_profile_data(driver, profile_url):
    """Extract athlete profile data from NPID profile URL"""
    print(f"  📄 Extracting data from profile...")
    
    try:
        driver.get(profile_url)
        wait = WebDriverWait(driver, DEFAULT_WAIT_TIMEOUT)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(2)
        
        page_text = driver.find_element(By.TAG_NAME, "body").text
        lines = page_text.split('\n')
        
        # Look for the pattern: "2027 | Inside Linebacker | Outside Linebacker"
        for i, line in enumerate(lines):
            year_match = re.match(r'(20\d{2})\s*\|\s*(.+)', line.strip())
            if year_match:
                year = year_match.group(1)
                positions = year_match.group(2).strip()
                
                # Look for name, school, city/state in next lines
                name = None
                school = None
                city = None
                state = None
                
                for j in range(i+1, min(i+6, len(lines))):
                    next_line = lines[j].strip()
                    
                    # Name pattern
                    name_match = re.match(r'([A-Z][A-Z\s]+?)(?:\s*\|\s*20\d{2})?$', next_line)
                    if name_match and not name:
                        potential_name = name_match.group(1).strip()
                        if len(potential_name.split()) >= 2 and 'lbs' not in potential_name.lower():
                            name = potential_name
                            
                            # Look for school and location
                            for k in range(j+1, min(j+4, len(lines))):
                                school_line = lines[k].strip()
                                
                                if ('High School' in school_line or 'Academy' in school_line) and not school:
                                    school = school_line
                                
                                location_match = re.match(r'^([^,]+),\s*([A-Z]{2})$', school_line)
                                if location_match and not city:
                                    city = location_match.group(1).strip()
                                    state = location_match.group(2).strip()
                            break
                
                if name:
                    return {
                        'player_id_url': profile_url,
                        'name': name,
                        'grad_year': year,
                        'positions': positions,
                        'high_school': school or '',
                        'city': city or '',
                        'state': state or '',
                        'status': 'SUCCESS'
                    }
        
        return {'status': 'NOT_FOUND'}
        
    except Exception as e:
        print(f"  ❌ Profile extraction error: {str(e)}")
        return {'status': f'ERROR: {str(e)}'}

def update_asana_task(task_id, player_data, player_id_field_gid):
    """Update Asana task with enriched player data"""
    if not ASANA_TOKEN:
        raise ValueError("ASANA_ACCESS_TOKEN environment variable is required")
    headers = {
        "Authorization": f"Bearer {ASANA_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Prepare custom fields update
    custom_fields = {}
    
    if player_data.get('player_id_url'):
        custom_fields[player_id_field_gid] = player_data['player_id_url']
    
    # You'd need to get the actual field GIDs for these
    # custom_fields['sport_field_gid'] = player_data.get('sport', '')
    # custom_fields['grad_year_field_gid'] = player_data.get('grad_year', '')
    # custom_fields['positions_field_gid'] = player_data.get('positions', '')
    
    data = {
        "data": {
            "custom_fields": custom_fields
        }
    }
    
    response = requests.put(f"{ASANA_BASE_URL}/tasks/{task_id}", headers=headers, json=data)
    return response.status_code == 200

def main():
    parser = argparse.ArgumentParser(description="Enrich Asana tasks with NPID player data")
    parser.add_argument('--limit', type=int, default=10, help="Limit number of tasks to process")
    args = parser.parse_args()
    
    print("🚀 Starting Asana-NPID enrichment...")
    
    # Get tasks without PlayerIDs
    print("📋 Fetching Asana tasks without PlayerIDs...")
    tasks = get_asana_tasks_without_player_ids()
    print(f"Found {len(tasks)} tasks to process")
    
    if not tasks:
        print("✅ All tasks already have PlayerIDs!")
        return
    
    # Limit processing
    tasks = tasks[:args.limit]
    
    # Setup selenium
    print("🌐 Setting up WebDriver...")
    driver = None
    
    try:
        from selenium.webdriver.chrome.service import Service as ChromeService
        from selenium.webdriver.chrome.options import Options

        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        # Try to use system Chrome first
        try:
            service = ChromeService()  # Use system chromedriver
            driver = webdriver.Chrome(service=service, options=options)
        except:
            # Fallback to manual chromedriver path
            chromedriver_path = "/usr/local/bin/chromedriver"
            if os.path.exists(chromedriver_path):
                service = ChromeService(executable_path=chromedriver_path)
                driver = webdriver.Chrome(service=service, options=options)
            else:
                print("❌ ChromeDriver not found. Please install: brew install chromedriver")
                return
        
        print("✅ WebDriver ready!")
        
        # Process each task
        success_count = 0
        for i, task in enumerate(tasks, 1):
            print(f"\n[{i}/{len(tasks)}] Processing: {task['name']}")
            
            # Search for player
            profile_url = search_player_on_npid(driver, task['name'])
            
            if profile_url:
                # Extract player data
                player_data = extract_athlete_profile_data(driver, profile_url)
                
                if player_data['status'] == 'SUCCESS':
                    # Update Asana task
                    if update_asana_task(task['id'], player_data, task['player_id_field_gid']):
                        print(f"  ✅ Updated Asana task with PlayerID")
                        success_count += 1
                    else:
                        print(f"  ❌ Failed to update Asana task")
                else:
                    print(f"  ❌ Failed to extract profile data")
            
            time.sleep(2)  # Be nice to the servers
        
        print(f"\n🎉 Enrichment complete! Updated {success_count}/{len(tasks)} tasks")
        
    except Exception as e:
        print(f"💥 Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()
