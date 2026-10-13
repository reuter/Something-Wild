"""Human-facing prompts for the new Powers (extra play, sweep victim choice, pass tie).  usage: python3 test/edition_prompts.py <html>"""
import sys, os, time
from playwright.sync_api import sync_playwright
html = os.path.abspath(sys.argv[1])
errs = []

def fresh(p, edition, players=2):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('sw-settings', JSON.stringify({players:%d, levels:['easy','easy','easy'], speed:'fast', first:'you', edition:'%s'}));" % (players, edition))
    page = ctx.new_page()
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
    page.goto('file://' + html); page.click('[data-act="start"]')
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('play a card')>=0")
    return b, page

with sync_playwright() as p:
    # A. Double Time (extra card) used by the human via the centre Power
    b, page = fresh(p, 'groot')
    page.evaluate("""() => { const S=window.SW, st=window.SWUI.U.state, me=st.players[0];
      st.center=S.POWER_BY_ID.g_twos; st.mover=0; me.tableau=[S.CARD_BY_ID.green2];
      me.hand=[S.CARD_BY_ID.blue3, S.CARD_BY_ID.red6, S.CARD_BY_ID.yellow4];
      st.deck=[S.CARD_BY_ID.purple8, S.CARD_BY_ID.red7]; // red7 is already drawn? no: human drew at turn start
      window.SWUI.U.ask.ids=me.hand.map(c=>c.id); window.SWUI.render(); }""")
    page.locator('[data-card="blue3"].selectable').first.click(); page.click('.promptbar [data-btn="ok"]')
    page.wait_for_selector('#overlay .popt:not([disabled])')
    page.click('#overlay [data-res="use:g_twos"]')
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('play an extra card')>=0")
    print('A prompt:', page.evaluate("window.SWUI.U.ask.text"))
    hand_before = page.evaluate("window.SWUI.U.state.players[0].hand.length")
    page.locator('[data-card="yellow4"].selectable').first.click(); page.click('.promptbar [data-btn="ok"]')
    time.sleep(1.5)
    tab = page.evaluate("window.SWUI.U.state.players[0].tableau.map(c=>c.id).sort()")
    print('A tableau:', tab, 'hand before extra:', hand_before)
    assert 'yellow4' in tab and 'blue3' in tab and 'green2' in tab, tab
    assert hand_before == 3, hand_before   # 2 left + 1 drawn
    b.close()

    # B. a Color Sweep hits the human, who must choose which of two matching cards to lose
    b, page = fresh(p, 'groot')
    page.evaluate("""() => { const S=window.SW, U=window.SWUI.U, st=U.state;
      st.players[0].tableau=[S.CARD_BY_ID.red5, S.CARD_BY_ID.red8, S.CARD_BY_ID.blue2];
      st.deck=[S.CARD_BY_ID.yellow9, S.CARD_BY_ID.red3];
      window.__p = S.applyPower(st, 1, S.POWER_BY_ID.g_sweepcolor, U.agents, {event: async()=>{}}); }""")
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('flipped')>=0")
    print('B prompt:', page.evaluate("window.SWUI.U.ask.text"))
    ids = page.evaluate("window.SWUI.U.ask.ids"); print('B choices:', ids); assert sorted(ids) == ['red5', 'red8']
    page.locator('[data-card="red8"].selectable').first.click(); page.click('.promptbar [data-btn="ok"]')
    page.evaluate("window.__p")
    tab = page.evaluate("window.SWUI.U.state.players[0].tableau.map(c=>c.id).sort()")
    print('B tableau:', tab); assert tab == ['blue2', 'red5'], tab
    b.close()

    # C. Pass the Highest with a tie: the human chooses which of two 9s to give
    b, page = fresh(p, 'boba')
    page.evaluate("""() => { const S=window.SW, U=window.SWUI.U, st=U.state, me=st.players[0];
      me.hand=[S.CARD_BY_ID.red9, S.CARD_BY_ID.blue9, S.CARD_BY_ID.green2];
      st.players[1].hand=[S.CARD_BY_ID.red1, S.CARD_BY_ID.green7, S.CARD_BY_ID.blue3];
      window.__p = S.applyPower(st, 0, S.POWER_BY_ID.b_passhigh, U.agents, {event: async()=>{}}); }""")
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('tie')>=0")
    print('C prompt:', page.evaluate("window.SWUI.U.ask.text"))
    ids = page.evaluate("window.SWUI.U.ask.ids"); assert sorted(ids) == ['blue9', 'red9'], ids
    page.locator('[data-card="blue9"].selectable').first.click(); page.click('.promptbar [data-btn="ok"]')
    page.evaluate("window.__p")
    hand = page.evaluate("window.SWUI.U.state.players[0].hand.map(c=>c.id).sort()")
    print('C hand:', hand); assert hand == ['green2', 'green7', 'red9'], hand
    b.close()
print('ERRORS' if errs else 'no errors', errs)
sys.exit(1 if errs else 0)
