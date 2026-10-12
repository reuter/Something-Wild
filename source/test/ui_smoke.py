"""Drives the real UI in headless Chromium: plays complete games as a (random-clicking) human.
usage: python3 test/ui_smoke.py <html-path> <screenshot-dir> [games] [players]"""
import sys, random, json, time, os
from playwright.sync_api import sync_playwright

html = os.path.abspath(sys.argv[1])
shots = sys.argv[2]
games = int(sys.argv[3]) if len(sys.argv) > 3 else 2
nplayers = int(sys.argv[4]) if len(sys.argv) > 4 else 4
os.makedirs(shots, exist_ok=True)
errors = []
sheet_kinds = {}

def step(page, rnd):
    if page.locator('.win').count():
        return 'win'
    if page.locator('#overlay .sheet').count():
        enabled = page.locator('#overlay [data-res]:not([disabled])')
        n = enabled.count()
        if n == 0:
            return 'wait'
        title = page.locator('#overlay .sheet h2').first.inner_text() if page.locator('#overlay .sheet h2').count() else '?'
        sheet_kinds[title] = sheet_kinds.get(title, 0) + 1
        use = page.locator('#overlay [data-res^="use:"]:not([disabled])')
        if title.startswith('Use a Power') and use.count() and rnd.random() < 0.8:
            use.nth(rnd.randrange(use.count())).click()
        else:
            enabled.nth(rnd.randrange(n)).click()
        return 'acted'
    info = page.evaluate("""() => { const a = window.SWUI.U.ask; return a ? {ids: a.ids, auto: !!a.auto, text: a.text} : null; }""")
    if info:
        sheet_kinds[info['text'].split(':')[0]] = sheet_kinds.get(info['text'].split(':')[0], 0) + 1
        cid = rnd.choice(info['ids'])
        page.locator(f'[data-card="{cid}"].selectable').first.click()
        if not info['auto']:
            page.locator('.promptbar [data-btn="ok"]').click()
        return 'acted'
    return 'wait'

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("""localStorage.setItem('sw-settings', JSON.stringify({players:%d, levels:['easy','hard','unpredictable'], speed:'fast', first:'random'}));""" % nplayers)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto('file://' + html)
    page.wait_for_selector('.setup')
    page.screenshot(path=f'{shots}/01-setup.png', full_page=True)

    # rules sheet opens and closes
    page.click('.topbar [data-act="rules"]')
    page.wait_for_selector('#overlay .rules')
    page.screenshot(path=f'{shots}/02-rules.png')
    page.click('#overlay [data-res="close"]')
    assert page.locator('#overlay .sheet').count() == 0

    results = []
    for g in range(games):
        rnd = random.Random(100 + g)
        page.click('[data-act="start"]') if g == 0 else None
        page.wait_for_selector('.game')
        t0 = time.time(); acted = 0; shot_done = set()
        while True:
            r = step(page, rnd)
            if r == 'win':
                break
            if r == 'acted':
                acted += 1
            else:
                time.sleep(0.05)
            if time.time() - t0 > 240:
                page.screenshot(path=f'{shots}/timeout.png')
                raise SystemExit('TIMEOUT: game did not finish; ' + json.dumps(page.evaluate("({turn: window.SWUI.U.state.turnNo, cur: window.SWUI.U.state.current, ask: !!window.SWUI.U.ask, status: window.SWUI.U.status})")))
            # grab a few representative screenshots in game 0
            if g == 0:
                st = page.evaluate("() => ({turn: window.SWUI.U.state.turnNo, hasAsk: !!window.SWUI.U.ask, askText: window.SWUI.U.ask && window.SWUI.U.ask.text, sheet: document.querySelectorAll('#overlay .sheet').length})")
                if st['hasAsk'] and 'play a card' in (st['askText'] or '') and st['turn'] >= 8 and 'play' not in shot_done:
                    page.screenshot(path=f'{shots}/03-your-turn.png'); shot_done.add('play')
                if st['sheet'] and 'power' not in shot_done:
                    page.screenshot(path=f'{shots}/04-sheet.png'); shot_done.add('power')
        winner = page.evaluate("() => window.SWUI.U.state.players[window.SWUI.U.state.winner].name")
        turns = page.evaluate("() => window.SWUI.U.state.turnNo")
        results.append((winner, turns, acted, round(time.time() - t0, 1)))
        if g == 0:
            page.screenshot(path=f'{shots}/05-win.png')
        # play again
        if g < games - 1:
            page.click('.win [data-res="again"]')
    print('games:', results)
    print('prompts/sheets exercised:', json.dumps(sheet_kinds, indent=1))
    # discard pile + menu sheets
    page.click('.win [data-res="menu"]')
    page.wait_for_selector('.setup')
    browser.close()

if errors:
    print('ERRORS:'); [print(' ', e) for e in errors]; sys.exit(1)
print('no console/page errors')
