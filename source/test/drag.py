import sys, os, time
from playwright.sync_api import sync_playwright
html = os.path.abspath(sys.argv[1]); shots = sys.argv[2]
def center(page, sel):
    b = page.locator(sel).first.bounding_box(); return b['x']+b['width']/2, b['y']+b['height']/2
def drag(page, frm, to, release=True, steps=12):
    page.mouse.move(*frm); page.mouse.down()
    for i in range(1, steps+1):
        page.mouse.move(frm[0]+(to[0]-frm[0])*i/steps, frm[1]+(to[1]-frm[1])*i/steps)
    if release: page.mouse.up()
def state(page):
    return page.evaluate("""() => { const U=window.SWUI.U, me=U.state.players[0];
      return {turn:U.state.turnNo, hand:me.hand.length, tab:me.tableau.map(c=>c.id), ask: U.ask? (U.ask.dragPlay?'play':'other'): null, chosen: U.ask&&U.ask.chosen,
              ghosts: document.querySelectorAll('.card.ghost').length, dragging: document.querySelectorAll('.card.dragging').length}; }""")
def wait_play(page):
    page.wait_for_function("window.SWUI.U.ask && window.SWUI.U.ask.dragPlay", timeout=30000)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('sw-settings', JSON.stringify({players:3, levels:['easy','medium'], speed:'fast', first:'you'}));")
    page = ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('file://'+html); page.click('[data-act="start"]'); wait_play(page)
    page.locator('.hand .card').first.wait_for()
    me_c = center(page, '.me .tabrow')

    # 1. drop outside the play area (on the opponents) -> card returns, still your turn
    card = center(page, '.hand .card:nth-child(2)')
    opp = center(page, '.opps')
    drag(page, card, opp, release=False)
    mid = page.evaluate("({ghost: document.querySelectorAll('.card.ghost').length, ready: document.querySelector('.me').classList.contains('drop-ready'), over: document.querySelector('.me').classList.contains('drop-over')})")
    print('mid-drag over opponents -> ghost:', mid['ghost'], '| play area highlighted:', mid['ready'], '| drop-over:', mid['over'])
    page.mouse.up(); time.sleep(0.5)
    s = state(page)
    print('after miss -> hand:', s['hand'], 'tableau:', s['tab'], 'ask:', s['ask'], 'ghosts:', s['ghosts'], 'dragging:', s['dragging'])

    # 2. drag away and back to the same spot: must not count as a tap/select
    card = center(page, '.hand .card:nth-child(3)')
    page.mouse.move(*card); page.mouse.down(); page.mouse.move(card[0], card[1]-60, steps=6); page.mouse.move(*card, steps=6); page.mouse.up(); time.sleep(0.5)
    print('drag-and-return selected a card?', state(page)['chosen'])

    # 3. plain tap still selects (tap + Play still works)
    page.locator('.hand .card').nth(0).click(); time.sleep(0.2)
    print('tap selects:', state(page)['chosen'] is not None)

    # 4. drag to the play area -> played
    t0 = state(page)['turn']
    card = center(page, '.hand .card:nth-child(4)')
    cid = page.locator('.hand .card:nth-child(4)').get_attribute('data-card')
    drag(page, card, me_c, release=False)
    page.screenshot(path=shots+'/drag-1-over-drop.png')
    over = page.evaluate("document.querySelector('.me').classList.contains('drop-over')")
    page.mouse.up()
    page.wait_for_function("window.SWUI.U.state.players[0].tableau.some(c => c.id === '%s')" % cid, timeout=10000)
    time.sleep(0.6)
    if page.locator('#overlay [data-res="skip"]').count():
        page.click('#overlay [data-res="skip"]')
    page.wait_for_function("window.SWUI.U.state.turnNo > %d" % t0, timeout=30000)
    s = state(page)
    print('dropped on play area -> over highlight:', over, '| card now in tableau:', cid in s['tab'], '| turn advanced')
    wait_play(page)

    # 5. synthetic TOUCH drag (pointerType=touch)
    cid2 = page.evaluate("window.SWUI.U.state.players[0].hand[0].id")
    r = page.locator(f'.hand .card[data-card="{cid2}"]').bounding_box()
    mb = page.locator('.me').bounding_box()
    sx, sy = r['x']+r['width']/2, r['y']+r['height']/2
    tx, ty = mb['x']+mb['width']/2, mb['y']+mb['height']/2
    t0 = state(page)['turn']
    page.evaluate("""([cid,sx,sy,tx,ty]) => {
      const el=document.querySelector('.hand .card[data-card="'+cid+'"]');
      const ev=(t,x,y,tg)=> (tg||window).dispatchEvent(new PointerEvent(t,{bubbles:true,pointerType:'touch',pointerId:7,clientX:x,clientY:y,isPrimary:true}));
      ev('pointerdown',sx,sy,el);
      for(let i=1;i<=10;i++) ev('pointermove', sx+(tx-sx)*i/10, sy+(ty-sy)*i/10);
      ev('pointerup',tx,ty); }""", [cid2,sx,sy,tx,ty])
    page.wait_for_function("window.SWUI.U.state.players[0].tableau.some(c => c.id === '%s')" % cid2, timeout=10000)
    sheet = page.locator('#overlay .sheet h2').count()
    print('touch drag played', cid2, ':', cid2 in state(page)['tab'], '| (Power picker opened because it grabbed the Mover)' if sheet else '')
    b.close()
print('errors:', errs)
