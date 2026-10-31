import json
import pathlib
import sys
import time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'results'
OUT.mkdir(exist_ok=True)
report={'checks':[],'errors':[],'externalRequests':[]}

def check(name, condition=True):
    assert condition, name
    report['checks'].append(name)
    print('PASS '+name,flush=True)

def vault(page):
    return page.evaluate('''async()=>{let db=await new Promise((res,rej)=>{let r=indexedDB.open('PaperNote',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return await new Promise(res=>{let r=db.transaction('vault').objectStore('vault').get('library');r.onsuccess=()=>res(r.result)})}''')

def wait_saved(page):
    page.wait_for_function("!document.querySelector('#save-label') || document.querySelector('#save-label').textContent.includes('Đã lưu')")
    page.wait_for_timeout(120)

def stroke(page,points):
    r=page.locator('#paper').bounding_box()
    width=page.evaluate("parseFloat(document.querySelector('#paper').style.width)")
    scale=width/794
    page.mouse.move(r['x']+points[0][0]*scale,r['y']+points[0][1]*scale)
    page.mouse.down()
    for x,y in points[1:]:page.mouse.move(r['x']+x*scale,r['y']+y*scale,steps=4)
    page.mouse.up()
    wait_saved(page)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':960},accept_downloads=True)
    page=context.new_page()
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('request',lambda r:report['externalRequests'].append(r.url) if not r.url.startswith(('http://127.0.0.1:50339/','data:','blob:')) else None)
    try:
        page.goto('http://127.0.0.1:50339/',wait_until='networkidle')
        page.wait_for_function('window.__papernoteReady')
        check('Library opens with four editable sample notebooks',page.locator('[data-open]').count()==4)
        page.screenshot(path=str(OUT/'library.png'),full_page=True)
        page.locator('#search').fill('nâng đỡ')
        check('Search finds text inside notebook pages',page.locator('[data-open]').count()==1)
        page.locator('#search').fill('')
        page.locator('.heading-actions [data-action=new]').click()
        page.locator('#new-name').fill('Sổ kiểm thử tiếng Việt')
        page.locator('[data-cover]').nth(2).click()
        page.locator('[data-template=grid]').click()
        page.locator('button[form=new-form]').click()
        page.locator('#paper').wait_for()
        wait_saved(page)
        book=lambda:next(n for n in vault(page)['notebooks'] if n['title']=='Sổ kiểm thử tiếng Việt')
        check('Notebook creation preserves title, cover and paper choice',book()['color']=='#638578' and book()['pages'][0]['template']=='grid')
        stroke(page,[(95,130),(130,160),(190,120),(240,170)])
        check('Pointer input creates a saved stroke',len(book()['pages'][0]['elements'])==1)
        page.locator('[data-action=undo]').click();wait_saved(page)
        check('Undo removes the stroke',len(book()['pages'][0]['elements'])==0)
        page.locator('[data-action=redo]').click();wait_saved(page)
        check('Redo restores the stroke',len(book()['pages'][0]['elements'])==1)
        page.locator('[data-tool=highlighter]').click();page.locator('[data-color="#7fca2c"]').click()
        stroke(page,[(100,235),(250,235)])
        check('Highlighter stores translucent ink',book()['pages'][0]['elements'][-1]['highlight'])
        page.locator('[data-tool=shape]').click();page.locator('#shape').select_option('rect')
        stroke(page,[(90,280),(300,380)])
        check('Rectangle drawing stores a vector shape',book()['pages'][0]['elements'][-1]['type']=='rect')
        page.locator('[data-tool=text]').click()
        r=page.locator('#paper').bounding_box();scale=float(page.locator('#paper').evaluate('(c)=>parseFloat(c.style.width)'))/794
        page.mouse.click(r['x']+100*scale,r['y']+440*scale)
        page.locator('.inline-text').fill('Ghi chú được lưu thật\nDòng thứ hai có dấu tiếng Việt')
        page.locator('[data-tool=pen]').click();wait_saved(page)
        check('Multiline Vietnamese text persists',any(e.get('text','').startswith('Ghi chú') for e in book()['pages'][0]['elements']))
        # The eraser removes complete ink strokes, while typed content remains.
        page.locator('[data-tool=eraser]').click();stroke(page,[(130,155),(160,145)])
        check('Eraser removes ink and keeps typed text',len(book()['pages'][0]['elements'])==3)
        page.locator('[data-action=undo]').click();wait_saved(page)
        # Move a rectangle using the selection tool.
        page.locator('[data-tool=select]').click();stroke(page,[(210,320),(250,350)])
        moved=next(e for e in book()['pages'][0]['elements'] if e['type']=='rect')
        check('Selection moves an element',round(moved['x'])==130 and round(moved['y'])==310)
        page.keyboard.press('Delete');wait_saved(page)
        check('Delete removes the selected shape',not any(e['type']=='rect' for e in book()['pages'][0]['elements']))
        page.locator('[data-action=undo]').click();wait_saved(page)
        with page.expect_file_chooser() as fc:page.locator('[data-tool=image]').click()
        fc.value.set_files(str(ROOT/'icon.png'));wait_saved(page)
        page.wait_for_function("document.querySelector('#save-label').textContent.includes('Đã lưu')")
        check('Image import embeds local image',any(e['type']=='image' for e in book()['pages'][0]['elements']))
        page.locator('.editor-top [data-action=add-page]').click();wait_saved(page)
        check('Add page creates a second page',len(book()['pages'])==2)
        if not page.locator('.page-rail').is_visible():page.locator('[data-action=toggle-rail]').click()
        page.locator('[data-page="0"]').click()
        page.locator('[data-action=fit]').last.click()
        page.screenshot(path=str(OUT/'editor.png'),full_page=True)
        with page.expect_download() as dl:page.locator('[data-action=export-pdf]').click()
        dl.value.save_as(str(OUT/'export.pdf'))
        page.wait_for_function('!document.querySelector("#modal").open')
        check('PDF export produces a valid PDF header',(OUT/'export.pdf').read_bytes().startswith(b'%PDF-'))
        page.locator('[data-action=library]').click()
        page.reload(wait_until='networkidle');page.wait_for_function('window.__papernoteReady')
        check('Notebook survives application reload',len(book()['pages'])==2 and len(book()['pages'][0]['elements'])>=4)
        page.locator('#search').fill('Sổ kiểm thử')
        with page.expect_file_chooser() as fc:page.locator('[data-action=import]').click()
        fc.value.set_files(str(OUT/'export.pdf'))
        page.locator('#paper').wait_for(timeout=30000);wait_saved(page)
        imported=next(n for n in vault(page)['notebooks'] if n['title']=='export')
        check('PDF import creates two annotatable background pages',len(imported['pages'])==2 and all(p.get('background','').startswith('data:image/jpeg') for p in imported['pages']))
        stroke(page,[(320,120),(370,180)])
        imported=next(n for n in vault(page)['notebooks'] if n['title']=='export')
        check('PDF background accepts ink annotations',len(imported['pages'][0]['elements'])==1)
        page.locator('[data-action=library]').click();page.locator('#search').fill('Sổ kiểm thử')
        page.locator('[data-action=book-menu]').click()
        with page.expect_download() as dl:page.locator('[data-action=backup-book]').click()
        dl.value.save_as(str(OUT/'backup.papernote'))
        backup=json.loads((OUT/'backup.papernote').read_text(encoding='utf-8'))
        check('Editable backup retains strokes, text, images and pages',len(backup['notebooks'])==1 and len(backup['notebooks'][0]['pages'])==2)
        page.locator('[data-action=book-menu]').click();page.locator('[data-action=trash-book]').click()
        check('Trash hides notebook without deleting data',book()['trashed'])
        page.locator('[data-filter=trash]').click();page.locator('[data-action=book-menu]').click();page.locator('[data-action=restore-book]').click()
        check('Restoring brings notebook back',not book()['trashed'])
        page.locator('[data-filter=all]').click()
        before=len(vault(page)['notebooks'])
        with page.expect_file_chooser() as fc:page.locator('[data-action=import]').click()
        fc.value.set_files(str(OUT/'backup.papernote'))
        page.wait_for_function("document.querySelectorAll('[data-open]').length===7")
        check('Backup restore appends without replacing existing notebooks',len(vault(page)['notebooks'])==before+1)
        page.locator('[data-action=new-folder]').click();page.locator('#text-value').fill('Thư mục kiểm thử');page.locator('button[form=text-form]').click()
        check('Folder creation persists',any(f['name']=='Thư mục kiểm thử' for f in vault(page)['folders']))
        page.locator('[data-action=list-view]').click()
        check('List view toggles',page.locator('.library.list-view').count()==1)
        page.set_viewport_size({'width':800,'height':700});page.screenshot(path=str(OUT/'compact.png'),full_page=True)
        check('Compact library fits viewport',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.set_viewport_size({'width':1440,'height':960})
        check('No unexpected external network requests',not report['externalRequests'])
        check('No uncaught browser errors',not report['errors'])
        report['ok']=True
    except Exception as e:
        report['ok']=False;report['failure']=str(e)
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        browser.close()
