import sys, os, time
from playwright.sync_api import sync_playwright
html = os.path.abspath(sys.argv[1]); shots = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('sw-settings', JSON.stringify({players:3, levels:['easy','medium'], speed:'fast', first:'you'}));")
    page = ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('file://'+html); page.click('[data-act="start"]')
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('play a card')>=0")
    # rig: hand contains yellow1 (Mover symbol) so playing it opens the Power picker
    page.evaluate("""() => { const S=window.SW, me=window.SWUI.U.state.players[0];
      window.SWUI.U.state.center=S.POWER_BY_ID.blue3; window.SWUI.U.state.powerPile=window.SWUI.U.state.powerPile.filter(x=>x.id!=='blue3');
      me.hand=me.hand.filter(c=>c.num!==1); me.hand.unshift(S.CARD_BY_ID.yellow1);
      window.SWUI.U.ask.ids=me.hand.map(c=>c.id); window.SWUI.render(); }""")
    page.locator('[data-card="yellow1"].selectable').first.click()
    page.click('.promptbar [data-btn="ok"]')
    page.wait_for_selector('#overlay .sheet h2')
    print('sheet title:', page.locator('#overlay .sheet h2').inner_text(), '| peek button:', page.locator('#overlay .peekbtn').count())
    page.screenshot(path=shots+'/peek-1-sheet.png')
    # hand is covered by the sheet?
    hand_y = page.locator('.hand .card').first.bounding_box()
    sheet_top = page.locator('#overlay .sheet').bounding_box()['y']
    print('hand covered by sheet before peek:', hand_y['y'] + 40 > sheet_top)
    page.click('#overlay .peekbtn')
    time.sleep(0.2)
    print('sheet visible while peeking:', page.locator('#overlay .sheet').is_visible(), '| peekbar visible:', page.locator('#overlay .peekbar').is_visible())
    page.screenshot(path=shots+'/peek-2-peeking.png')
    # taps on the table while peeking must NOT open a sheet over the pending decision
    page.locator('.pile.discard').click(force=True)
    page.locator('.topbar [data-act="rules"]').click(force=True)
    print('info sheet opened while peeking:', page.locator('#overlay .sheet').count(), '(want 0, decision still pending:', page.evaluate("!!window.SWUI.U.sheetRes"), ')')
    # tapping a Power while peeking shows the tooltip instead
    page.locator('.centerpower .pcard').click(force=True)
    print('tooltip while peeking:', page.evaluate("getComputedStyle(document.getElementById('tip')).display"))
    page.screenshot(path=shots+'/peek-3-tooltip.png')
    # back to the decision, then choose "No Power" and make sure the game carries on
    page.click('#overlay [data-unpeek]')
    print('sheet back:', page.locator('#overlay .sheet').is_visible(), '| peekbar gone:', page.locator('#overlay .peekbar').count()==0)
    t0 = page.evaluate("window.SWUI.U.state.turnNo")
    page.click('#overlay [data-res="skip"]')
    page.wait_for_function("window.SWUI.U.state.turnNo > %d || (window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('play a card')>=0 && window.SWUI.U.state.turnNo > %d)" % (t0, t0), timeout=20000)
    print('game continued after peek: turn', t0, '->', page.evaluate("window.SWUI.U.state.turnNo"))
    # every decision sheet offers Peek
    kinds = page.evaluate("""async () => { const out=[]; const st=window.SWUI.U.state; window.SWUI.U.token++; 
      const open=(p)=>{ p.catch(()=>{}); return new Promise(r=>setTimeout(()=>{ const has=!!document.querySelector('#overlay .peekbtn'); const title=(document.querySelector('#overlay .sheet h2')||{}).innerText; document.getElementById('overlay').innerHTML=''; r([title,has]); },50)); };
      out.push(await open(window.SWUI.human.chooseColor()));
      out.push(await open(window.SWUI.human.chooseNumber()));
      out.push(await open(window.SWUI.human.chooseDiscardPick(st,0,[window.SW.CARD_BY_ID.red7])));
      out.push(await open(window.SWUI.human.chooseTriple(st,0,[[window.SW.CARD_BY_ID.red1,window.SW.CARD_BY_ID.red2,window.SW.CARD_BY_ID.red3]])));
      return out; }""")
    print('decision sheets with a Peek button:', kinds)
    b.close()
print('errors:', errs)
