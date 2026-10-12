import sys, os, time
from playwright.sync_api import sync_playwright
html = os.path.abspath(sys.argv[1]); shots = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('sw-settings', JSON.stringify({players:4, levels:['easy','hard','medium'], speed:'fast', first:'you'}));")
    page = ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('file://'+html); page.click('[data-act="start"]')
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.text.indexOf('play a card')>=0")
    # give everyone a few played cards + the human two scored powers so chips show
    page.evaluate("""() => { const S=window.SW, st=window.SWUI.U.state;
      st.players[0].tableau=[S.CARD_BY_ID.red6,S.CARD_BY_ID.blue3,S.CARD_BY_ID.green9,S.CARD_BY_ID.yellow1,S.CARD_BY_ID.purple8];
      st.players[1].tableau=[S.CARD_BY_ID.red2,S.CARD_BY_ID.blue7,S.CARD_BY_ID.green4];
      st.players[2].tableau=[S.CARD_BY_ID.yellow5,S.CARD_BY_ID.purple2,S.CARD_BY_ID.red9,S.CARD_BY_ID.blue1];
      st.players[3].tableau=[S.CARD_BY_ID.green1,S.CARD_BY_ID.green2];
      st.players[0].powers=[S.POWER_BY_ID.swap]; st.players[2].powers=[S.POWER_BY_ID.redwild,S.POWER_BY_ID.n268];
      window.SWUI.render(); }""")
    page.screenshot(path=shots+'/numbers.png')
    # 1. long-press on the centre power (simulated touch pointer events)
    box = page.locator('.centerpower .pcard').bounding_box()
    x, y = box['x']+box['width']/2, box['y']+box['height']/2
    page.evaluate("""([x,y]) => { const el=document.elementFromPoint(x,y).closest('[data-power]');
      el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:x,clientY:y})); }""", [x,y])
    time.sleep(0.7)
    vis = page.evaluate("getComputedStyle(document.getElementById('tip')).display")
    txt = page.evaluate("document.getElementById('tip').innerText")
    print('long-press tooltip:', vis, '|', txt.replace('\n',' - '))
    page.screenshot(path=shots+'/tooltip.png')
    page.evaluate("""() => document.getElementById('app').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}))""")
    time.sleep(2.0)
    print('tooltip hides after release:', page.evaluate("getComputedStyle(document.getElementById('tip')).display"))
    # a long-press must NOT also open the info sheet
    print('sheet open after long-press:', page.locator('#overlay .sheet').count())
    # 2. plain tap on centre power opens the explanation sheet
    page.locator('.centerpower .pcard').click()
    print('tap opens sheet:', page.locator('#overlay .sheet').count(), '|', page.locator('#overlay .sheet .sub').inner_text())
    page.click('#overlay [data-res="close"]')
    # 3. tap a scored-power chip
    page.locator('.me .pchip').first.click()
    print('chip tap sheet:', page.locator('#overlay .sheet .sub').inner_text()); page.click('#overlay [data-res="close"]')
    # 4. mouse hover on an opponent's chip
    b2 = ctx.new_page(); b2.close()
    chip = page.locator('.opp .pchip').first.bounding_box()
    page.mouse.move(chip['x']+5, chip['y']+5); time.sleep(0.3)
    print('hover tooltip:', page.evaluate("document.getElementById('tip').innerText").replace('\n',' - '))
    print('errors:', errs)
    b.close()
