#!/usr/bin/python3
import time
import argparse
import os
import sys
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, NoAlertPresentException

# --- Configuration & Selectors ---
BASE_URL = "https://dashboard.nationalpid.com/videoteammsg/videomailprogress"

# Selectors for main update flow (adding a NEW video)
SEARCH_FIELD_SELECTOR = "#progresstab > div:nth-child(2) > div > div.content > div:nth-child(1) > div.col-md-11.col-sm-9 > div > div.col-md-3.col-sm-5.col-xs-12.form-group.search_form > div > input"
PERSON_ICON_SELECTOR = "#progresstab > div:nth-child(2) > div > div.content > div.col-md-12.box.box-info.tbl-box > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(1) > a:nth-child(2) > i"
VIDEO_TAB_SELECTOR_CSS = "#profile_main_section > div > div:nth-child(1) > div > div:nth-child(3) > div.panel.panel-primary.profile_table.main_video_box > div > a"
VIDEO_TAB_FALLBACK_SELECTORS = [
    {"by": By.XPATH, "value": "//*[@id='profile_main_section']/div/div[1]/div/div[2]/div[1]/div/a"},
    {"by": By.XPATH, "value": "//a[contains(., 'Videos') or contains(., 'Video')]"},
    {"by": By.XPATH, "value": "//a[contains(@href, 'video')]"},
    {"by": By.XPATH, "value": "//div[contains(@class, 'video') or contains(@class, 'profile_table')]//a"}
]
EDIT_BUTTON_SELECTOR = "#btn_edit"
VIDEO_URL_INPUT_SELECTOR = "#newVideoLink"
TITLE_INPUT_SELECTOR = "#newVideoTitle"
DESCRIPTION_INPUT_SELECTOR = "#form_save_profile > div:nth-child(6) > div:nth-child(1) > div:nth-child(6) > div.col-md-6 > input"
DATE_INPUT_SELECTOR = "#newVideoDate"
APPROVED_VIDEO_CHECKBOX_SELECTOR = "#add_approve_video"
ADD_VIDEO_BUTTON_SELECTOR = "input#btn_save_profile.btn.btn-primary"
POST_ALERT_SAVE_CHANGES_BUTTON_SELECTOR = "input#btn_save_profile.btn.btn-primary.photos_videosbtn"

# Email automation selectors
TEMPLATE_DROPDOWN_SELECTOR = "#indvemailtemplate"
SEND_EMAIL_BUTTON_SELECTOR = "#btnSendMessegeAthlete"

DEFAULT_WAIT_TIMEOUT = 30
SHORT_WAIT_TIMEOUT = 10
VERY_SHORT_WAIT_TIMEOUT = 5

def send_editing_done_email(driver, athlete_name):
    """Send 'Editing Done' email after video update is complete"""
    print(f"--- Starting Email Automation for 'Editing Done' template for: {athlete_name} ---")
    wait = WebDriverWait(driver, DEFAULT_WAIT_TIMEOUT)
    
    try:
        # Navigate back to video progress page
        print(f"Navigating back to video progress page: {BASE_URL}")
        driver.get(BASE_URL)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
        print("Successfully navigated back to video progress page.")
        
        # Search for the athlete again
        print(f"Searching for athlete: {athlete_name}")
        search_field = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
        search_field.clear()
        search_field.send_keys(athlete_name)
        print(f"Typed '{athlete_name}' into search field.")
        time.sleep(3)
        
        # Find and click email icon
        print("Looking for email icon in search results...")
        email_icon = None
        
        try:
            print("Looking for email icon with fa-envelope class...")
            email_icon = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "i.fa-envelope")))
            print("Found email icon using fa-envelope class")
        except TimeoutException:
            print("No fa-envelope icon found, trying fallback...")
            try:
                icons = driver.find_elements(By.CSS_SELECTOR, "i[class*='fa']")
                for icon in icons:
                    if icon.is_displayed() and icon.is_enabled():
                        class_attr = icon.get_attribute("class") or ""
                        if "envelope" in class_attr.lower() or "mail" in class_attr.lower():
                            email_icon = icon
                            print(f"Found potential email icon with classes: {class_attr}")
                            break
                        elif email_icon is None:
                            email_icon = icon
                            print(f"Using fallback icon with classes: {class_attr}")
            except Exception as e:
                print(f"Fallback search failed: {e}")
        
        if email_icon is None:
            raise TimeoutException("Could not find any email icon in search results")
        
        print("Clicking email icon...")
        email_icon.click()
        print("Email icon clicked successfully.")
        
        print("Waiting for email template popup...")
        time.sleep(1.5)
        
        # Click the first option to activate dropdown
        first_option_selector_css = f"{TEMPLATE_DROPDOWN_SELECTOR} > option:nth-child(1)"
        try:
            first_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, first_option_selector_css)))
            first_option.click()
            print("Clicked the first option.")
        except TimeoutException:
            print("Could not click the first option. The dropdown might already be open.")
        
        # Wait for options to load
        time.sleep(2)
        
        # Select "Editing Done" template (option 2)
        editing_done_option_selector = f"{TEMPLATE_DROPDOWN_SELECTOR} > option:nth-child(2)"
        print(f"Selecting 'Editing Done' template: {editing_done_option_selector}")
        editing_done_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, editing_done_option_selector)))
        editing_done_option.click()
        print("Selected 'Editing Done' template.")
        
        time.sleep(2)
        
        # Click send email button
        print(f"Clicking send email button: {SEND_EMAIL_BUTTON_SELECTOR}")
        send_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, SEND_EMAIL_BUTTON_SELECTOR)))
        send_button.click()
        print("Send email button clicked.")
        
        time.sleep(2)
        
        print(f"--- 'Editing Done' Email Sent Successfully for {athlete_name} ---")
        return True
        
    except Exception as e:
        print(f"--- EMAIL AUTOMATION ERROR --- Details: {str(e)}")
        return False

