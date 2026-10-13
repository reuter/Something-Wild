import sys, os, subprocess, time
from playwright.sync_api import sync_playwright
d = os.path.abspath(sys.argv[1])
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '--directory', d], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844})
        page = ctx.new_page(); errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.goto('http://localhost:8765/index.html'); page.wait_for_selector('.ed')
        page.evaluate("navigator.serviceWorker.ready.then(()=>1)")
        time.sleep(1)
        man = page.evaluate("fetch('manifest.webmanifest').then(r=>r.json()).then(m=>m.name)")
        print('manifest:', man)
        ctx.set_offline(True)
        page.reload(); page.wait_for_selector('.ed')
        page.click('.ed[data-ed="groot"]'); page.click('[data-act="start"]'); page.wait_for_selector('.centerpower .pcard')
        print('offline reload + game start ok; errors:', errs)
        b.close()
finally:
    srv.terminate()
