#!/usr/bin/env python3
import time
import argparse
import os
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# --- Configuration & Selectors ---
BASE_URL = "https://dashboard.nationalpid.com/videoteammsg/videomailprogress"
SEARCH_FIELD_SELECTOR = "#progresstab > div:nth-child(2) > div > div.content > div:nth-child(1) > div.col-md-11.col-sm-9 > div > div.col-md-3.col-sm-5.col-xs-12.form-group.search_form > div > input"
# Dynamic email icon selector - will be constructed based on search results
# EMAIL_ICON_SELECTOR = "#\\31 435525 > i" # Old hardcoded selector - removed
TEMPLATE_DROPDOWN_SELECTOR = "#indvemailtemplate"
SEND_EMAIL_BUTTON_SELECTOR = "#btnSendMessegeAthlete"

DEFAULT_WAIT_TIMEOUT = 30
SHORT_WAIT_TIMEOUT = 10

TEMPLATE_OPTIONS_MAPPING = {
    "Editing Done": 2,
    "Video Instructions": 3,
    "Hudl Login Request": 4,
    "Uploading Video Directions to Dropbox": 5,
    "Your Video Editing is Underway": 6,
    "Editing Done: Ad Removed": 7,
    "Video Guidelines": 8,
    "Revisions": 9
}

# Template aliases for easier matching
TEMPLATE_ALIASES = {
    "editing done": "Editing Done",
    "done": "Editing Done",
    "video instructions": "Video Instructions",
    "instructions": "Video Instructions",
    "hudl login": "Hudl Login Request",
    "hudl": "Hudl Login Request",
    "login": "Hudl Login Request",
    "uploading": "Uploading Video Directions to Dropbox",
    "dropbox": "Uploading Video Directions to Dropbox",
    "uploading to dropbox": "Uploading Video Directions to Dropbox",
    "uploading dropbox": "Uploading Video Directions to Dropbox",
    "uploading video directions to dropbox": "Uploading Video Directions to Dropbox",
    "uploading to dropbox instructions": "Uploading Video Directions to Dropbox",
    "dropbox instructions": "Uploading Video Directions to Dropbox",
    "underway": "Your Video Editing is Underway",
    "editing underway": "Your Video Editing is Underway",
    "your video editing is underway": "Your Video Editing is Underway",
    "ad removed": "Editing Done: Ad Removed",
    "editing done ad removed": "Editing Done: Ad Removed",
    "guidelines": "Video Guidelines",
    "video guidelines": "Video Guidelines",
    "revisions": "Revisions"
}

def normalize_template_name(template_input):
    """
    Normalize template input to match exact template names.
    Returns the exact template name or None if no match found.
    """
    # First try exact match (case insensitive)
    for exact_name in TEMPLATE_OPTIONS_MAPPING.keys():
        if template_input.lower() == exact_name.lower():
            return exact_name
    
    # Then try alias matching
    normalized_input = template_input.lower().strip()
    if normalized_input in TEMPLATE_ALIASES:
        return TEMPLATE_ALIASES[normalized_input]
    
    # If no match, return None
    return None

