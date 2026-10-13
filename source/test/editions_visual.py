"""Screenshots + checks of the edition picker, theming and rules sheets.  usage: python3 test/editions_visual.py <html> <outdir>"""
import sys, os
from playwright.sync_api import sync_playwright
html = os.path.abspath(sys.argv[1]); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto('file://' + html); page.wait_for_selector('.setup')
    assert page.locator('.ed').count() == 3
    assert page.locator('.ed[aria-pressed="true"]').get_attribute('data-ed') == 'spiderman'
    for ed in ['spiderman', 'groot', 'boba']:
        page.click(f'.ed[data-ed="{ed}"]')
        assert page.locator('html').get_attribute('data-ed') == ed
        assert page.locator('.ed[aria-pressed="true"]').get_attribute('data-ed') == ed
        page.screenshot(path=f'{out}/setup-{ed}.png')
        page.click('.edblurb [data-act="rules"]'); page.wait_for_selector('#overlay .rules')
        names = page.locator('#overlay .pgrid .pcard').count()
        assert names == 10, names
        page.locator('#overlay .pgrid').scroll_into_view_if_needed()
        page.screenshot(path=f'{out}/rules-{ed}.png')
        # long-form text must not overflow its card
        over = page.evaluate("""() => [...document.querySelectorAll('#overlay .pcard')].filter(c => c.scrollHeight > c.clientHeight + 2).map(c => c.dataset.power)""")
        print(ed, 'overflowing power cards:', over)
        page.click('#overlay [data-res="close"]')
    # setting persists across reload
    page.reload(); page.wait_for_selector('.setup')
    assert page.locator('.ed[aria-pressed="true"]').get_attribute('data-ed') == 'boba'
    # start a game in boba, check themed game screen + wording
    page.click('[data-act="start"]'); page.wait_for_selector('.game')
    page.wait_for_selector('.centerpower .pcard')
    assert 'Boba Fett' in page.locator('.logo').inner_text()
    txt = page.locator('.centerpower .hint').inner_text(); print('hint:', txt)
    assert 'Figure' in txt
    page.screenshot(path=f'{out}/game-boba.png')
    page.click('.topbar [data-act="menu"]'); page.click('#overlay [data-res="quit"]'); page.wait_for_selector('.setup')
    page.click('.ed[data-ed="groot"]'); page.click('[data-act="start"]'); page.wait_for_selector('.centerpower .pcard')
    assert 'Mover' in page.locator('.centerpower .hint').inner_text()
    page.screenshot(path=f'{out}/game-groot.png')
    b.close()
print('ERRORS' if errors else 'no errors', errors)
sys.exit(1 if errors else 0)
