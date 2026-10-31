import json,pathlib,sys,math
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results'
report={'checks':[],'errors':[],'external':[]}
def checked(name,yes=True):
    assert yes,name
    report['checks'].append(name);print('PASS '+name,flush=True)
def vault(page):
    return page.evaluate('''async()=>{const db=await new Promise(r=>{const q=indexedDB.open('PaperNote',1);q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const q=db.transaction('vault').objectStore('vault').get('library');q.onsuccess=()=>r(q.result)})}''')
def saved(page):
    page.wait_for_function("!document.querySelector('#save-label')||document.querySelector('#save-label').textContent.includes('Đã lưu')")
    page.wait_for_timeout(70)
def action(page,name):
    target=page.locator(f'[data-action="{name}"]:visible')
    if target.count()==0:page.locator('[data-action=editor-more]:visible').last.click()
    page.locator(f'[data-action="{name}"]:visible').first.click()
def tool(page,name):
    b=page.locator(f'[data-tool="{name}"]')
    if b.get_attribute('aria-pressed')!='true':b.click()
def draw(page,points,pen=False,selector='#paper',base_width=794):
    c=page.locator(selector);r=c.bounding_box();scale=r['width']/base_width
    coords=[(r['x']+x*scale,r['y']+y*scale) for x,y in points]
    if pen:
        client=page.context.new_cdp_session(page)
        x,y=coords[0];client.send('Input.dispatchMouseEvent',{'type':'mousePressed','x':x,'y':y,'button':'left','buttons':1,'clickCount':1,'pointerType':'pen','force':.15})
        for i,(x,y) in enumerate(coords[1:]):client.send('Input.dispatchMouseEvent',{'type':'mouseMoved','x':x,'y':y,'button':'left','buttons':1,'pointerType':'pen','force':.15+.8*(i+1)/(len(coords)-1)})
        x,y=coords[-1];client.send('Input.dispatchMouseEvent',{'type':'mouseReleased','x':x,'y':y,'button':'left','buttons':0,'clickCount':1,'pointerType':'pen'});client.detach()
    else:
        page.mouse.move(*coords[0]);page.mouse.down()
        for x,y in coords[1:]:page.mouse.move(x,y,steps=3)
        page.mouse.up()
    saved(page)
