const bridge=window.chrome?.webview;
const insert=document.querySelector('#insert'),status=document.querySelector('#status'),retry=document.querySelector('#retry'),loading=document.querySelector('#loading');
let api,app,initialized=false;
function failed(message){status.textContent=message;loading.textContent=message;retry.hidden=false;}
function dirty(){bridge?.postMessage({type:'math-dirty'});}
function resize(){if(api){const box=document.querySelector('#workspace');api.setSize(box.clientWidth,box.clientHeight);}}
function start(data){
 if(initialized)return;initialized=true;app=data.app;
 const labels={graphing:'Đồ thị hàm số',geometry:'Dựng hình học', '3d':'Đồ thị & hình học 3D',classic:'GeoGebra Classic'};
 document.querySelector('#mode').textContent=labels[app]||labels.graphing;
 const timer=setTimeout(()=>failed('GeoGebra tải chậm. Kiểm tra mạng rồi thử tải lại.'),90000);
 const launch=async()=>{
  try{
   const box=document.querySelector('#workspace');
   const params={appName:app,width:box.clientWidth,height:box.clientHeight,language:'vi',showToolBar:true,showAlgebraInput:true,showMenuBar:true,showZoomButtons:true,enableFileFeatures:false,enableUndoRedo:true,showLogging:false,showStartTooltip:false,showKeyboardOnFocus:'auto',disableJavaScript:true,useBrowserForJS:true,randomize:false,appletOnLoad:loaded=>{
    if(api)return;api=loaded;window.__papernoteMathReady=true;clearTimeout(timer);loading.hidden=true;retry.hidden=true;insert.disabled=false;status.textContent='Vẽ xong, bấm Chèn vào trang ghi chú. Dữ liệu được giữ để sửa lại.';
    for(const method of ['registerAddListener','registerUpdateListener','registerRemoveListener'])api[method](dirty);
    resize();
   }};
   if(data.ggb)params.ggbBase64=data.ggb;
   if(data.runtime){const loaded=params.appletOnLoad;delete params.appletOnLoad;const {mathApps}=await import(data.runtime);await mathApps.create(params).inject(document.querySelector('#ggb')).getAPI().then(loaded);}
   else new GGBApplet(params,true).inject('ggb');
  }catch{clearTimeout(timer);failed('Chưa khởi động được GeoGebra. Kiểm tra bản GeoGebra đã cài hoặc mạng rồi thử lại.');}
 };
 if(data.runtime){status.textContent='Đang mở GeoGebra đã cài trên máy…';launch();}
 else{const script=document.createElement('script');script.src='https://www.geogebra.org/apps/deployggb.js';script.onerror=()=>{clearTimeout(timer);failed('Chưa tải được GeoGebra. Kiểm tra mạng hoặc cài GeoGebra Classic 6 rồi mở lại.');};script.onload=launch;document.head.append(script);}
}
insert.onclick=()=>{
 if(!api)return;insert.disabled=true;status.textContent='Đang chèn hình và dữ liệu vào ghi chú…';
 try{api.getBase64(ggb=>{
  try{const png=api.getPNGBase64(1.5,false,undefined);if(!ggb||!png)throw Error();bridge.postMessage({type:'math-result',ggb,png});}
  catch{insert.disabled=false;status.textContent='Chưa xuất được hình. Chọn vùng đồ thị rồi thử chèn lại.';}
 });}catch{insert.disabled=false;status.textContent='Chưa xuất được hình. Hãy thử chèn lại.';}
};
retry.onclick=()=>location.reload();window.addEventListener('resize',resize);
bridge?.addEventListener('message',event=>{const m=event.data;if(m.type==='math-init')start(m);else if(m.type==='math-rejected'){insert.disabled=false;status.textContent=m.message;}});
if(bridge)bridge.postMessage({type:'math-ready'});else failed('Mở GeoGebra từ bản ứng dụng PaperNote cho Windows.');
