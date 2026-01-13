from playwright.sync_api import sync_playwright
import time

def verify_free_exam():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            print("Navigating to Free Exam page...")
            page.goto("http://localhost:8080/free-exam")

            # Wait a bit for query to resolve (or fail)
            time.sleep(5)

            # Take a screenshot
            screenshot_path = "/home/jules/verification/free_exam_page.png"
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_free_exam()
