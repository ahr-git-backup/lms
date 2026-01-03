import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Emulate iPhone 12 Pro
        iphone_12_pro = p.devices['iPhone 12 Pro']
        context = await browser.new_context(**iphone_12_pro)
        page = await context.new_page()

        print("Navigating to local dev server...")
        try:
            await page.goto("http://localhost:8080", timeout=60000)
            await page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Error navigating: {e}")
            await browser.close()
            return

        print("Taking mobile screenshot of landing page...")
        await page.screenshot(path="landing_mobile.png", full_page=True)

        print("Taking mobile header screenshot...")
        # Capture just the top part
        await page.screenshot(path="landing_mobile_header.png", clip={"x": 0, "y": 0, "width": 390, "height": 100})

        # Try to click the menu button if it exists
        print("Checking for menu button...")
        # The menu button is likely an svg inside a button
        # I'll look for aria-label="Menu" which I added
        try:
            menu_btn = page.locator('button[aria-label="Menu"]')
            if await menu_btn.count() > 0:
                print("Menu button found! Clicking...")
                await menu_btn.click()
                await page.wait_for_timeout(1000) # Wait for sheet animation
                await page.screenshot(path="landing_mobile_menu_open.png")
                print("Menu open screenshot taken.")
            else:
                print("Menu button NOT found.")
        except Exception as e:
            print(f"Error interacting with menu: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
