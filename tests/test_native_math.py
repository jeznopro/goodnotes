import json,os,pathlib,subprocess,sys,time,urllib.request,uuid
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';report={'checks':[],'errors':[]}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS '+name,flush=True)
exe=pathlib.Path(os.environ.get('PAPERNOTE_TEST_EXE',str(ROOT/'dist'/'PaperNote'/'PaperNote.exe')))
profile=ROOT/'tests'/('native-math-profile-'+uuid.uuid4().hex)
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
proc=subprocess.Popen([str(exe),'--profile',str(profile),'--debug-port','50346'],startupinfo=startup)
def saved():return json.loads((profile/'library.json').read_text(encoding='utf-8'))
def images():return [e for n in saved()['notebooks'] for pg in n['pages'] for e in pg['elements'] if e.get('geo')]
def math_page(context):
    for i in range(100):
        found=[p for p in context.pages if p.url.startswith('https://papernote-math.local/') and not p.is_closed()]
        if found:return found[-1]
        context.pages[0].wait_for_timeout(100)
    raise RuntimeError('GeoGebra window did not open')
try:
    for i in range(150):
        try:
            with urllib.request.urlopen('http://127.0.0.1:50346/json/version',timeout=.5) as r:r.read()
            break
        except Exception:time.sleep(.2)
    else:raise RuntimeError('Native test endpoint did not open')
    with sync_playwright() as p:
        browser=p.chromium.connect_over_cdp('http://127.0.0.1:50346');context=browser.contexts[0];main=context.pages[0];main.wait_for_function('window.__papernoteReady')
        main.get_by_role('button',name='Mở Giải phẫu học',exact=True).click();main.locator('#paper').wait_for();main.locator('[data-action=math-menu]').click()
        check('Editor offers graphing and geometry modes',main.locator('[data-action=math-new]').count()==4)
        main.locator('[data-app=graphing]').click();geo=math_page(context);geo.on('pageerror',lambda e:report['errors'].append(str(e)));print('Loading live GeoGebra graphing app...',flush=True)
        geo.wait_for_function('window.__papernoteMathReady',timeout=120000)
        check('Official GeoGebra loads inside its own Windows origin',geo.evaluate('location.origin')=='https://papernote-math.local' and geo.evaluate('api.getVersion()')!='')
        check('Live graphing evaluates a quadratic function',geo.evaluate("api.evalCommand('f(x)=x^2')") and geo.evaluate("api.exists('f')"))
        geo.wait_for_timeout(600);geo.screenshot(path=str(OUT/'native-geogebra-graphing.png'));geo.locator('#insert').click();main.wait_for_function("document.querySelector('[data-action=math-edit]')",timeout=30000)
        first=images()[0];check('Insertion persists PNG plus editable GeoGebra construction',first['src'].startswith('data:image/png;base64,iVBOR') and first['geo']['ggb'].startswith('UEs') and len(first['geo']['ggb'])>1000)
        if not geo.is_closed():geo.wait_for_event('close',timeout=30000)
        check('GeoGebra window closes only after local saving confirms',geo.is_closed())
        main.locator('[data-action=math-edit]').click();geo=math_page(context);geo.wait_for_function('window.__papernoteMathReady',timeout=120000)
        check('Reopening loads the original quadratic construction',geo.evaluate("api.exists('f')") and abs(geo.evaluate("api.getValue('f(2)')")-4)<.001)
        geo.evaluate("api.evalCommand('A=(1,2)')");geo.locator('#insert').click();main.wait_for_function("document.querySelector('[data-action=math-edit]')",timeout=30000)
        if not geo.is_closed():geo.wait_for_event('close',timeout=30000)
        updated=images()[0];check('Editing updates the same image instead of adding a duplicate',len(images())==1 and updated['id']==first['id'] and updated['geo']['ggb']!=first['geo']['ggb'])
        main.keyboard.press('Control+z');main.wait_for_function("document.querySelector('#save-label').textContent.includes('Đã lưu')");check('Undo restores the prior GeoGebra data',images()[0]['geo']['ggb']==first['geo']['ggb']);main.keyboard.press('Control+y');main.wait_for_function("document.querySelector('#save-label').textContent.includes('Đã lưu')")
        main.locator('[data-action=math-menu]').click();main.locator('[data-app=geometry]').click();geo=math_page(context);print('Loading live GeoGebra geometry app...',flush=True);geo.wait_for_function('window.__papernoteMathReady',timeout=120000)
        check('Geometry constructs points and a segment',geo.evaluate('(s)=>api.evalCommand(s)','P=(0,0)\nQ=(3,2)\ns=Segment(P,Q)') and geo.evaluate("api.exists('s')"))
        geo.locator('#insert').click();main.wait_for_function("document.querySelector('[data-action=math-edit]')",timeout=30000)
        if not geo.is_closed():geo.wait_for_event('close',timeout=30000)
        check('Geometry is inserted with its own editable data',len(images())==2 and images()[1]['geo']['app']=='geometry')
        main.locator('[data-action=math-menu]').click();main.locator('[data-app="3d"]').click();geo=math_page(context);print('Loading live GeoGebra 3D app...',flush=True);geo.wait_for_function('window.__papernoteMathReady',timeout=120000)
        check('3D constructs a sphere',geo.evaluate("api.evalCommand('s=Sphere((0,0,0),2)')") and geo.evaluate("api.exists('s')"))
        geo.wait_for_timeout(600);geo.screenshot(path=str(OUT/'native-geogebra-3d.png'));geo.locator('#insert').click();main.wait_for_function("document.querySelector('[data-action=math-edit]')",timeout=30000)
        if not geo.is_closed():geo.wait_for_event('close',timeout=30000)
        check('3D exports a PNG and editable construction',len(images())==3 and images()[2]['geo']['app']=='3d')
        main.reload();main.wait_for_function('window.__papernoteReady');main.get_by_role('button',name='Mở Giải phẫu học',exact=True).click();main.locator('#paper').wait_for();check('All inserted constructions survive native reload and validation',len(images())==3)
        main.screenshot(path=str(OUT/'native-geogebra-note.png'))
        main.evaluate("window.chrome.webview.postMessage({type:'flushed'})");proc.wait(timeout=10);check('Native GeoGebra test exits cleanly',proc.returncode==0);report['ok']=True
except Exception as e:
    report['ok']=False;report['failure']=str(e)
    try:
        report['mainToast']=main.locator('#toast').text_content();report['pages']=[pg.url for pg in context.pages];print(json.dumps(report),flush=True)
        with urllib.request.urlopen('http://127.0.0.1:50346/json/list',timeout=2) as r:print(r.read().decode('utf-8'),flush=True)
    except Exception:pass
    try:geo.screenshot(path=str(OUT/'native-geogebra-failure.png'));report['status']=geo.locator('#status').inner_text()
    except Exception:pass
    raise
finally:
    if proc.poll() is None:proc.terminate();proc.wait(timeout=10)
    (OUT/'native-math-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