def settings(page):
    action(page,'pen-settings');page.locator('#pen-preview').wait_for()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    context=browser.new_context(viewport={'width':1500,'height':1020},accept_downloads=True)
    page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('request',lambda r:report['external'].append(r.url) if not r.url.startswith(('http://127.0.0.1:50339/','blob:','data:')) else None)
    try:
        page.goto('http://127.0.0.1:50339/',wait_until='networkidle');page.wait_for_function('window.__papernoteReady')
        action(page,'new');page.locator('#new-name').fill('Bản vẽ kiểm thử V2');page.locator('[data-template=blank]').click();page.locator('button[form=new-form]').click();page.locator('#paper').wait_for();action(page,'fit')
        def book():return next(n for n in vault(page)['notebooks'] if n['title']=='Bản vẽ kiểm thử V2')
        def elements():return book()['pages'][0]['elements']
        settings(page)
        for i,name in enumerate(['fountain','ball','brush','pencil']):
            page.locator(f'[data-pen-kind={name}]').click()
            if i==0:
                page.locator('#setting-sensitivity').fill('0.8');page.locator('#setting-stabilization').fill('0.4');page.locator('#setting-drawHold').uncheck()
                page.screenshot(path=str(OUT/'v2-pen-settings.png'))
            action(page,'close-modal')
            draw(page,[(80,120+i*85),(130,100+i*85),(200,140+i*85),(270,110+i*85),(340,130+i*85)],pen=True)
            checked(name+' pen stores distinct brush parameters',elements()[-1]['pen']==name)
            if i<3:settings(page)
        checked('Stylus pressure reaches saved ink samples',max(v[2] for v in elements()[0]['points'])>.8 and min(v[2] for v in elements()[0]['points'])<.2)
        before=len(elements());action(page,'tablet-test');draw(page,[(20,80),(100,110),(200,70),(320,100)],pen=True,selector='#tablet-pad',base_width=440)
        checked('Tablet diagnostics reports actual pen events and pressure',page.locator('#tablet-stats').inner_text().startswith('Bút') and '0.950' in page.locator('#tablet-stats').inner_text())
        page.locator('#tablet-curve').fill('0.75');page.locator('#tablet-curve').dispatch_event('input');action(page,'close-modal')
        checked('Tablet test changes no notebook contents',len(elements())==before)
        alpha=page.evaluate('''async()=>{const {drawStroke}=await import('/ink.mjs');const c=document.createElement('canvas');c.width=80;c.height=80;const x=c.getContext('2d');drawStroke(x,{type:'stroke',color:'#000000',points:[[10,20,.5],[40,20,.5],[40,55,.5]],size:14,highlight:true});return [x.getImageData(20,20,1,1).data[3],x.getImageData(40,20,1,1).data[3]]}''')
        checked('Highlighter joints do not accumulate extra opacity',abs(alpha[0]-alpha[1])<=1)
        tool(page,'highlighter');page.locator('[data-color="#7fca2c"]').click();page.locator('#straight-highlight').check();draw(page,[(80,480),(130,510),(200,475),(350,490)])
        checked('Straight highlighter uses one continuous translucent path',elements()[-1]['highlight'] and len(elements()[-1]['points'])==2)
        # Partial eraser splits an existing stroke, keeping both un-erased sides.
        tool(page,'eraser');page.locator('#eraser-mode').select_option('precision');page.locator('#erase-filter').select_option('highlight');draw(page,[(210,450),(210,530)])
        parts=[e for e in elements() if e.get('highlight')]
        checked('Precision eraser splits highlights and keeps other pen types',len(parts)==2 and len([e for e in elements() if not e.get('highlight')])==4)
        action(page,'undo');saved(page)
        checked('Partial erase can be undone',len([e for e in elements() if e.get('highlight')])==1)
        # Circle only the top stroke. Dragging begins on blank space, not on its bounding box.
        tool(page,'select');page.locator('#lasso-mode').select_option('free');draw(page,[(50,75),(370,75),(370,155),(50,155),(50,75)])
        checked('Freeform lasso selects the enclosed stroke',page.locator('.context-title').inner_text()=='1 đối tượng')
        action(page,'copy-selection');page.keyboard.press('Control+v');saved(page)
        checked('Clipboard duplicates selected ink',len(elements())==6)
        action(page,'selection-style');page.locator('#selection-scale').fill('150');page.locator('#selection-rotate').fill('45');page.locator('#selection-color').fill('#1967d2');page.locator('#apply-color').check();page.locator('button[form=selection-form]').click();saved(page)
        checked('Selection supports recolor, scaling and rotation',elements()[-1]['color']=='#1967d2' and elements()[-1]['size']==4.5)
        action(page,'save-element');page.locator('#text-value').fill('Nét mẫu');page.locator('button[form=text-form]').click();saved(page)
        checked('Reusable elements persist in the library',vault(page)['elements'][0]['name']=='Nét mẫu')
        page.keyboard.press('Escape');tool(page,'tape');draw(page,[(80,600),(360,600)])
        checked('Tape is a distinct opaque stroke',elements()[-1]['tape'])
        tool(page,'hand');draw(page,[(180,600),(180,600)])
        checked('Hand tool reveals tape without deleting it',elements()[-1]['revealed'])
        tool(page,'laser');before=len(elements());draw(page,[(440,120),(500,180)]);page.wait_for_timeout(700)
        checked('Laser trails are transient',len(elements())==before)
        tool(page,'pen');action(page,'toggle-ruler');page.locator('#ruler-angle').fill('0');page.locator('#ruler-angle').dispatch_event('change');draw(page,[(420,230),(450,300),(530,250)])
        checked('Ruler constrains ink to the selected angle',len(elements()[-1]['points'])==2 and elements()[-1]['points'][0][1]==elements()[-1]['points'][1][1])
        action(page,'toggle-ruler');settings(page);page.locator('#setting-drawHold').check();action(page,'close-modal')
        # Simulate a hold at the end of a rough straight line.
        c=page.locator('#paper');r=c.bounding_box();s=c.evaluate('c=>parseFloat(c.style.width)')/794
        page.mouse.move(r['x']+420*s,r['y']+360*s);page.mouse.down()
        for x,y in [(450,361),(480,358),(520,360)]:page.mouse.move(r['x']+x*s,r['y']+y*s)
        page.wait_for_timeout(850);page.mouse.up();saved(page)
        checked('Draw-and-hold regularizes a roughly straight stroke',elements()[-1]['type']=='line')
        action(page,'read-mode');before=len(elements());draw(page,[(450,400),(540,450)])
        checked('Read-only mode does not write',len(elements())==before)
        action(page,'read-mode');action(page,'bookmark-page');saved(page)
        if not page.locator('#rail-filter').is_visible():action(page,'toggle-rail')
        page.locator('#rail-filter').select_option('bookmarks')
        checked('Page bookmarks persist and filter the rail',book()['pages'][0]['bookmark'] and page.locator('.thumbnail').count()==1)
        # Layer locks protect the active layer; user can create a writable layer.
        action(page,'layers');page.locator('[data-layer-lock="0"]').click();action(page,'close-modal');before=len(elements());draw(page,[(450,450),(540,490)])
        checked('Locked layers reject new ink',len(elements())==before)
        action(page,'layers');page.locator('#add-layer').click();page.locator('#text-value').fill('Ghi chú mới');page.locator('button[form=text-form]').click();action(page,'close-modal');draw(page,[(440,470),(530,490)])
        checked('New ink belongs to the selected layer',elements()[-1]['layer']==1)
        action(page,'layers');page.locator('[data-layer-visible="1"]').click();action(page,'close-modal');saved(page)
        checked('Layer visibility persists',book()['pages'][0]['layers'][1]['visible']==False)
        # Keep layers visible for preview, then test page paper options.
        action(page,'layers');page.locator('[data-layer-visible="1"]').click();action(page,'close-modal')
        action(page,'editor-more');action(page,'current-template');page.locator('[data-choose-template=cornell]').click();page.locator('#paper-color').fill('#fff9e9');page.locator('#paper-color').dispatch_event('input');action(page,'close-modal');saved(page)
        checked('Additional templates and paper colors persist',book()['pages'][0]['template']=='cornell' and book()['pages'][0]['paperColor']=='#fff9e9')
        page.screenshot(path=str(OUT/'v2-ink-gallery.png'))
        with page.expect_download() as dl:action(page,'editor-more');page.locator('[data-action=export-png]').click()
        dl.value.save_as(str(OUT/'v2-page.png'));checked('PNG export is a real PNG',(OUT/'v2-page.png').read_bytes().startswith(b'\x89PNG'))
        with page.expect_file_chooser() as fc:tool(page,'image')
        fc.value.set_files(str(ROOT/'icon.png'));page.wait_for_timeout(150);saved(page)
        action(page,'selection-style');page.locator('#crop-image').click();page.locator('#crop-left').fill('20');page.locator('#crop-top').fill('10');page.locator('button[form=crop-form]').click();saved(page)
        checked('Image crop retains its original source',elements()[-1]['type']=='image' and elements()[-1]['crop']=={'x':.2,'y':.1,'w':.8,'h':.9} and elements()[-1]['src'].startswith('data:image/png'))
        page.keyboard.press('Escape');tool(page,'shape');page.locator('#shape').select_option('arrow');draw(page,[(430,530),(580,580)])
        checked('Arrow drawing works on the active layer',elements()[-1]['type']=='arrow' and elements()[-1]['layer']==1)
        page.locator('#shape').select_option('triangle');page.locator('#shape-fill').check();draw(page,[(430,650),(550,760)])
        checked('Filled triangles retain their fill setting',elements()[-1]['type']=='triangle' and elements()[-1]['fill'])
        tool(page,'pen');settings(page);page.locator('#setting-pattern').select_option('dashed');action(page,'close-modal');draw(page,[(420,820),(580,820)])
        checked('Dashed ink style persists',elements()[-1]['pattern']=='dashed')
        before=len(elements());c=page.locator('#paper');r=c.bounding_box();s=c.evaluate('c=>parseFloat(c.style.width)')/794
        page.evaluate("document.querySelector('#paper').addEventListener('pointerdown',e=>window.lastPointerId=e.pointerId,{once:true})")
        page.mouse.move(r['x']+100*s,r['y']+870*s);page.mouse.down();page.mouse.move(r['x']+200*s,r['y']+880*s)
        page.evaluate("document.querySelector('#paper').dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.lastPointerId,bubbles:true}))");page.mouse.up();saved(page)
        checked('Cancelled pen input does not leave an unwanted stroke',len(elements())==before)
        tool(page,'sticker');page.locator('[data-insert-element]').first.click();saved(page)
        checked('Saved elements can be reused on a page',len(elements())==before+1)
        action(page,'library');page.locator('[data-open]').filter(has_text='Giải phẫu học').first.click();checked('Multiple document tabs remain open',page.locator('.doc-tab').count()==2)
        action(page,'library')
        with page.expect_file_chooser() as fc:action(page,'import')
        fc.value.set_files(str(OUT/'original-searchable.pdf'));page.locator('#paper').wait_for();saved(page)
        pdfbook=next(n for n in vault(page)['notebooks'] if n['title']=='original-searchable')
        checked('Imported PDF keeps original bytes, searchable text and hyperlinks',bool(pdfbook['pages'][0].get('pdfSource')) and 'Searchable Original' in pdfbook['pages'][0]['pdfText'] and pdfbook['pages'][0]['links'][0]['page']==1)
        action(page,'read-mode');page.locator('#pdf-links button').first.click();checked('Internal PDF link navigates to its destination',page.locator('#page-status').inner_text().startswith('Trang 2'))
        action(page,'read-mode');action(page,'previous-page');tool(page,'pen');draw(page,[(80,120),(180,130)])
        with page.expect_download() as dl:action(page,'export-pdf')
        dl.value.save_as(str(OUT/'v2-preserved.pdf'));page.wait_for_function('!document.querySelector("#modal").open')
        action(page,'library')
        with page.expect_file_chooser() as fc:action(page,'import')
        fc.value.set_files(str(OUT/'v2-preserved.pdf'));page.locator('#paper').wait_for();saved(page)
        roundtrip=next(n for n in vault(page)['notebooks'] if n['title']=='v2-preserved')
        checked('PDF export retains original text after reimport',all('searchable' in p['pdfText'].lower() for p in roundtrip['pages']))
        page.set_viewport_size({'width':800,'height':700});page.screenshot(path=str(OUT/'v2-compact.png'))
        checked('Compact editor has no page-level horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.reload(wait_until='networkidle');page.wait_for_function('window.__papernoteReady')
        checked('V2 library survives reload without losing original data',len(vault(page)['notebooks'])==7 and len(book()['pages'][0]['elements'])>8)
        report['paintBenchmarkMs']=page.evaluate('''async()=>{const {drawStroke}=await import('/ink.mjs');const c=document.createElement('canvas');c.width=900;c.height=1200;const x=c.getContext('2d'),start=performance.now();for(let i=0;i<100;i++){const points=Array.from({length:100},(_,j)=>[40+j*5,20+i*10+Math.sin(j/6)*6,j/100]);drawStroke(x,{type:'stroke',points,pen:'fountain',size:3,color:'#203047',stabilization:.3})}return performance.now()-start}''')
        checked('No external service calls',not report['external']);checked('No uncaught errors',not report['errors']);report['ok']=True
    except Exception as e:
        report['ok']=False;report['failure']=str(e);page.screenshot(path=str(OUT/'v2-failure.png'));raise
    finally:
        (OUT/'v2-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
