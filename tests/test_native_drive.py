import json,os,pathlib,subprocess,sys,time,urllib.request,uuid
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';report={'checks':[]}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS '+name,flush=True)
exe=pathlib.Path(os.environ.get('PAPERNOTE_TEST_EXE',str(ROOT/'dist'/'PaperNote'/'PaperNote.exe')))
profile=ROOT/'tests'/('native-drive-profile-'+uuid.uuid4().hex)
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
proc=subprocess.Popen([str(exe),'--profile',str(profile),'--debug-port','50344'],startupinfo=startup)
try:
    for i in range(150):
        try:
            with urllib.request.urlopen('http://127.0.0.1:50344/json/version',timeout=.5) as r:r.read()
            break
        except Exception:time.sleep(.2)
    else:raise RuntimeError('Native test endpoint did not open')
    with sync_playwright() as p:
        browser=p.chromium.connect_over_cdp('http://127.0.0.1:50344');page=browser.contexts[0].pages[0];page.wait_for_function('window.__papernoteReady')
        page.locator('[data-action=settings]').click();page.locator('[data-action=drive-settings]').click();page.wait_for_function("document.querySelector('#drive-status').textContent.includes('Chưa kết nối')")
        check('Windows bridge returns the actual disconnected Drive state',page.locator('#drive-account').inner_text()=='Chưa đăng nhập')
        check('Native connection form hides idle cancellation',not page.locator('[data-action=drive-cancel]').is_visible())
        page.locator('[data-action=drive-login]').click();check('Windows app validates missing credentials before login','Nhập Client ID' in page.locator('#drive-error').inner_text())
        check('Connecting is optional and writes no credentials by default',not (profile/'drive-account.bin').exists())
        page.screenshot(path=str(OUT/'native-drive-settings.png'))
        page.locator('[data-action=drive-help]').click();check('Windows app includes its connection guide','Desktop app' in page.locator('#modal').inner_text())
        page.locator('[data-action=close-modal]').click();page.get_by_role('button',name='Mở Giải phẫu học',exact=True).click();page.locator('#paper').wait_for();page.keyboard.press('Control+s');page.wait_for_function("document.querySelector('#save-label').textContent.includes('Đã lưu')")
        check('Native disk saving still confirms successfully',json.loads((profile/'library.json').read_text(encoding='utf-8'))['notebooks'][0]['title']=='Giải phẫu học')
        page.evaluate("window.chrome.webview.postMessage({type:'flushed'})");proc.wait(timeout=10);check('Native Drive test exits cleanly',proc.returncode==0);report['ok']=True
except Exception as e:
    report['ok']=False;report['failure']=str(e);raise
finally:
    if proc.poll() is None:proc.terminate();proc.wait(timeout=10)
    (OUT/'native-drive-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
