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

async def open_city_system(page, width, name):
    """Exercise the real action sheet on phone/tablet; the full control on desktop."""
    if width <= 850:
        menu = page.locator('#actionMenuBtn')
        await menu.click()
        await page.locator('#actionDrawer').wait_for(state='visible', timeout=10000)
        await page.locator(f'#actionDrawer [data-action-proxy="{name}"]').click()
        assert await menu.get_attribute('aria-expanded') == 'false'
        assert not await page.locator('#actionDrawer').is_visible()
    else:
        await page.locator('#' + name).click()

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
                        saved.credits = 140000;
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
                    await page.locator('#audioOpen').click()
                    await page.locator('#audioPanel').wait_for(state='visible',timeout=10000)
                    await page.locator('#audio-master').evaluate("""e => {
                        e.value='36';e.dispatchEvent(new Event('input',{bubbles:true}));
                    }""")
                    assert '36%' in await page.locator('#audioValue-master').inner_text()
                    await page.locator('#audioMute').check()
                    saved_audio=await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2')).audio""")
                    assert saved_audio['muted'] is True
                    await page.locator('#audioMute').uncheck()
                    await page.locator('#audioTest').click()
                    await page.locator('#audioClose').click()
                    saved_audio=await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2')).audio""")
                    assert saved_audio['muted'] is False
                    assert abs(saved_audio['master']-.36) < .00001
                    # Real living-citizen interaction: leave the vehicle,
                    # meet the greeter physically standing at the starting
                    # sidewalk, talk twice and persist the same relationship.
                    await page.locator('#enterBtn').click()
                    await page.wait_for_function("""() => document.getElementById('mode')?.textContent?.includes('步行')""",timeout=10000)
                    await open_city_system(page, width, 'citizenOpen')
                    await page.locator('#citizenPanel').wait_for(state='visible',timeout=12000)
                    assert '许' in await page.locator('#citizenOccupation').inner_text() or '市中心' in await page.locator('#citizenOccupation').inner_text()
                    assert await page.locator('#citizenTopics [data-citizen-topic]').count() == 5
                    await page.locator('#citizenTopics [data-citizen-topic="greeting"]').click()
                    await page.locator('#citizenTopics [data-citizen-topic="neighborhood"]').click()
                    await page.wait_for_function("""() => {
                      const saved=JSON.parse(localStorage.getItem('azure-coast-driving-v2')||'{}');
                      return saved.citizens?.met?.includes(4) &&
                        saved.citizens?.conversations===2;
                    }""",timeout=10000)
                    assert '关系 2/3' in await page.locator('#citizenTrait').inner_text()
                    await page.screenshot(path=str(OUT / f'{label}-conversation.png'),timeout=25000,animations='disabled')
                    await page.locator('#citizenClose').click()
                    await page.locator('#enterBtn').click()
                    await page.wait_for_function("""() => document.getElementById('mode')?.textContent?.includes('车辆驾驶')""",timeout=10000)
                    if width <= 850:
                        assert await page.locator('#actionMenuBtn').is_visible()
                        assert not await page.locator('#activityOpen').is_visible()
                        assert not await page.locator('#fleetOpen').is_visible()
                        await page.locator('#actionMenuBtn').click()
                        assert await page.locator('#actionDrawer [data-action-proxy]').count() == 5
                        await page.locator('#actionClose').click()
                    await page.wait_for_function("""() => {
                        const text=document.getElementById('trafficStatus')?.textContent||'';
                        return text.startsWith('交通 ') && text.includes('/45') && text.includes('km/h');
                    }""", timeout=20000)
                    await page.locator('#navDestination').wait_for(state='attached', timeout=10000)
                    assert await page.locator('#navDestination').text_content() == '海湾中心'
                    assert '雨天' in await page.locator('#environmentLabel').inner_text()
                    await open_city_system(page, width, 'activityOpen')
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
                    await open_city_system(page, width, 'activityOpen')
                    assert '海岸运送' in await page.locator('#activityActiveDetail').inner_text()
                    await page.locator('#activityClose').click()
                    await open_city_system(page, width, 'garageOpen')
                    await page.locator('#garagePanel').wait_for(state='visible', timeout=10000)
                    assert await page.locator('#garageOfferList .garage-upgrade').count() == 3
                    assert '可购买' in await page.locator('#garageAccess').inner_text()
                    if width == 1440:
                        await page.locator('#garageOfferList [data-upgrade="engine"]').click()
                        wallet = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert wallet['credits'] == 138200, 'Upgrade did not debit the driving wallet'
                        assert wallet['garage']['engine'] == 1, 'Upgrade was not persisted atomically'
                    await page.locator('#garageClose').click()
                    await open_city_system(page, width, 'housingOpen')
                    await page.locator('#housingPanel').wait_for(state='visible', timeout=10000)
                    assert await page.locator('#housingList .housing-card').count() == 4
                    if width == 1440:
                        await page.locator('#housingList [data-buy-house="coastal-starter"]').click()
                        bought = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert 'coastal-starter' in bought['housing']['owned']
                        assert bought['credits'] == 130200, 'First home did not debit the existing wallet'
                        await page.locator('#housingClose').click()
                        await page.locator('#enterBtn').click()
                        await open_city_system(page, width, 'housingOpen')
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
                        assert home['credits'] == 129000, 'Furniture purchase did not debit wallet'
                        assert home['housing']['rooms']['coastal-starter'][0]['slot'] == 5
                        assert home['housing']['rooms']['coastal-starter'][0]['rotation'] == 1
                        await page.locator('#furnishClose').click()
                        await page.screenshot(path=str(OUT / f'{label}-interior.png'), timeout=90000, animations='disabled')
                        await page.locator('#interiorExit').click()
                        assert not await page.evaluate("""() => document.body.classList.contains('home-interior')""")
                        await page.locator('#enterBtn').click()
                        # Purchase a catalogue vehicle, really replace the live
                        # 3D car model, then verify the existing wallet changes.
                        await open_city_system(page, width, 'fleetOpen')
                        await page.locator('#fleetPanel').wait_for(state='visible', timeout=15000)
                        assert await page.locator('#fleetVehicleList .fleet-card').count() == 7
                        await page.locator('#fleetVehicleList [data-fleet-preview="tide"]').click()
                        assert 'TIDE E' in await page.locator('#fleetPreviewName').inner_text()
                        await page.locator('#fleetVehicleList [data-fleet-buy="tide"]').click()
                        after_buy = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert after_buy['credits'] == 33000, 'Vehicle sale did not debit original wallet'
                        assert 'tide' in after_buy['fleet']['owned'], 'Purchased EV not in inventory'
                        await page.locator('#fleetVehicleList [data-fleet-drive="tide"]').click()
                        assert 'TIDE E' in await page.locator('#fleetActiveName').inner_text()
                        assert 'TIDE E' in await page.locator('#fleetCurrent').inner_text()
                        after_switch = await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert after_switch['fleet']['active'] == 'tide', 'Equipped vehicle not saved'
                        await page.locator('#fleetClose').click()
                    else:
                        await page.locator('#housingClose').click()
                        await open_city_system(page, width, 'fleetOpen')
                        await page.locator('#fleetPanel').wait_for(state='visible', timeout=12000)
                        assert await page.locator('#fleetVehicleList .fleet-card').count() == 7
                        await page.locator('#fleetClose').click()
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
                        assert restored_wallet['credits'] == 33000, 'Shared garage and housing debits were lost on reload'
                        assert restored_wallet['garage']['engine'] == 1, 'Engine upgrade was lost on reload'
                        assert restored_wallet['fleet']['active'] == 'tide', 'Selected car was lost on reload'
                        assert 4 in restored_wallet['citizens']['met'], 'Citizen friendship was lost on reload'
                        assert abs(restored_wallet['audio']['master']-.36) < .00001, 'Audio mix was lost on reload'
                        assert 'tide' in restored_wallet['fleet']['owned']
                        assert 'coastal-starter' in restored_wallet['housing']['owned']
                        assert restored_wallet['housing']['rooms']['coastal-starter'][0]['slot'] == 5, 'Furniture location was lost on reload'
                    await page.locator('#begin').click()
                    await page.locator('#environmentHour').evaluate("""e => {e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}))}""")
                    await page.locator('#environmentWeather').evaluate("""e => {e.value='clear';e.dispatchEvent(new Event('change',{bubbles:true}))}""")
                    await page.wait_for_timeout(450)
                    await page.screenshot(path=str(OUT / f'{label}-drive.png'), timeout=90000, animations='disabled')
                    if width == 1440:
                        # Verify that the actual game wallet, ownership and furniture
                        # are visible on the public site's personal profile.
                        await page.close()
                        page = await context.new_page()
                        page.on('pageerror', lambda err: page_errors.append(str(err)))
                        await page.goto(BASE + '/#profile', wait_until='domcontentloaded', timeout=30000)
                        await page.locator('.live-player-summary').wait_for(state='visible', timeout=15000)
                        summary = await page.locator('.live-player-summary').inner_text()
                        assert '33,000' in summary, 'Profile lost actual shared wallet'
                        assert '海湾初始公寓' in summary, 'Profile lost starter property'
                        assert '已购住宅' in summary and '已摆放家具' in summary and 'TIDE E' in summary and '已认识居民' in summary
                        await page.screenshot(path=str(OUT / f'{label}-profile.png'), timeout=25000, animations='disabled')
                        # A catalog-listed house must show ownership rather than
                        # a disconnected favorite button when owned in the game save.
                        await page.evaluate("""() => {
                          const save=JSON.parse(localStorage.getItem('azure-coast-driving-v2'));
                          save.housing.owned.push('harbor-home');
                          save.housing.rooms['harbor-home']=[];
                          localStorage.setItem('azure-coast-driving-v2',JSON.stringify(save));
                        }""")
                        await page.goto(BASE + '/#homes', wait_until='domcontentloaded')
                        await page.reload(wait_until='domcontentloaded')
                        assert '已购入，存档已同步' in await page.locator('#view').inner_text()
                    # Standalone save vault runs without WebGL and is usable
                    # even when the player's device cannot initialize 3D.
                    await page.goto(BASE + '/save.html#saves',wait_until='domcontentloaded',timeout=30000)
                    await page.locator('#saveManagerPanel').wait_for(state='visible',timeout=12000)
                    assert await page.locator('#saveImportApply').is_disabled()
                    await check_no_horizontal_overflow(page, f'save vault {label}')
                    await page.screenshot(path=str(OUT / f'{label}-save-vault.png'),timeout=25000,animations='disabled')
                    if width == 1440:
                        async with page.expect_download(timeout=30000) as download_wait:
                            await page.locator('#saveExport').click()
                        exported=await download_wait.value
                        assert exported.suggested_filename.startswith('azure-coast-full-save-')
                        # Create a valid alternate save without changing the
                        # live wallet before the import transaction.
                        candidate=await page.evaluate("""async () => {
                          const {createSaveArchive}=await import('/save-archive.mjs');
                          const key='azure-coast-driving-v2';
                          const driving=JSON.parse(localStorage.getItem(key));
                          driving.credits=76543;
                          const alternate={getItem:k=>k===key?JSON.stringify(driving):localStorage.getItem(k)};
                          return JSON.stringify(await createSaveArchive(alternate));
                        }""")
                        await page.locator('#saveImportFile').set_input_files({
                          'name':'azure-coast-import-qa.json','mimeType':'application/json',
                          'buffer':candidate.encode('utf-8')
                        })
                        await page.locator('#savePreview').wait_for(state='visible',timeout=12000)
                        assert '$76,543' in await page.locator('#savePreviewWallet').inner_text()
                        assert 'TIDE E' in await page.locator('#savePreviewCars').inner_text()
                        assert await page.locator('#saveImportApply').is_disabled()
                        await page.locator('#saveOverwriteConfirm').check()
                        assert await page.locator('#saveImportApply').is_enabled()
                        await page.locator('#saveImportApply').click()
                        await page.wait_for_function("""() => {
                          const raw=localStorage.getItem('azure-coast-driving-v2');
                          return raw && JSON.parse(raw).credits===76543;
                        }""",timeout=20000)
                        await page.goto(BASE+'/save.html#saves',wait_until='domcontentloaded',timeout=30000)
                        await page.locator('#saveManagerPanel').wait_for(state='visible')
                        await page.locator('#saveUndoImport').wait_for(state='visible')
                        assert await page.locator('#saveUndoImport').is_enabled(), 'Missing safe undo point'
                        await page.locator('#saveUndoImport').click()
                        await page.locator('#savePreview').wait_for(state='visible')
                        assert '$33,000' in await page.locator('#savePreviewWallet').inner_text()
                        await page.locator('#saveOverwriteConfirm').check()
                        await page.locator('#saveImportApply').click()
                        await page.wait_for_function("""() => {
                          const raw=localStorage.getItem('azure-coast-driving-v2');
                          return raw && JSON.parse(raw).credits===33000;
                        }""",timeout=20000)
                        restored=await page.evaluate("""() => JSON.parse(localStorage.getItem('azure-coast-driving-v2'))""")
                        assert restored['fleet']['active']=='tide', 'Recovery lost active vehicle'
                        assert 4 in restored['citizens']['met'], 'Recovery lost resident relationships'
                        assert 'coastal-starter' in restored['housing']['owned'], 'Recovery lost home'
                        assert restored['garage']['engine']==1, 'Recovery lost upgrade'
                        assert abs(restored['audio']['master']-.36)<.00001, 'Recovery lost sound mix'
                    assert not page_errors, f'Browser script errors at {label}: {page_errors}'
                    assert not shader_errors, f'WebGL shader errors at {label}: {shader_errors}'
                    print(f'PASS {label}px — living NPCs, real dialogue, fleet, housing, sound, career, backup and save restore')
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
