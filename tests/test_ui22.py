import json,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';OUT.mkdir(exist_ok=True)
report={'checks':[],'errors':[]}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS '+name,flush=True)
def zoom(page):return int(page.locator('#zoom-label').inner_text().replace('%',''))
def cursor(page):
    box=page.locator('#paper').bounding_box();page.mouse.move(box['x']+min(160,box['width']/2),box['y']+min(180,box['height']/2))
    return page.locator('#ink-cursor').evaluate(r"e=>{const s=getComputedStyle(e);const rgb=s.backgroundColor.match(/\d+/g)||[];return {value:getComputedStyle(document.querySelector('#paper')).cursor,color:s.backgroundColor==='rgba(0, 0, 0, 0)'?'none':'#'+rgb.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join(''),outline:s.borderColor,diameter:parseFloat(s.width),hidden:e.hidden}}")

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    try:
        page.goto('http://127.0.0.1:50339/',wait_until='networkidle');page.wait_for_function('window.__papernoteReady')
        check('Library controls share rounded corners',page.locator('.search').evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)')==17 and page.locator('.primary').first.evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)')==11)
        page.screenshot(path=str(OUT/'ui22-library.png'))
        page.get_by_role('button',name='Mở Giải phẫu học',exact=True).click();page.locator('#paper').wait_for();page.wait_for_timeout(100)
        initial=zoom(page);page.keyboard.press('Control+Equal');check('Ctrl equals zooms the page',zoom(page)==initial+10)
        page.keyboard.press('Control+Shift+Equal');check('Ctrl plus zooms the page',zoom(page)==initial+20)
        page.keyboard.press('Control+-');check('Ctrl minus zooms out',zoom(page)==initial+10)
        page.dispatch_event('body','keydown',{'key':'+','code':'NumpadAdd','ctrlKey':True,'bubbles':True,'cancelable':True});check('Numpad plus shortcut zooms in',zoom(page)==initial+20)
        page.dispatch_event('body','keydown',{'key':'-','code':'NumpadSubtract','ctrlKey':True,'bubbles':True,'cancelable':True});check('Numpad minus shortcut zooms out',zoom(page)==initial+10)
        page.locator('#width').select_option('4');page.keyboard.press('Control+Equal');check('Zoom works while a toolbar dropdown has focus',zoom(page)==initial+20)
        for i in range(30):page.keyboard.press('Control+Equal')
        check('Keyboard zoom respects the maximum',zoom(page)==250)
        for i in range(30):page.keyboard.press('Control+-')
        check('Keyboard zoom respects the minimum',zoom(page)==20)
        page.locator('[data-action=fit]').last.click()
        c=cursor(page);check('Writing cursor is a filled circle with a black outline',c.get('color')=='#ff9818' and c.get('outline')=='rgb(0, 0, 0)' and not c['hidden'] and c['value']=='none')
        page.locator('[data-color="#ff0000"]').click();c=cursor(page);check('Cursor follows a palette color immediately',c['color']=='#ff0000')
        check('Cursor is centered on the pointer and never intercepts input',page.locator('#ink-cursor').evaluate("e=>getComputedStyle(e).pointerEvents==='none'&&getComputedStyle(e).borderRadius==='50%'"))
        page.locator('#custom-color').fill('#00aa77');check('Custom ink color updates the cursor',cursor(page)['color']=='#00aa77')
        page.locator('[data-tool=hand]').click();check('Hand tool retains a grab cursor',cursor(page)['value']=='grab')
        page.locator('[data-tool=text]').click();check('Text tool retains the text cursor',cursor(page)['value']=='text')
        box=page.locator('#paper').bounding_box();page.mouse.click(box['x']+80,box['y']+80);page.locator('.inline-text').fill('Ghi chú thử phím tắt');before=zoom(page);page.keyboard.press('Control+Equal');check('Zoom shortcuts leave text editing alone',zoom(page)==before and page.locator('.inline-text').count()==1);page.keyboard.press('Escape')
        page.locator('[data-tool=eraser]').click();check('Eraser uses a hollow circular cursor',cursor(page)['color']=='none')
        page.locator('[data-tool=pen]').click();page.locator('[data-action=read-mode]').click();check('Read-only mode uses a viewing cursor',cursor(page)['value']=='grab');page.locator('[data-action=read-mode]').click()
        check('Toolbar and tools use rounded containers',page.locator('.quick-palette').evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)')==17 and page.locator('[data-tool=pen]').evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)')==10)
        check('Tool icons retain visible vector geometry',page.locator('[data-tool] svg').evaluate_all("es=>es.every(e=>e.viewBox.baseVal.width>0&&e.querySelector('path')&&e.getBBox().width>0)"))
        page.locator('[data-action=pen-settings]:visible').first.click();check('Dialog corners are rounded',page.locator('#modal').evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)')==21)
        paths=page.locator('[data-pen-kind] svg').evaluate_all("es=>es.map(e=>e.innerHTML)");check('Four pen styles have distinct icons',len(paths)==4 and len(set(paths))==4)
        page.screenshot(path=str(OUT/'ui22-pen-settings.png'));page.locator('[data-action=close-modal]').first.click()
        page.screenshot(path=str(OUT/'ui22-editor.png'))
        page.set_viewport_size({'width':800,'height':700});check('Rounded editor fits a compact viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(OUT/'ui22-compact.png'))
        check('No browser errors',not report['errors']);report['ok']=True
    except Exception as e:
        report['ok']=False;report['failure']=str(e);page.screenshot(path=str(OUT/'ui22-failure.png'));raise
    finally:
        (OUT/'ui22-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
