import io,json,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';report={'checks':[],'errors':[]}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS '+name,flush=True)
def vault(page):
    return page.evaluate('''async()=>{const db=await new Promise(r=>{const q=indexedDB.open('PaperNote',1);q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const q=db.transaction('vault').objectStore('vault').get('library');q.onsuccess=()=>r(q.result)})}''')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1008},device_scale_factor=1);page.on('pageerror',lambda e:report['errors'].append(str(e)))
    try:
        page.goto('http://127.0.0.1:50339/',wait_until='networkidle');page.wait_for_function('window.__papernoteReady');original=vault(page)
        page.get_by_role('button',name='Mở Giải phẫu học',exact=True).click();page.locator('[data-action=new-whiteboard]').first.click();page.wait_for_timeout(200)
        data=vault(page);board=data['notebooks'][0];check('A new whiteboard uses a wide dotted writing canvas',board['pages'][0]['whiteboard'] and board['pages'][0]['template']=='dotted' and board['pages'][0]['width']==1920)
        check('Creating a whiteboard preserves every old notebook',all(any(n['id']==old['id'] and n['pages']==old['pages'] for n in data['notebooks']) for old in original['notebooks']))
        tabs=page.locator('.doc-tabs').bounding_box();top=page.locator('.editor-top').bounding_box();pal=page.locator('.quick-palette').bounding_box()
        check('Reference layout uses two 48-pixel blue rows',tabs['y']==0 and tabs['height']==48 and top['y']==48 and top['height']==48)
        check('Pen palette floats centered beneath the tool row',pal['y']==104 and abs(pal['x']+pal['width']/2-960)<1 and pal['height']==46)
        check('Main navigation and palette match the reference colors',page.locator('.doc-tabs').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(33, 50, 92)' and page.locator('.quick-palette').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(34, 33, 32)')
        check('Page sidebar starts collapsed',not page.locator('.page-rail').is_visible())
        page.locator('[data-action=toggle-rail]').click();check('Page sidebar can still be opened',page.locator('.page-rail').is_visible());page.locator('[data-action=toggle-rail]').click();page.locator('#zoom-label').click()
        page.locator('[data-nib=ball]').click();check('Floating nib selection changes pen without opening a dialog',not page.locator('#modal').evaluate('e=>e.open') and page.locator('[data-nib=ball]').get_attribute('aria-pressed')=='true')
        def hover():page.mouse.move(450,350)
        def diameter():return page.locator('#ink-cursor').evaluate('e=>parseFloat(getComputedStyle(e).width)')
        def scale():return page.locator('#paper').evaluate('e=>parseFloat(e.style.width)')/board['pages'][0]['width']
        page.locator('[data-size="6"]').click();hover();check('Cursor diameter equals selected nib width times page scale',abs(diameter()-6*scale())<.02 and page.locator('#ink-cursor').is_visible())
        page.keyboard.press('Control+Equal');check('Keyboard zoom updates cursor diameter immediately',abs(diameter()-6*scale())<.02)
        page.locator('#width').select_option('12');hover();check('Custom width dropdown updates the same cursor',abs(diameter()-12*scale())<.02)
        page.locator('[data-action=pen-settings]:visible').first.click();page.locator('#setting-size').fill('20');page.locator('[data-action=close-modal]').first.click();hover();check('Pen settings slider updates the same cursor',abs(diameter()-20*scale())<.02)
        page.locator('#custom-color').fill('#00aa77');hover();mark=page.locator('#ink-cursor');check('Cursor follows ink color and retains its black circular border',mark.evaluate("e=>{const s=getComputedStyle(e);return s.backgroundColor==='rgb(0, 170, 119)'&&s.borderColor==='rgb(0, 0, 0)'&&s.borderRadius==='50%'}"))
        bmp=Image.open(io.BytesIO(mark.screenshot())).convert('RGB');center=bmp.getpixel((bmp.width//2,bmp.height//2));edge=bmp.getpixel((0,bmp.height//2));check('Rendered cursor has ink-colored center pixels and a black edge',center==(0,170,119) and max(edge)<70)
        before=page.locator('#paper').evaluate('c=>c.toDataURL()');page.mouse.move(800,420);after=page.locator('#paper').evaluate('c=>c.toDataURL()');check('Cursor never enters drawing or export pixels',before==after)
        page.mouse.move(10,20);check('Cursor hides after leaving the writing canvas',not mark.is_visible())
        page.locator('[data-tool=highlighter]').click();hover();check('Highlighter cursor reflects its wider tip',abs(diameter()-20*7*scale())<.02)
        for i in range(18):page.keyboard.press('Control+Equal')
        check('Large tips keep their full size beyond native cursor limits',diameter()>128 and abs(diameter()-20*7*scale())<.02 and page.locator('#paper').evaluate('c=>getComputedStyle(c).cursor')=='none')
        page.locator('[data-tool=eraser]').click();hover();check('Eraser cursor matches the full erase diameter',abs(diameter()-24*scale())<.02 and mark.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)')
        page.locator('[data-tool=text]').click();hover();check('Text editing keeps its text cursor',not mark.is_visible() and page.locator('#paper').evaluate('c=>getComputedStyle(c).cursor')=='text')
        page.locator('[data-tool=hand]').click();hover();check('Panning keeps its hand cursor',not mark.is_visible() and page.locator('#paper').evaluate('c=>getComputedStyle(c).cursor')=='grab')
        page.locator('[data-nib=ball]').click();page.locator('#zoom-label').click();page.locator('[data-size="3"]').click();page.locator('#custom-color').fill('#ff9818');page.mouse.move(10,20)
        page.screenshot(path=str(OUT/'reference24-editor.png'))
        page.set_viewport_size({'width':800,'height':650});check('Reference controls fit a compact Windows window',page.evaluate('document.documentElement.scrollWidth<=innerWidth') and page.locator('.quick-palette').bounding_box()['x']>=0);page.screenshot(path=str(OUT/'reference24-compact.png'))
        page.locator('[data-action=editor-more]:visible').last.click();check('Advanced drawing and backup tools remain accessible',page.locator('#modal [data-action=tablet-test]').count()==1 and page.locator('#modal [data-action=settings]').count()==1)
        check('GeoGebra entry is paused',page.locator('[data-action=math-menu]').count()==0)
        check('No UI runtime errors',not report['errors']);report['ok']=True
    except Exception as e:
        report['ok']=False;report['failure']=str(e);page.screenshot(path=str(OUT/'reference24-failure.png'));raise
    finally:
        (OUT/'reference24-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
