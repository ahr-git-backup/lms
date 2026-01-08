from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to Leaderboard...")
            # Use a dummy exam ID. It might fail to load data but UI structure might show.
            # http://localhost:8080/dashboard/leaderboard/some-id
            page.goto("http://localhost:8080/dashboard/leaderboard/123")
            time.sleep(3)

            # Check for Export button text
            try:
                # Wait for the button to be visible if possible, or just screenshot
                page.screenshot(path="verification/leaderboard.png")
                content = page.content()
                if "Export CSV" in content:
                    print("Export CSV button found in page content.")
                else:
                    print("Export CSV button NOT found (maybe loading or access denied).")
            except Exception as e:
                print(f"Screenshot failed: {e}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