def update_video_info_in_browser(driver, args):
    print("--- Starting Video Automation ---")
    wait = WebDriverWait(driver, DEFAULT_WAIT_TIMEOUT)
    short_wait = WebDriverWait(driver, SHORT_WAIT_TIMEOUT)

    print(f"Adding video for: {args.athlete_name}, Link: {args.youtube_link}, Season: {args.season}, Type: {args.video_type}")

    try:
        print(f"Navigating to: {BASE_URL}")
        if driver.current_url != BASE_URL:
            driver.get(BASE_URL)
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
            print(f"Successfully navigated to: {BASE_URL}")

        print(f"Searching for athlete: {args.athlete_name}")
        search_field = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, SEARCH_FIELD_SELECTOR)))
        search_field.clear()
        search_field.send_keys(args.athlete_name)
        print(f"Typed '{args.athlete_name}' into search field.")
        time.sleep(1)

        print("Finding person icon...")
        person_icon_element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, PERSON_ICON_SELECTOR)))
        person_anchor_element = person_icon_element.find_element(By.XPATH, "./ancestor::a[1]")
        if not person_anchor_element:
            raise NoSuchElementException("Could not find profile link for the person icon.")
        profile_url = person_anchor_element.get_attribute("href")
        if not profile_url:
            raise ValueError("Profile link does not have an href attribute.")
        print(f"Navigating to profile: {profile_url}")
        driver.get(profile_url)
        
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#profile_main_section"))) 
        print("Profile page loaded.")

        print("Navigating to video tab...")
        video_tab_clicked = False
        try:
            video_tab = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, VIDEO_TAB_SELECTOR_CSS)))
            video_tab.click()
            video_tab_clicked = True
            print("Video tab clicked using primary selector.")
        except TimeoutException:
            print("Primary video tab selector failed. Trying fallbacks...")
            for i, selector_info in enumerate(VIDEO_TAB_FALLBACK_SELECTORS):
                try:
                    fallback_video_tab = WebDriverWait(driver, VERY_SHORT_WAIT_TIMEOUT).until(
                        EC.element_to_be_clickable((selector_info['by'], selector_info['value']))
                    )
                    fallback_video_tab.click()
                    video_tab_clicked = True
                    print(f"Video tab clicked using fallback selector #{i + 1}.")
                    break 
                except TimeoutException:
                    print(f"Fallback selector #{i + 1} failed.")
        
        if not video_tab_clicked:
            raise TimeoutException("All video tab selectors failed.")

        # Click the initial 'Edit' button to reveal the new video form
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, EDIT_BUTTON_SELECTOR)))
        print("Video tab content loaded.")
        print("Clicking initial 'Edit' button...")
        edit_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, EDIT_BUTTON_SELECTOR)))
        edit_button.click()
        print("Initial 'Edit' button clicked.")

        # Fill video form
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, VIDEO_URL_INPUT_SELECTOR)))
        print("Video form loaded.")

        print("Filling video form...")
        video_url_input = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, VIDEO_URL_INPUT_SELECTOR)))
        video_url_input.clear()
        video_url_input.send_keys(args.youtube_link)
        print(f"Filled Video URL: {args.youtube_link}")

        title_input = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, TITLE_INPUT_SELECTOR)))
        title_input.clear()
        title_input.send_keys(args.season)
        print(f"Filled Title (Season): {args.season}")

        description_input = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, DESCRIPTION_INPUT_SELECTOR)))
        description_input.clear()
        description_input.send_keys(args.video_type)
        print(f"Filled Description (Video Type): {args.video_type}")

        current_date_str = datetime.now().strftime("%m/%d/%Y")
        date_input = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, DATE_INPUT_SELECTOR)))
        driver.execute_script("arguments[0].value = '';", date_input)
        date_input.send_keys(current_date_str)
        print(f"Filled Date: {current_date_str}")

        approved_checkbox = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, APPROVED_VIDEO_CHECKBOX_SELECTOR)))
        if not approved_checkbox.is_selected():
            driver.execute_script("arguments[0].click();", approved_checkbox)
        print("Checked 'Approved Video'.")
        time.sleep(0.5)

        print("Clicking 'Add Video' button...")
        add_video_button_element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ADD_VIDEO_BUTTON_SELECTOR)))
        driver.execute_script("arguments[0].click();", add_video_button_element)
        print("'Add Video' button clicked.")

        print("Handling potential alert...")
        time.sleep(VERY_SHORT_WAIT_TIMEOUT)
        try:
            alert = driver.switch_to.alert
            print(f"Alert found with text: {alert.text}. Accepting it.")
            alert.accept()
            print("Alert accepted.")
        except NoAlertPresentException:
            print("No alert was present after clicking 'Add Video'.")
        
        print("Pausing after alert handling...")
        time.sleep(2)
        
        # Click second "Save Changes" button
        print("Clicking 'Save Changes' button (post-alert)...")
        video_update_successful = False
        try:
            post_alert_save_button = short_wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, POST_ALERT_SAVE_CHANGES_BUTTON_SELECTOR)))
            driver.execute_script("arguments[0].click();", post_alert_save_button)
            print("'Save Changes' button (post-alert) clicked.")
            time.sleep(2)
            video_update_successful = True
            print("--- VIDEO UPDATE PROCESS COMPLETED SUCCESSFULLY ---")
        except TimeoutException:
            print("Could not find 'Save Changes' button (post-alert). Assuming success from alert handling.")
            video_update_successful = True
            print("--- VIDEO ADDED, POST-ALERT SAVE SKIPPED ---")

        # Send "Editing Done" email
        if video_update_successful:
            print("--- STARTING EMAIL AUTOMATION PHASE ---")
            email_sent = send_editing_done_email(driver, args.athlete_name)
            if email_sent:
                print("--- VIDEO UPDATE AND EMAIL AUTOMATION COMPLETED SUCCESSFULLY ---")
            else:
                print("--- VIDEO UPDATE SUCCESSFUL BUT EMAIL AUTOMATION FAILED ---")
        else:
            print("--- VIDEO UPDATE FAILED, SKIPPING EMAIL AUTOMATION ---")

    except Exception as e:
        print(f"--- AUTOMATION ERROR --- Details: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc(file=sys.stdout)
    finally:
        print("--- Video Update Script Finished ---")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update video information for an athlete profile")
    parser.add_argument('--athlete_name', required=True, help="Name of the athlete to search for")
    parser.add_argument('--youtube_link', required=True, help="URL of the YouTube video")
    parser.add_argument('--season', required=True, help="Season information")
    parser.add_argument('--video_type', required=True, help="Type of video")

    args = parser.parse_args()

    print("Setting up WebDriver...")
    driver = None
    try:
        from selenium.webdriver.chrome.service import Service as ChromeService
        from selenium.webdriver.chrome.options import Options

        options = Options()
        user_data_dir = os.path.expanduser("~/selenium_chrome_profile")
        print(f"Using user data directory: {user_data_dir}")
        options.add_argument(f"--user-data-dir={user_data_dir}")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--start-maximized")
        
        chromedriver_path = "/opt/homebrew/bin/chromedriver"
        print(f"Using system ChromeDriver: {chromedriver_path}")
        service = ChromeService(executable_path=chromedriver_path)
        
        print("Creating WebDriver...")
        driver = webdriver.Chrome(service=service, options=options)
        print(f"WebDriver created. Browser: {driver.capabilities.get('browserName', 'unknown')}")
        print(f"Browser version: {driver.capabilities.get('browserVersion', 'unknown')}")
        driver.implicitly_wait(5)

        update_video_info_in_browser(driver, args)

    except Exception as e:
        print(f"An error occurred: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc(file=sys.stdout)
    finally:
        if driver:
            print("Closing the browser...")
            driver.quit()
