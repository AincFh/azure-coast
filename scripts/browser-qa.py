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
ALL_SIZES = [(375, 812), (768, 1024), (1024, 768), (1440, 900)]
VIEWPORT_FILTER = os.getenv('AZURE_QA_VIEWPORT')
SIZES = [size for size in ALL_SIZES if VIEWPORT_FILTER in (None, str(size[0]))]
if not SIZES:
    raise ValueError('Unknown AZURE_QA_VIEWPORT (expected 375, 768, 1024 or 1440)')

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
                # Fund the test wallet BEFORE the first 3D page initializes.
                # This avoids two extra software-WebGL reloads at 1440px.
                if width == 1440:
                    await context.add_init_script("""(() => {
                      if (location.pathname === '/play.html' && !localStorage.getItem('azure-qa-funded')) {
                        const saved = JSON.parse(localStorage.getItem('azure-coast-driving-v2')||'{}');
                        saved.credits = 20000;
                        localStorage.setItem('azure-coast-driving-v2', JSON.stringify(saved));
                        localStorage.setItem('azure-qa-funded','1');
                      }
                    })();""")
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
                    await page.wait_for_function("""() => {
                        const text=document.getElementById('trafficStatus')?.textContent||'';
                        return text.startsWith('交通 ') && text.includes('/45') && text.includes('km/h');
                    }""", timeout=20000)
                    await page.locator('#navDestination').wait_for(state='attached', timeout=10000)
                    assert await page.locator('#navDestination').text_content() == '海湾中心'
                    assert '雨天' in await page.locator('#environmentLabel').inner_text()
                    await page.locator('#activityOpen').click()
                    await page.locator('#activityPanel').wait_for(state='visible', timeout=10000)
                    assert await page.locator('#activityOfferList [data-activity-id]').count() == 3
                    await page.locator('#activityOfferList [data-activity-id="courier"]').click()
                    await page.locator('#activityName').wait_for(state='attached', timeout=10000)
                    assert await page.locator('#activityName').text_content() == '海岸运送'
                    assert '海湾收件点' in await page.locator('#activityStage').inner_text()
                    state = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-city-services-v1'))""")
                    assert state['id'] == 'courier' and state['index'] == 0
                    if width <= 850:
                        toggle = page.locator('#hudDetailsBtn')
                        await toggle.wait_for(state='visible')
                        assert await toggle.get_attribute('aria-expanded') == 'false'
                        assert not await page.locator('#navStatus').is_visible(), 'Collapsed HUD still covers the 3D world'
                        await toggle.click()
                        assert await toggle.get_attribute('aria-expanded') == 'true'
                        assert await page.locator('#navStatus').is_visible()
                        assert await page.locator('#activityHud').is_visible()
                        await page.screenshot(path=str(OUT / f'{label}-hud-expanded.png'), timeout=60000, animations='disabled')
                        await toggle.click()
                        assert not await page.locator('#navStatus').is_visible()
                    await page.locator('#activityOpen').click()
                    assert '海岸运送' in await page.locator('#activityActiveDetail').inner_text()
                    await page.locator('#activityClose').click()
                    await page.locator('#garageOpen').click()
                    await page.locator('#garagePanel').wait_for(state='visible', timeout=10000)
                    assert await page.locator('#garageOfferList .garage-upgrade').count() == 3
                    assert '可购买' in await page.locator('#garageAccess').inner_text()
                    if width == 1440:
                        await page.locator('#garageOfferList [data-upgrade="engine"]').click()
                        wallet = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert wallet['credits'] == 18200, 'Upgrade did not debit the driving wallet'
                        assert wallet['garage']['engine'] == 1, 'Upgrade was not persisted atomically'
                    await page.locator('#garageClose').click()
                    await page.locator('#housingOpen').click()
                    await page.locator('#housingPanel').wait_for(state='visible', timeout=10000)
                    assert await page.locator('#housingList .housing-card').count() == 4
                    if width == 1440:
                        await page.locator('#housingList [data-buy-house="coastal-starter"]').click()
                        bought = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert 'coastal-starter' in bought['housing']['owned']
                        assert bought['credits'] == 10200, 'First home did not debit the existing wallet'
                        await page.locator('#housingClose').click()
                        await page.locator('#enterBtn').click()
                        await page.locator('#housingOpen').click()
                        await page.locator('#housingList [data-enter-house="coastal-starter"]').click()
                        await page.wait_for_function("""() => document.body.classList.contains('home-interior')""", timeout=20000)
                        assert await page.locator('#interiorHud').is_visible()
                        await page.locator('#interiorDecorate').click()
                        await page.locator('#furnishPanel').wait_for(state='visible', timeout=10000)
                        await page.locator('#furnishSlots [data-furniture-slot="4"]').click()
                        await page.locator('#furnishOffers [data-buy-furniture="sofa"]').click()
                        await page.locator('#furnishRotate').click()
                        await page.locator('[data-furniture-move="right"]').click()
                        home = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert home['credits'] == 9000, 'Furniture purchase did not debit wallet'
                        assert home['housing']['rooms']['coastal-starter'][0]['slot'] == 5
                        assert home['housing']['rooms']['coastal-starter'][0]['rotation'] == 1
                        await page.locator('#furnishClose').click()
                        await page.screenshot(path=str(OUT / f'{label}-interior.png'), timeout=90000, animations='disabled')
                        await page.locator('#interiorExit').click()
                        assert not await page.evaluate("""() => document.body.classList.contains('home-interior')""")
                        await page.locator('#enterBtn').click()
                    else:
                        await page.locator('#housingClose').click()
                    await page.locator('#mapBtn').click()
                    await page.locator('#mapOverlay').wait_for(state='visible')
                    await page.locator('#mapStopList [data-stop-id="cliff"]').click()
                    assert await page.locator('#navDestination').text_content() == '日落山崖'
                    await page.screenshot(path=str(OUT / f'{label}-map.png'), timeout=90000, animations='disabled')
                    await page.locator('#mapClose').click()
                    # Reopen in a fresh tab rather than reloading an active
                    # software-WebGL canvas. Same browser context retains saves.
                    await page.close()
                    page = await context.new_page()
                    page.on('pageerror', lambda err: page_errors.append(str(err)))
                    page.on('console', lambda msg: shader_errors.append(msg.text)
                            if msg.type == 'error' and ('WebGLProgram' in msg.text or 'shader' in msg.text.lower()) else None)
                    await page.goto(BASE + '/play.html', wait_until='domcontentloaded', timeout=90000)
                    await page.locator('#game canvas').wait_for(timeout=60000)
                    assert await page.locator('#navDestination').text_content() == '日落山崖', 'Journey was not restored'
                    assert await page.locator('#activityName').text_content() == '海岸运送', 'Contract was not restored'
                    if width == 1440:
                        restored_wallet = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert restored_wallet['credits'] == 9000, 'Shared garage and housing debits were lost on reload'
                        assert restored_wallet['garage']['engine'] == 1, 'Engine upgrade was lost on reload'
                        assert 'coastal-starter' in restored_wallet['housing']['owned']
                        assert restored_wallet['housing']['rooms']['coastal-starter'][0]['slot'] == 5, 'Furniture location was lost on reload'
                    await page.locator('#begin').click()
                    await page.locator('#environmentHour').evaluate("""e => {e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}))}""")
                    await page.locator('#environmentWeather').evaluate("""e => {e.value='clear';e.dispatchEvent(new Event('change',{bubbles:true}))}""")
                    await page.wait_for_timeout(450)
                    await page.screenshot(path=str(OUT / f'{label}-drive.png'), timeout=90000, animations='disabled')
                    assert not page_errors, f'Browser script errors at {label}: {page_errors}'
                    assert not shader_errors, f'WebGL shader errors at {label}: {shader_errors}'
                    print(f'PASS {label}px — home, 3D driving, jobs, garage, housing interiors, furnishings, traffic, reload persistence')
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
