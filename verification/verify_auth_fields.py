import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        print("Navigating to Register page...")
        try:
            await page.goto("http://localhost:8080/register", timeout=60000)
            await page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Error navigating to register: {e}")
            await browser.close()
            return

        print("Checking for Registration fields...")

        fields = [
            "Own Name",
            "Phone Number",
            "Father's Name",
            "Mother's Name",
            "College Name",
            "HSC Batch",
            "Email (Optional)",
            "SSC GPA (Out of 5)",
            "HSC GPA (Optional)",
            "I am a Second Timer Student"
        ]

        missing_fields = []
        for field in fields:
            # Try by label text
            try:
                if "Second Timer" in field:
                    # Checkbox label might be tricky
                    element = page.get_by_text("I am a Second Timer Student")
                else:
                    element = page.get_by_label(field)

                if await element.count() > 0:
                    print(f"✅ Found field: {field}")
                else:
                    # Try fuzzy text match if label exact match fails
                    element = page.get_by_text(field)
                    if await element.count() > 0:
                        print(f"✅ Found field (by text): {field}")
                    else:
                        print(f"❌ Missing field: {field}")
                        missing_fields.append(field)
            except Exception as e:
                print(f"❌ Error checking {field}: {e}")
                missing_fields.append(field)

        await page.screenshot(path="verification/register_fields.png", full_page=True)

        print("\nNavigating to Login page...")
        await page.goto("http://localhost:8080/login")
        await page.wait_for_load_state("networkidle")

        print("Checking Login fields...")
        try:
            phone_input = page.get_by_label("Phone Number")
            if await phone_input.count() > 0:
                 print("✅ Found Login Phone Number field")
            else:
                 print("❌ Missing Login Phone Number field")
        except:
             print("❌ Error checking Login Phone Number field")

        await page.screenshot(path="verification/login_fields.png")

        await browser.close()

        if missing_fields:
            print(f"\nFAILED: Missing fields: {missing_fields}")
            exit(1)
        else:
            print("\nSUCCESS: All fields verified.")

if __name__ == "__main__":
    asyncio.run(run())
