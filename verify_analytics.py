import time
import random
import string
from playwright.sync_api import sync_playwright, expect

def generate_random_string(length=8):
    return ''.join(random.choices(string.digits, k=length))

def verify_analytics():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Increase timeout for slow dev server
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

        # 1. Register
        print("Navigating to Register...")
        try:
            page.goto("http://localhost:8080/register", timeout=30000)
        except Exception as e:
            print(f"Failed to load register page: {e}")
            browser.close()
            return

        # Wait for form
        try:
            page.wait_for_selector("form", timeout=10000)
        except:
            print("Form not found")
            page.screenshot(path="register_fail_load.png")
            browser.close()
            return

        random_suffix = generate_random_string()
        email = f"test_{random_suffix}@example.com"
        password = "password123"

        print(f"Registering with {email}...")

        page.fill('input[name="fullName"]', f"Test User {random_suffix}")
        page.fill('input[name="phone"]', f"017{generate_random_string(8)}") # Random phone
        page.fill('input[name="email"]', email)
        page.fill('input[name="fatherName"]', "Father")
        page.fill('input[name="motherName"]', "Mother")
        page.fill('input[name="collegeName"]', "College")
        page.fill('input[name="hscBatch"]', "2024")
        page.fill('input[name="sscGpa"]', "5.00")

        page.fill('input[name="password"]', password)
        page.fill('input[name="confirmPassword"]', password)

        page.click('button[type="submit"]')

        # Wait for navigation to dashboard
        # It might take time for Supabase to respond
        try:
            page.wait_for_url("**/dashboard", timeout=15000)
            print("Registration successful, redirected to dashboard.")
        except:
            # Check if we are stuck or showed error
            print("Did not redirect to dashboard.")
            page.screenshot(path="register_stuck.png")
            # Check for toast
            # If email verification is needed, we might be redirected to login
            if "login" in page.url:
                 print("Redirected to login (Email verification likely required).")
            elif "register" in page.url:
                 print("Still on register page.")

            browser.close()
            return

        # 2. Navigate to Analytics
        print("Navigating to Analytics...")
        page.goto("http://localhost:8080/dashboard/analytics")

        # 3. Wait for content
        # It might show "No exams found" or the table.
        # Wait for "Exam Analysis Report" header
        try:
            expect(page.get_by_text("Exam Analysis Report")).to_be_visible(timeout=10000)
            # Wait a bit for data loading
            time.sleep(2)
        except:
            print("Analytics page header not found.")
            page.screenshot(path="analytics_fail.png")

        # 4. Take Screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_analytics()
