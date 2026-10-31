import json,pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'atlas-desktop'/'tools'/'python-packages'))
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'tests'/'results';OUT.mkdir(exist_ok=True)
report={'checks':[],'errors':[]}
def check(name,ok=True):
    assert ok,name
    report['checks'].append(name);print('PASS '+name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True)
    page=browser.new_page(viewport={'width':1400,'height':1020},device_scale_factor=1)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    try:
        page.goto('http://127.0.0.1:50339/',wait_until='networkidle');page.wait_for_function('window.__papernoteReady')
        page.locator('.heading-actions [data-action=new]').click();page.locator('#new-name').fill('Smooth ink regression');page.locator('[data-template=blank]').click();page.locator('button[form=new-form]').click();page.locator('#paper').wait_for();page.wait_for_timeout(100)
        r=page.locator('#paper').bounding_box();scale=r['width']/794
        page.evaluate('''()=>{window.savedRAF=window.requestAnimationFrame;window.inkFrames=[];window.requestAnimationFrame=cb=>{window.inkFrames.push(cb);return window.inkFrames.length}}''')
        client=page.context.new_cdp_session(page)
        def event(kind,x,y,pressure=.5):
            client.send('Input.dispatchMouseEvent',{'type':kind,'x':r['x']+x*scale,'y':r['y']+y*scale,'button':'left','buttons':0 if kind=='mouseReleased' else 1,'clickCount':1,'pointerType':'pen','force':pressure})
        event('mousePressed',80,120,.2)
        for i in range(1,41):event('mouseMoved',80+i*6,120+(1.25 if i%2 else -1.25),.65 if i%2 else .35)
        check('Input burst queues only one paint frame',page.evaluate('window.inkFrames.length')==1)
        event('mouseReleased',335,125,0)
        check('Pointer release does not queue redundant paints',page.evaluate('window.inkFrames.length')==1)
        page.evaluate('''()=>{window.requestAnimationFrame=window.savedRAF;for(const cb of window.inkFrames)cb(performance.now());window.inkFrames=[]}''');client.detach()
        page.wait_for_function("document.querySelector('#save-label').textContent.includes('Đã lưu')");page.wait_for_timeout(100)
        data=page.evaluate('''async()=>{const db=await new Promise(r=>{const q=indexedDB.open('PaperNote');q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const q=db.transaction('vault').objectStore('vault').get('library');q.onsuccess=()=>r(q.result)})}''')
        ink=next(n for n in data['notebooks'] if n['title']=='Smooth ink regression')['pages'][0]['elements'][0]
        check('Coalesced pen samples retain raw pressure values',len(ink['points'])>=42 and max(v[2] for v in ink['points'])>.6)
        check('Final pointer-up position is retained without zero-pressure spike',abs(ink['points'][-1][0]-335)<.01 and abs(ink['points'][-1][1]-125)<.01 and ink['points'][-1][2]>.3)
        before=page.locator('#paper').evaluate('c=>c.toDataURL()')
        page.reload(wait_until='networkidle');page.wait_for_function('window.__papernoteReady');page.get_by_role('button',name='Mở Smooth ink regression',exact=True).click();page.locator('#paper').wait_for();page.wait_for_timeout(200)
        check('Saved and reloaded ink has identical pixels',page.locator('#paper').evaluate('c=>c.toDataURL()')==before)
        alpha=page.evaluate('''async()=>{const {drawStroke}=await import('/ink.mjs');const c=document.createElement('canvas');c.width=150;c.height=80;const x=c.getContext('2d');drawStroke(x,{points:[[25,35,.5],[125,35,.5]],size:20,pen:'pencil',color:'#000000',stabilization:.3,sharpness:0});return [x.getImageData(25,35,1,1).data[3],x.getImageData(75,35,1,1).data[3]]}''')
        check('Graphite end caps have no extra dark blobs',abs(alpha[0]-alpha[1])<=1)
        old=(ROOT/'before-v2.1'/'ink.mjs').read_text(encoding='utf-8')
        result=page.evaluate('''async oldSource=>{
            const url=URL.createObjectURL(new Blob([oldSource],{type:'text/javascript'}));const old=await import(url),now=await import('/ink.mjs');URL.revokeObjectURL(url);
            const c=document.createElement('canvas');c.width=1400;c.height=800;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#203047';x.font='26px Segoe UI';x.fillText('Trước sửa',55,50);x.fillText('Sau sửa',755,50);x.strokeStyle='#dfe7f1';x.beginPath();x.moveTo(700,20);x.lineTo(700,780);x.stroke();
            const names={fountain:'Bút máy',ball:'Bút bi',brush:'Bút cọ',pencil:'Bút chì'};
            for(const [i,pen] of Object.keys(names).entries()){const y=135+i*170;x.font='18px Segoe UI';x.fillStyle='#536882';x.fillText(names[pen],55,y-25);x.fillText(names[pen],755,y-25);const points=Array.from({length:361},(_,j)=>[60+j*1.5,y+Math.sin(j/40)*24+(j%2?1.25:-1.25),.55+(j%2?.18:-.18)]);const e={points,size:6,pen,color:'#244b69',stabilization:.3,sensitivity:.5,flatness:.2,sharpness:.3};old.drawStroke(x,e);now.drawStroke(x,{...e,points:points.map(p=>[p[0]+700,p[1],p[2]])});}
            const n=Array.from({length:121},(_,i)=>[i,i===0||i===120?0:(i%2?1.25:-1.25),.5]);const rms=engine=>{const a=engine.strokeSamples({points:n,stabilization:.3}).filter(p=>p[0]>12&&p[0]<108);return Math.sqrt(a.reduce((s,p)=>s+p[1]*p[1],0)/a.length)};
            document.body.innerHTML='';document.body.append(c);return {image:c.toDataURL(),beforeRms:rms(old),afterRms:rms(now)};
        }''',old)
        import base64
        (OUT/'smoothing-comparison.png').write_bytes(base64.b64decode(result.pop('image').split(',')[1]));report['syntheticJitter']=result
        check('Synthetic jitter is reduced by at least 80 percent',result['afterRms']<result['beforeRms']*.2)
        check('No browser errors',not report['errors']);report['ok']=True
    except Exception as e:
        report['ok']=False;report['failure']=str(e);page.screenshot(path=str(OUT/'smoothing-failure.png'));raise
    finally:
        (OUT/'smoothing-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