def send_athlete_email(driver, athlete_name, template_value):
    print(f"--- Starting Email Automation for Athlete: {athlete_name}, Template: {template_value} ---")
    wait = WebDriverWait(driver, DEFAULT_WAIT_TIMEOUT)

    try:
        print(f"Ensuring current page is: {BASE_URL}")
        if driver.current_url != BASE_URL:
            print(f"Current URL is {driver.current_url}. Navigating to {BASE_URL}...")
            driver.get(BASE_URL)
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
            print(f"Successfully navigated to: {BASE_URL}")
        else:
            print(f"Already on the target page: {BASE_URL}")

        print(f"Attempting to find SEARCH_FIELD_SELECTOR: {SEARCH_FIELD_SELECTOR}")
        search_field = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
        search_field.clear()
        search_field.send_keys(athlete_name)
        print(f"Typed '{athlete_name}' into search field.")
        # Wait for search results to load
        time.sleep(3) # Increased pause for search results to load

        print("Looking for email icon in search results...")
        # Try multiple strategies to find the email icon
        email_icon = None
        
        # Strategy 1: Look for any email icon (fa-envelope class is common for email icons)
        try:
            print("Strategy 1: Looking for email icon with fa-envelope class...")
            email_icon = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "i.fa-envelope")))
            print("Found email icon using fa-envelope class")
        except TimeoutException:
            print("Strategy 1 failed: No fa-envelope icon found")
        
        # Strategy 2: Look for any clickable <i> element that might be an email icon
        if email_icon is None:
            try:
                print("Strategy 2: Looking for any clickable <i> element in search results...")
                # Look for <i> elements that are clickable and might be email icons
                icons = driver.find_elements(By.CSS_SELECTOR, "i[class*='fa']")
                for icon in icons:
                    if icon.is_displayed() and icon.is_enabled():
                        # Check if this might be an email icon by looking at classes or parent context
                        class_attr = icon.get_attribute("class") or ""
                        if "envelope" in class_attr.lower() or "mail" in class_attr.lower():
                            email_icon = icon
                            print(f"Found potential email icon with classes: {class_attr}")
                            break
                        # If no obvious email classes, take the first visible icon as a fallback
                        elif email_icon is None:
                            email_icon = icon
                            print(f"Using fallback icon with classes: {class_attr}")
            except Exception as e:
                print(f"Strategy 2 failed: {e}")
        
        # Strategy 3: Look for the original pattern but dynamically
        if email_icon is None:
            try:
                print("Strategy 3: Looking for email icon using dynamic ID pattern...")
                # Look for elements with IDs that are numbers (athlete IDs) containing an <i> element
                potential_rows = driver.find_elements(By.CSS_SELECTOR, "[id] > i")
                for icon in potential_rows:
                    if icon.is_displayed() and icon.is_enabled():
                        parent_id = icon.find_element(By.XPATH, "..").get_attribute("id")
                        if parent_id and parent_id.isdigit():
                            email_icon = icon
                            print(f"Found email icon in row with ID: {parent_id}")
                            break
            except Exception as e:
                print(f"Strategy 3 failed: {e}")
        
        if email_icon is None:
            raise TimeoutException("Could not find any email icon in search results")
        
        print("Clicking email icon...")
        email_icon.click()
        print("Email icon clicked successfully.")

        print("Holding for 1.5 seconds after email icon click...")
        time.sleep(1.5) # Reduced from 3.5 to 1.5 seconds - just enough to see the popup open

        # Click the FIRST option to activate/open the dropdown
        first_option_selector_css = f"{TEMPLATE_DROPDOWN_SELECTOR} > option:nth-child(1)"
        print(f"Attempting to click the first option to activate dropdown: {first_option_selector_css}")
        try:
            first_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, first_option_selector_css)))
            first_option.click()
            print("Clicked the first option.")
        except TimeoutException:
            print(f"Could not click the first option {first_option_selector_css}. The dropdown might already be open or behave differently.")
            # If it fails, we might still proceed, assuming the target option might become available anyway or is already visible.

        # Add a pause for options to appear after clicking the first option
        print("Pausing for 2 seconds for options to load...")
        time.sleep(2)

        # Normalize the template name to handle variations
        normalized_template = normalize_template_name(template_value)
        if normalized_template is None:
            print(f"--- ERROR: Unknown template value '{template_value}' ---")
            print("Available templates:")
            for template_name in TEMPLATE_OPTIONS_MAPPING.keys():
                print(f"  - {template_name}")
            print("Common aliases:")
            for alias in sorted(TEMPLATE_ALIASES.keys()):
                print(f"  - '{alias}' -> '{TEMPLATE_ALIASES[alias]}'")
            return
        
        # Use the normalized template name
        template_value = normalized_template
        print(f"Using normalized template: {template_value}")
        
        nth_child_index = TEMPLATE_OPTIONS_MAPPING[template_value]
        # Construct the selector for the specific target option we want to click
        target_option_selector_css = f"{TEMPLATE_DROPDOWN_SELECTOR} > option:nth-child({nth_child_index})"
        
        print(f"Attempting to find and click target template option: {template_value} using CSS selector {target_option_selector_css}")
        
        # Wait for the specific target option to be clickable and then click it
        target_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, target_option_selector_css)))
        target_option.click()

        print(f"Clicked target template option: {template_value}")

        print("Holding for 2 seconds for review...")
        time.sleep(2) # Reduced from 5 to 2 seconds - enough to see the selection

        print(f"Attempting to click send email button: {SEND_EMAIL_BUTTON_SELECTOR}")
        send_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, SEND_EMAIL_BUTTON_SELECTOR)))
        send_button.click()
        print("Send email button clicked.")
        
        print("Pausing for 2 seconds to allow visual confirmation of email sending...")
        time.sleep(2) # Reduced from 5 to 2 seconds - enough to see the send action

        print(f"--- Email Process Attempted for {athlete_name} with template {template_value} ---")

    except TimeoutException as e:
        print(f"--- AUTOMATION ERROR (Email): A timeout occurred --- Details: {e}")
    except NoSuchElementException as e:
        print(f"--- AUTOMATION ERROR (Email): An element was not found --- Details: {e}")
    except Exception as e:
        print(f"--- AN UNEXPECTED AUTOMATION ERROR OCCURRED (Email) --- Details: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc(file=sys.stdout)
    finally:
        print("--- Email Automation Script Finished ---")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send templated email to a student athlete.")
    parser.add_argument('--athlete_name', required=True, help="Name of the athlete to search for")
    parser.add_argument('--template_value', required=True, help="The specific email template to select")
    args = parser.parse_args()

    driver = None
    try:
        # REVERTED to standard Selenium WebDriver setup
        from selenium.webdriver.chrome.service import Service as ChromeService
        from selenium.webdriver.chrome.options import Options
        from webdriver_manager.chrome import ChromeDriverManager

        print("Setting up WebDriver with persistent Chrome profile for Email Automation (standard Selenium)...")
        options = Options()
        user_data_dir = os.path.expanduser("~/selenium_chrome_profile") # Original shared profile
        options.add_argument(f"--user-data-dir={user_data_dir}")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--start-maximized")
        
        chromedriver_path = ChromeDriverManager().install()
        service = ChromeService(executable_path=chromedriver_path)
        
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(SHORT_WAIT_TIMEOUT) # Implicit wait
        print("Standard WebDriver for email automation created successfully.")

        send_athlete_email(driver, args.athlete_name, args.template_value)

    except Exception as e:
        print(f"An error occurred during WebDriver setup or script execution (Email): {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc(file=sys.stdout)
    finally:
        if driver:
            print("Closing the browser (Email script)...")
            driver.quit() 