import sys, os, time
from playwright.sync_api import sync_playwright
html = os.path.abspath(sys.argv[1]); shot = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('sw-settings', JSON.stringify({players:2, levels:['easy'], speed:'fast', first:'you'}));")
    page = ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
    page.goto('file://'+html); page.click('[data-act="start"]')
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('play a card')>=0")
    # rig: human has 2 powers and two 8s in play; hand contains a third 8
    page.evaluate("""() => { const S=window.SW, st=window.SWUI.U.state, me=st.players[0];
      me.powers=[S.POWER_BY_ID.swap,S.POWER_BY_ID.pass];
      me.tableau=[S.CARD_BY_ID.red8,S.CARD_BY_ID.blue8];
      me.hand=me.hand.filter(c=>c.num!==8); me.hand.unshift(S.CARD_BY_ID.green8);
      window.SWUI.U.ask.ids=me.hand.map(c=>c.id); window.SWUI.render(); }""")
    page.locator('[data-card="green8"].selectable').first.click()
    page.click('.promptbar [data-btn="ok"]')
    time.sleep(4)
    print('winner:', page.evaluate("window.SWUI.U.state.winner"), '| win sheet present:', page.locator('.win').count(), '| token', page.evaluate("window.SWUI.U.token"))
    print('overlay html len:', page.evaluate("document.getElementById('overlay').innerHTML.length"))
    print('errors:', errs)
    page.screenshot(path=shot)
    b.close()
