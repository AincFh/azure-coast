"""Real Chromium end-to-end assertions: run with python scripts/browser-qa.py.

Requires: pip install playwright==1.56.0; python -m playwright install chromium
This is a QA job, not a substitute for game quality review or release approval.
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.getenv('AZURE_QA_URL', 'http://127.0.0.1:18765')
OUT = Path('artifacts/browser-qa')
OUT.mkdir(parents=True, exist_ok=True)
SIZES = [(375, 812), (768, 1024), (1024, 768), (1440, 900)]

async def check_no_horizontal_overflow(page, label):
    numbers = await page.evaluate('''() => ({width: innerWidth, scroll: document.documentElement.scrollWidth})''')
    assert numbers['scroll'] <= numbers['width'] + 2, f'{label}: horizontal overflow {numbers}'

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=[
            '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        ])
        try:
            for width, height in SIZES:
                context = await browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
                page = await context.new_page()
                page_errors = []
                shader_errors = []
                page.on('pageerror', lambda err: page_errors.append(str(err)))
                page.on('console', lambda msg: shader_errors.append(msg.text)
                        if msg.type == 'error' and ('WebGLProgram' in msg.text or 'shader' in msg.text.lower()) else None)
                label = str(width)
                try:
                    await page.goto(BASE + '/', wait_until='domcontentloaded')
                    await page.locator('#view').wait_for(timeout=10000)
                    await check_no_horizontal_overflow(page, f'home {label}')
                    await page.screenshot(path=str(OUT / f'{label}-home.png'), full_page=True, timeout=60000, animations='disabled')

                    await page.goto(BASE + '/explore.html', wait_until='domcontentloaded')
                    await page.locator('#districts [data-district="bay"]').wait_for(timeout=12000)
                    assert await page.locator('link[href="/explore-fixes.css"]').count() == 1
                    await page.locator('#districts [data-district="bay"]').click()
                    await page.locator('#addStop').click()
                    await page.locator('#districts [data-district="marina"]').click()
                    await page.locator('#addStop').click()
                    assert '2' in await page.locator('#stopsCount').inner_text()
                    await page.locator('#weather').select_option('rain')
                    await page.locator('#time').evaluate('''e => {e.value='20';e.dispatchEvent(new Event('input',{bubbles:true}))}''')
                    assert '2 站' in await page.locator('#launchDrive').inner_text()
                    await check_no_horizontal_overflow(page, f'explore {label}')
                    await page.screenshot(path=str(OUT / f'{label}-explore.png'), full_page=True, timeout=60000, animations='disabled')

                    await page.locator('#launchDrive').click()
                    await page.locator('#game canvas').wait_for(timeout=45000)
                    await page.locator('#begin').click()
                    await page.locator('#navDestination').wait_for(state='visible', timeout=10000)
                    assert await page.locator('#navDestination').inner_text() == '海湾中心'
                    assert '雨天' in await page.locator('#environmentLabel').inner_text()
                    await page.locator('#mapBtn').click()
                    await page.locator('#mapOverlay').wait_for(state='visible')
                    await page.locator('#mapStopList [data-stop-id="cliff"]').click()
                    assert await page.locator('#navDestination').inner_text() == '日落山崖'
                    await page.screenshot(path=str(OUT / f'{label}-map.png'), timeout=90000, animations='disabled')
                    await page.locator('#mapClose').click()
                    await page.reload(wait_until='domcontentloaded')
                    await page.locator('#game canvas').wait_for(timeout=45000)
                    assert await page.locator('#navDestination').inner_text() == '日落山崖', 'Journey was not restored'
                    await page.locator('#begin').click()
                    await page.locator('#environmentHour').evaluate("""e => {e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}))}""")
                    await page.locator('#environmentWeather').select_option('clear')
                    await page.wait_for_timeout(450)
                    await page.screenshot(path=str(OUT / f'{label}-drive.png'), timeout=90000, animations='disabled')
                    assert not page_errors, f'Browser script errors at {label}: {page_errors}'
                    assert not shader_errors, f'WebGL shader errors at {label}: {shader_errors}'
                    print(f'PASS {label}px — homepage, planner, engine, map selection, persistence')
                except Exception:
                    try:
                        await page.screenshot(path=str(OUT / f'{label}-failure.png'), timeout=10000, animations='disabled')
                    except Exception as capture_error:
                        print(f'Unable to capture failure screenshot: {capture_error}')
                    print(f'Browser errors at {label}px: {page_errors}')
                    raise
                finally:
                    await context.close()
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
