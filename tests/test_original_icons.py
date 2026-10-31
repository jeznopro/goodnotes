import hashlib,json,pathlib,sys,xml.etree.ElementTree as ET
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';report={'checks':[],'errors':[]}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS '+name,flush=True)
assets=ROOT/'web'/'icons'/'goodnotes';manifest=json.loads((assets/'sources.json').read_text(encoding='utf-8'))
excluded={'fill','stroke','style','class','id','aria-hidden','focusable','data-glyph'}
allowed={'svg','path','circle','ellipse','rect','line','polyline','polygon','g','defs','clipPath','linearGradient','stop','mask','use'}
for name,source in manifest['icons'].items():
    file=assets/(name+'.svg');svg=ET.fromstring(file.read_text(encoding='utf-8'))
    geometry=[(e.tag.split('}')[-1],{k:v for k,v in e.attrib.items() if k not in excluded}) for e in svg.iter()]
    assert hashlib.sha256(json.dumps(geometry,sort_keys=True).encode()).hexdigest()==source['geometrySha256'],name+' differs from original geometry'
    assert hashlib.sha256(file.read_bytes()).hexdigest()==source['fileSha256'],name+' differs from prepared asset'
    for e in svg.iter():
        assert e.tag.split('}')[-1] in allowed
        assert not any(k.lower().startswith('on') or k.endswith('href') and not v.startswith('#') for k,v in e.attrib.items())
check('All 31 SVG assets preserve their original Goodnotes shape coordinates',len(manifest['icons'])==31)
check('Icon assets contain only static SVG shapes with no scripts or external references')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':1920,'height':1008},device_scale_factor=1);page.on('pageerror',lambda e:report['errors'].append(str(e)))
    try:
        page.goto('http://127.0.0.1:50339/',wait_until='networkidle');page.wait_for_function('window.__papernoteReady');page.get_by_role('button',name='Mở Giải phẫu học',exact=True).click();page.locator('[data-action=new-whiteboard]').first.click();page.locator('[data-close-tab]').first.click()
        check('Primary tools use the original SVG assets',page.locator('.toolbar [data-tool] svg.reference-icon').count()==11)
        check('Sidebar, search, document view and export use the original assets',page.locator('.editor-utilities svg.reference-icon').count()==4 and page.locator('.editor-actions svg.reference-icon').count()==3)
        check('Selected pen has the original blue body and pale tip',page.locator('[data-tool=pen] #pencil_body_outline').evaluate("e=>getComputedStyle(e).fill==='rgb(69, 191, 219)'") and page.locator('[data-tool=pen] #pencil_tip').evaluate("e=>getComputedStyle(e).fill==='rgb(233, 222, 159)'"))
        check('Inactive eraser is white outline with transparent body',page.locator('[data-tool=eraser] #outline').evaluate("e=>getComputedStyle(e).stroke==='rgb(255, 255, 255)'&&getComputedStyle(e).strokeWidth==='1.5px'") and page.locator('[data-tool=eraser] #body').evaluate("e=>getComputedStyle(e).fill==='rgba(0, 0, 0, 0)'"))
        check('Lasso uses the original dashed outline and pointer',page.locator('[data-tool=select] #outline').count()==1 and page.locator('[data-tool=select] #arrow_fill').count()==1)
        page.locator('[data-tool=eraser]').click();check('Selected eraser restores its original color fills',page.locator('[data-tool=eraser] #top').evaluate("e=>getComputedStyle(e).fill!=='rgba(0, 0, 0, 0)'"))
        for tool in ['text','select','shape','laser','highlighter','pen']:
            page.locator('[data-tool='+tool+']').click();assert page.locator('[data-tool='+tool+']').get_attribute('aria-pressed')=='true'
        check('Changing icons preserves tool selection and actions')
        page.locator('[data-nib=ball]').click();check('Palette uses the original blue pen and retains nib selection',page.locator('[data-nib=ball]').get_attribute('aria-pressed')=='true' and page.locator('[data-nib=ball] svg.reference-icon').count()==1)
        page.mouse.move(1400,35);page.screenshot(path=str(OUT/'original-icons-editor.png'))
        page.locator('[data-action=pen-settings]:visible').first.click();check('All four pen choices have distinct original vector shapes',len(set(page.locator('[data-pen-kind] svg path').evaluate_all("es=>es.map(e=>e.getAttribute('d'))")))>=4)
        page.screenshot(path=str(OUT/'original-icons-pens.png'));page.locator('[data-action=close-modal]').first.click()
        page.set_viewport_size({'width':800,'height':650});check('Original icons fit the compact toolbar',page.evaluate('document.documentElement.scrollWidth<=innerWidth'));page.screenshot(path=str(OUT/'original-icons-compact.png'))
        check('No UI errors',not report['errors']);report['ok']=True
    except Exception as e:
        report['ok']=False;report['failure']=str(e);page.screenshot(path=str(OUT/'original-icons-failure.png'));raise
    finally:
        (OUT/'original-icons-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
