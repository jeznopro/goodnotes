import json,os,pathlib,subprocess,sys,time,urllib.request
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';report={'checks':[]}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS '+name,flush=True)
exe=pathlib.Path(os.environ['LOCALAPPDATA'])/'Programs'/'PaperNote'/'PaperNote.exe'
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
proc=subprocess.Popen([str(exe),'--profile',str(ROOT/'tests'/'native-ui22-profile'),'--debug-port','50342'],startupinfo=startup)
page=None
try:
    for i in range(150):
        try:
            with urllib.request.urlopen('http://127.0.0.1:50342/json/version',timeout=.5) as r:r.read()
            break
        except Exception:time.sleep(.2)
    else:raise RuntimeError('Native WebView test endpoint did not open')
    with sync_playwright() as p:
        browser=p.chromium.connect_over_cdp('http://127.0.0.1:50342')
        context=browser.contexts[0];page=context.pages[0]
        page.wait_for_function('window.__papernoteReady')
        page.get_by_role('button',name='Mở Giải phẫu học',exact=True).click();page.locator('#paper').wait_for()
        initial=int(page.locator('#zoom-label').inner_text().strip('%'));initial_width=page.locator('#paper').evaluate('c=>parseFloat(c.style.width)')
        page.keyboard.press('Control+Shift+Equal');check('Windows WebView receives Ctrl plus',int(page.locator('#zoom-label').inner_text().strip('%'))==initial+10)
        check('Windows zoom resizes the paper only',page.locator('#paper').evaluate('c=>parseFloat(c.style.width)')>initial_width and page.evaluate('visualViewport.scale')==1)
        page.keyboard.press('Control+-');check('Windows WebView receives Ctrl minus',int(page.locator('#zoom-label').inner_text().strip('%'))==initial)
        page.locator('[data-color="#ff0000"]').click();box=page.locator('#paper').bounding_box();page.mouse.move(box['x']+150,box['y']+180)
        check('Installed Windows app loads the colored cursor',page.locator('#ink-cursor').evaluate("e=>!e.hidden&&getComputedStyle(e).backgroundColor==='rgb(255, 0, 0)'&&getComputedStyle(e).borderColor==='rgb(0, 0, 0)'"))
        check('Installed Windows app loads the reference toolbar',page.locator('.quick-palette').evaluate('e=>getComputedStyle(e).borderRadius')=='17px' and page.locator('.editor-top').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(44, 79, 128)')
        check('Installed Windows app loads original Goodnotes tool glyphs',page.locator('.toolbar [data-tool] svg.reference-icon').count()==11 and page.locator('[data-tool=pen] #pencil_body_outline').evaluate("e=>getComputedStyle(e).fill==='rgb(69, 191, 219)'"))
        page.locator('#width').select_option('6');page.mouse.move(box['x']+150,box['y']+180);diameter=page.locator('#ink-cursor').evaluate('e=>parseFloat(getComputedStyle(e).width)');scale=page.locator('#paper').evaluate('e=>parseFloat(e.style.width)')/794
        check('Native cursor diameter matches nib width and zoom',abs(diameter-6*scale)<.02)
        page.locator('[data-action=new-whiteboard]').first.click();page.locator('[data-close-tab]').first.click()
        check('Native app opens the wide dotted whiteboard',page.locator('.editor.whiteboard').count()==1 and page.locator('#paper').evaluate('e=>e.getBoundingClientRect().width>innerWidth*.9'))
        check('GeoGebra is paused in the installed interface',page.locator('[data-action=math-menu]').count()==0)
        page.wait_for_function("document.querySelector('#save-label').textContent.includes('Đã lưu')")
        page.screenshot(path=str(OUT/'native-reference24.png'))
        page.evaluate("window.chrome.webview.postMessage({type:'flushed'})")
        proc.wait(timeout=10);check('Isolated Windows test closes successfully',proc.returncode==0);report['ok']=True
except Exception as e:
    report['ok']=False;report['failure']=str(e);raise
finally:
    if proc.poll() is None:proc.terminate();proc.wait(timeout=10)
    (OUT/'native-ui22-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
