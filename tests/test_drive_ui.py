import json,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';report={'checks':[],'errors':[]}
def check(name,value=True):
    assert value,name
    report['checks'].append(name);print('PASS '+name,flush=True)
def vault(page):
    return page.evaluate('''async()=>{const d=await new Promise(r=>{const q=indexedDB.open('PaperNote',1);q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const q=d.transaction('vault').objectStore('vault').get('library');q.onsuccess=()=>r(q.result)})}''')
fake=r'''(()=>{
 const listeners=new Set(),send=data=>setTimeout(()=>listeners.forEach(f=>f({data})),0);
 const state={connected:false,busy:false,email:'',lastSync:'',message:'Chưa kết nối Google Drive'};
 window.__driveTest={calls:[],mode:'ok',restore:'',state,send};
 window.chrome=window.chrome||{};window.chrome.webview={addEventListener:(t,f)=>listeners.add(f),removeEventListener:(t,f)=>listeners.delete(f),postMessage:m=>{
  const test=window.__driveTest;test.calls.push(m);
  if(m.type==='ready')send({type:'vault',data:null});
  else if(m.type==='persist')send({type:'persisted',request:m.request});
  else if(m.type==='drive-status')send({type:'drive-status',...state});
  else if(m.type==='drive-connect'){Object.assign(state,{connected:true,email:'test@example.invalid',clientId:m.clientId,lastSync:new Date().toISOString(),message:'Đã tải lên Google Drive'});send({type:'drive-status',...state});}
  else if(m.type==='drive-sync'){
   state.message=test.mode==='offline'?'Chưa kết nối được Drive. Sổ vẫn lưu trên máy; sẽ tự thử lại khi có mạng.':'Đã tải lên Google Drive';
   if(test.mode==='expired'){Object.assign(state,{connected:false,needsLogin:true,message:'Quyền Google đã hết hạn. Hãy đăng nhập lại.'});}
   send({type:'drive-status',...state});
  }
  else if(m.type==='drive-disconnect'){Object.assign(state,{connected:false,email:'',lastSync:'',message:'Đã ngắt kết nối. Sổ trên máy và bản sao Drive vẫn được giữ.'});send({type:'drive-status',...state});}
  if(m.type.startsWith('drive-'))send({type:'drive-result',request:m.request,data:m.type==='drive-list'?[{id:'file-1',name:'PaperNote-Máy khác.papernote',modifiedTime:new Date().toISOString()}]:m.type==='drive-download'?test.restore:null});
 }};
})()'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':1180,'height':950});page.add_init_script(fake)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    try:
        page.goto('http://127.0.0.1:50339/',wait_until='networkidle');page.wait_for_function('window.__papernoteReady')
        original=vault(page);page.locator('[data-action=settings]').click();page.locator('[data-action=drive-settings]').click()
        check('Drive settings show the offline and per-device behavior','Mỗi máy có bản riêng' in page.locator('#modal').inner_text())
        check('Credentials are entered inside PaperNote',page.locator('#drive-client').count()==1 and page.locator('#drive-secret').get_attribute('type')=='password')
        check('Login cancellation is hidden while no login is running',not page.locator('[data-action=drive-cancel]').is_visible())
        page.locator('[data-action=drive-login]').click();check('Missing Google app credentials are rejected locally','Nhập Client ID' in page.locator('#drive-error').inner_text())
        check('Invalid credentials do not launch Google',page.evaluate("__driveTest.calls.filter(m=>m.type==='drive-connect').length")==0)
        page.locator('#drive-client').fill('test.apps.googleusercontent.com');page.locator('#drive-secret').fill('fake-secret');page.locator('[data-action=drive-login]').click();page.wait_for_function("document.querySelector('#drive-account').textContent==='test@example.invalid'")
        check('Connected settings show Google account and upload time','Lần tải lên gần nhất' in page.locator('#drive-last').inner_text())
        check('Client secret is cleared after connection',page.locator('#drive-secret').input_value()=='')
        check('Credential values are absent from browser preferences','fake-secret' not in page.evaluate('JSON.stringify(localStorage)'))
        page.evaluate("__driveTest.mode='offline'");page.locator('[data-action=drive-sync]').click();page.wait_for_function("document.querySelector('#drive-status').textContent.includes('khi có mạng')")
        check('Offline cloud status leaves local saving intact',vault(page)==original)
        page.evaluate("__driveTest.mode='ok';dispatchEvent(new Event('online'))");page.wait_for_function("document.querySelector('#drive-status').textContent==='Đã tải lên Google Drive'")
        check('Restoring connectivity triggers a cloud retry',page.evaluate("__driveTest.calls.filter(m=>m.type==='drive-sync').length")>=2)
        cloud=json.loads(json.dumps(original));cloud['notebooks']=cloud['notebooks'][:1];cloud['notebooks'][0]['title']='Sổ từ Drive';page.evaluate('value=>__driveTest.restore=value',json.dumps(cloud,ensure_ascii=False))
        page.locator('[data-action=drive-list]').click();page.locator('[data-action=drive-restore]').wait_for();check('Drive offers named snapshots with restore controls','Máy khác' in page.locator('[data-action=drive-restore]').inner_text())
        page.locator('[data-action=drive-restore]').click();page.wait_for_function('!document.querySelector("#modal").open');after=vault(page)
        check('Restoring imports a separate notebook',len(after['notebooks'])==len(original['notebooks'])+1 and any(n['title']=='Sổ từ Drive' for n in after['notebooks']))
        check('Restoring preserves every existing notebook ID',set(n['id'] for n in original['notebooks']).issubset(set(n['id'] for n in after['notebooks'])))
        page.locator('[data-action=settings]').click();page.locator('[data-action=drive-settings]').click();page.evaluate("__driveTest.restore=JSON.stringify({version:1,notebooks:[{id:'bad'}],folders:[]})");page.locator('[data-action=drive-list]').click();page.locator('[data-action=drive-restore]').click();page.wait_for_function("document.querySelector('#toast').textContent.includes('không hợp lệ')")
        check('Malformed cloud backups are rejected without changing the vault',vault(page)==after)
        page.locator('[data-action=drive-settings]').click();page.evaluate("""()=>{const n={id:'n',title:'Limit',color:'#203047',pages:[{id:'p',width:794,height:1123,template:'blank',elements:[]}]};__driveTest.restore=JSON.stringify({version:1,folders:[{id:'limit-folder',name:'Do not add'}],notebooks:Array.from({length:1000},(_,i)=>({...n,id:'n'+i}))})}""");page.locator('[data-action=drive-list]').click();page.locator('[data-action=drive-restore]').click();page.wait_for_function("document.querySelector('#toast').textContent.includes('vượt giới hạn')")
        check('Restore limits reject the whole import without adding folders or notebooks',vault(page)==after)
        page.locator('[data-action=drive-settings]').click();page.evaluate("__driveTest.mode='expired'");page.locator('[data-action=drive-sync]').click();page.wait_for_function("document.querySelector('#drive-status').textContent.includes('hết hạn')")
        label=page.locator('[data-action=drive-login]').text_content();saved=vault(page)
        if label!='Đăng nhập Google' or saved!=after:print('Expired diagnostics: '+json.dumps({'label':label,'savedKeys':list(saved),'afterKeys':list(after),'equal':saved==after},ensure_ascii=False),flush=True)
        check('Expired Google permissions expose reconnect without losing notes',label=='Đăng nhập Google' and saved==after)
        page.locator('[data-action=drive-help]').click();check('Connection guide explains Desktop credentials, API and shared client ID','Desktop app' in page.locator('#modal').inner_text() and 'Google Drive API' in page.locator('#modal').inner_text() and 'cùng một Client ID' in page.locator('#modal').inner_text())
        page.locator('[data-action=drive-settings]').click();page.locator('#drive-client').fill('test.apps.googleusercontent.com');page.locator('#drive-secret').fill('fake-secret');page.locator('[data-action=drive-login]').click();page.wait_for_function("document.querySelector('[data-action=drive-disconnect]').offsetParent!==null")
        page.screenshot(path=str(OUT/'drive-settings.png'));page.locator('[data-action=drive-disconnect]').click();page.wait_for_function("document.querySelector('#drive-account').textContent==='Chưa đăng nhập'")
        check('Disconnect preserves the local library',vault(page)==after)
        page.set_viewport_size({'width':800,'height':650});check('Drive form fits the supported compact window',page.evaluate('document.documentElement.scrollWidth<=innerWidth') and page.locator('#modal').bounding_box()['width']<800)
        page.locator('[data-action=close-modal]').click();page.locator('[data-open]').first.click();page.locator('#paper').wait_for();page.keyboard.press('Control+s');page.wait_for_function("document.querySelector('#save-label').textContent.includes('Đã lưu')")
        check('Writing and saving remain available after disconnect',page.locator('#paper').count()==1)
        check('No UI runtime errors',not report['errors']);report['ok']=True
    except Exception as e:
        report['ok']=False;report['failure']=str(e);page.screenshot(path=str(OUT/'drive-ui-failure.png'));raise
    finally:
        (OUT/'drive-ui-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
