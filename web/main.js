import { PDFDocument,degrees } from 'pdf-lib';
import { Directory,Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import {penNames,drawStroke,strokeHit,splitStroke,distanceToSegment,insidePolygon,scaleElement,rotateElement,recognizeShape} from './ink.mjs';
import {validateLibrary} from './schema.mjs';
import {toolbarIcons} from './toolbar-icons.mjs';

const $ = (s, root = document) => root.querySelector(s);
const app = $('#app'), modal = $('#modal');
const native = window.chrome?.webview;
const isIOS = Capacitor.getPlatform() === 'ios';
const paths = {
 math:'M4 3v17h17M6 15c3 0 3-9 6-9s3 10 8 10M8 19v2m5-2v2m5-2v2',
 home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
 book:'M5 3.5h11a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3M4 17.5a3 3 0 0 1 3-3h12M8 7.5h7M8 10.5h5',
 logo:'M5 5h9M5 10h7M5 15h4m8-10 3 1-4 12-4 2 1-4z',
 grid:'M5 3h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m11 0h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M5 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2m11 0h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2',
 star:'m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.5l6.2-.9z',
 clock:'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 folder:'M3 7V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
 trash:'M4 6h16M9 6V4h6v2M6 6l.8 13a2 2 0 0 0 2 2h6.4a2 2 0 0 0 2-2L18 6M10 10v7m4-7v7',
 settings:'M9.5 3.5h5l.6 2.1 1.5.9 2.1-.5 2.5 4.3-1.5 1.6v1.8l1.5 1.6-2.5 4.3-2.1-.5-1.5.9-.6 2.1h-5l-.6-2.1-1.5-.9-2.1.5-2.5-4.3 1.5-1.6v-1.8l-1.5-1.6 2.5-4.3 2.1.5 1.5-.9zM15 12.8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 plus:'M12 5v14M5 12h14',minus:'M5 12h14',search:'m16.5 16.5 4 4M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
 chevron:'m9 6 6 6-6 6',down:'m6 9 6 6 6-6',back:'m15 6-6 6 6 6',up:'m6 15 6-6 6 6',close:'m6 6 12 12M6 18 18 6',
 more:'M5 12h.01M12 12h.01M19 12h.01',import:'M12 3v11m-4-4 4 4 4-4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',
 export:'M12 15V3m-4 4 4-4 4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',list:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
 check:'m5 12 4 4L19 6',cloud:'M6 17a5 5 0 0 1-.5-9.9 7 7 0 0 1 13-1A5.5 5.5 0 0 1 19 17m-10 0 3 3 5-6',
 undo:'m8 5-5 5 5 5M3 10h10a6 6 0 0 1 6 6v3',redo:'m16 5 5 5-5 5m5-5H11a6 6 0 0 0-6 6v3',
 pen:'m15 3 6 6-8 10-10 2 2-10zM15 3l-1 7 7-1M3 21l7-7m3-2a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
 fountain:'m15 3 6 6-8 10-10 2 2-10zM15 3l-1 7 7-1M3 21l7-7m3-2a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
 ball:'m5 15 11-11a2.8 2.8 0 0 1 4 4L9 19l-6 2zM14 6l4 4M5 15l4 4',
 brush:'m12 13 6-9a2.5 2.5 0 0 1 4 3l-9 8m-1-2a4 4 0 0 0-6 2c-.6 2.5-2 4-4 5 4 1 8 1 10-2a4 4 0 0 0 0-5z',
 pencil:'m5 15 11-11a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3L9 19l-6 2zM14 6l4 4M5 15l4 4M3 21l2-6',
 highlighter:'m9 4 11 8-6 8-8-6zM6 14l-2 4 4 3 4-3M3 21h9M8 7l9 7',
 eraser:'m4 13 9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8H9l-5-4a2 2 0 0 1 0-3zM8 9l8 8M13 20h8',
 text:'M4 6V4h16v2M12 4v16M8 20h8',shape:'M5 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m16 11a7 7 0 1 1-7-7',
 select:'M17 16c3-1 5-3 5-6 0-4-5-7-10-7S2 6 2 10c0 3 3 5 7 6m3-3a3 3 0 1 1-6 0 3 3 0 0 1 6 0m-3 3c0 3 2 5 5 5',
 hand:'M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 4-3 6-7 6-3 0-4-1-6-3l-4-5a2 2 0 0 1 3-2l2 2',
 image:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m-2 14 6-6 4 4 3-3 5 5M16 7h.01',
 sidebar:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M9 3v18M5 7h1m-1 4h1',
 zoom:'M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4M4 15v4a1 1 0 0 0 1 1h4m6 0h4a1 1 0 0 0 1-1v-4',
 duplicate:'M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2m6-6H5a2 2 0 0 0-2 2v11',
 help:'M9.5 8a2.7 2.7 0 1 1 4.3 2.2c-1.4.8-1.8 1.3-1.8 2.8m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 restore:'M3 5v5h5M3.5 10a8.5 8.5 0 1 1 .8 7M12 7v5l3 2',
 tape:'M5 7h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2m2 0 3 10m2-10 3 10m2-10 3 10',
 laser:'m4 20 7-7m2-9v2m5 0-2 2m4 4h-2m0 6-2-2m-3-3h.01',
 ruler:'m4 15 11-11a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 20a2 2 0 0 1-3 0l-2-2a2 2 0 0 1 0-3zm3-3 3 3m0-6 2 2m1-5 3 3',
 sticker:'M5 3h14a2 2 0 0 1 2 2v9l-7 7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m9 18v-5a2 2 0 0 1 2-2h5M8 8h6m-6 4h3',
 bookmark:'M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z',
 layers:'m12 3 10 5-10 5L2 8zm-9 10 9 4.5 9-4.5m-18 5 9 4.5 9-4.5',
 lock:'M7 10h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2m1 0V7a4 4 0 0 1 8 0v3m-4 5v2',
 eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 cut:'m9 8 11 12M9 16 20 4M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0m0 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 paste:'M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6a1 1 0 0 1 1 1v3H8V4a1 1 0 0 1 1-1z',
 rotate:'M3 9a9 9 0 1 1 2 9M3 3v6h6',crop:'M7 3v13a1 1 0 0 0 1 1h13M3 7h13a1 1 0 0 1 1 1v13'
};
const icon = (name) => typeof toolbarIcons[name]==='string'?toolbarIcons[name]:`<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.book}"/></svg>`;
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const clone = x => structuredClone(x);
const covers = ['#284d68','#bd806d','#638578','#6e6792','#b29355','#424b60'];
const templateNames = {lined:'Kẻ dòng',grid:'Ô vuông',dotted:'Chấm bi',blank:'Giấy trắng',cornell:'Cornell',music:'Khuông nhạc',planner:'Kế hoạch'};
const tools = {pen:'Bút viết',pencil:'Bút chì',highlighter:'Đánh dấu',eraser:'Tẩy',select:'Lasso & chọn',shape:'Hình vẽ',tape:'Băng che',text:'Gõ chữ',image:'Chèn ảnh',sticker:'Bộ sưu tập',laser:'Con trỏ laser',hand:'Di chuyển trang'};
const W = 794, H = 1123;
let library, db, current = null, pageIndex = 0, filter = 'all', folderId = null, query = '', sort = 'updated', listView = false;
let tool = 'pen', ink = '#ff9818', penSize = 3, shape = 'rect', zoom = 0.8, railVisible = false;
let canvas, ctx, drawing = null, selection = [], selectionBox = null, textEdit = null;
let touchPoints=new Map(),suppressedTouches=new Set(),activeStylusPointers=new Set(),stylusHoverPointers=new Set(),lastStylusActivity=-Infinity,pinchGesture=null,wheelPageDelta=0,wheelPageReset=null;
const stylusDetected=()=>activeStylusPointers.size>0||stylusHoverPointers.size>0||performance.now()-lastStylusActivity<350;
for(const type of ['pointerup','pointercancel'])window.addEventListener(type,e=>suppressedTouches.delete(e.pointerId),true);
let histories = new Map(), imageCache = new Map(), saveChain = Promise.resolve(), toastTimer, renderToken = 0;
let saving = false, saveError = false, nativePending = new Map();
let driveState={connected:false,busy:false,message:'Chưa kết nối Google Drive'},drivePending=new Map(),mathPending=new Map();
function mathMenu(){
 if(!current)return;finishText();
 showModal('GeoGebra',`<p class="modal-description">Vẽ trong cửa sổ GeoGebra rồi chèn vào trang hiện tại. Hình và dữ liệu được lưu cùng sổ để mở lại chỉnh sửa.</p><div class="menu-options">${[['graphing','Đồ thị hàm số'],['geometry','Dựng hình học'],['3d','Đồ thị & hình học 3D'],['classic','GeoGebra Classic']].map(([app,label])=>`<button data-action="math-new" data-app="${app}">${icon('math')}${label}</button>`).join('')}</div><p class="modal-description" style="margin-top:16px">Cần mạng để mở GeoGebra. Hình đã chèn vẫn xem, viết chú thích và xuất PDF khi ngoại tuyến.</p>`);
}
function openMath(app='graphing',existing=null){
 if(!native){toast('GeoGebra có trong bản ứng dụng PaperNote cho Windows.');return;}
 if(readOnly||!currentLayerEditable()||existing&&!editable(existing)){toast('Chuyển sang chế độ viết và lớp không khóa để dùng GeoGebra.');return;}
 finishText();closeModal();const request=uid();mathPending.set(request,{bookId:current.id,pageId:activePage().id,elementId:existing?.id||uid(),existing:!!existing,layer:existing?.layer??activeLayer});
 native.postMessage({type:'math-open',request,app:existing?.geo?.app||app,ggb:existing?.geo?.ggb||''});
}
async function insertMath(m){
 const target=mathPending.get(m.request);if(!target||target.saving)return;target.saving=true;
 try{
  const book=library.notebooks.find(n=>n.id===target.bookId),page=book?.pages.find(p=>p.id===target.pageId);
  if(!page||book.trashed||page.layers?.[target.layer]?.locked||page.layers?.[target.layer]?.visible===false||readOnly)throw Error('Trang hoặc lớp gốc không còn cho phép chỉnh sửa. Hãy đóng cửa sổ và chọn lại trang.');
  let existing=page.elements.find(e=>e.id===target.elementId);if(target.existing&&!existing)throw Error('Hình gốc đã bị xóa. Hãy mở GeoGebra mới để chèn lại.');
  const element={id:target.elementId,type:'image',x:page.width*.1,y:page.height*.1,w:Math.min(600,page.width*.8),h:300,layer:target.layer,src:'data:image/png;base64,'+m.png,geo:{app:m.app,ggb:m.ggb}};
  validate({version:1,folders:[],notebooks:[{...book,pages:[{id:page.id,width:page.width,height:page.height,template:page.template,elements:[element]}]}]});
  const img=await imageFor(element.src);if(!img||img.width>16000||img.height>16000)throw Error('Ảnh GeoGebra không hợp lệ hoặc quá lớn.');
  element.h=element.w*img.height/img.width;if(element.h>page.height*.8){element.h=page.height*.8;element.w=element.h*img.width/img.height;}
  if(existing)Object.assign(element,{x:existing.x,y:existing.y,w:existing.w,h:existing.h,rotation:existing.rotation});
  const visible=current?.id===book.id&&activePage().id===page.id;if(visible)checkpoint();
  if(existing)Object.assign(existing,element);else page.elements.push(element);book.updated=Date.now();
  await persist(false);if(visible){paperRevision++;if(tool!=='select')setTool('select');selection=[element.id];paint();renderThumbs();updateUndo();updateContext();}
  native.postMessage({type:'math-accepted',request:m.request});mathPending.delete(m.request);toast('Đã chèn GeoGebra. Nhấp đúp hình bằng công cụ chọn để sửa lại.');
 }catch(e){target.saving=false;native.postMessage({type:'math-rejected',request:m.request,message:e.message});toast(e.message);}
}
function driveRequest(type,data={}){
 if(!native)return Promise.reject(Error('Đồng bộ Drive có trong ứng dụng Windows.'));
 return new Promise((resolve,reject)=>{const request=uid(),timeout=setTimeout(()=>{drivePending.delete(request);reject(Error('Drive phản hồi chậm. Sổ vẫn được lưu trên máy.'));},420000);drivePending.set(request,{resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(Error(error));}});native.postMessage({type,request,...data});});
}
function driveStatus(){
 const local=$('.offline');if(local){local.textContent=driveState.connected?'Google Drive · '+driveState.message:'Được lưu trên máy của bạn';local.title=driveState.message;}
 const saved=$('#save-label');if(saved)saved.title=driveState.message;
 const el=$('#drive-status');if(el)el.textContent=driveState.message;
 const account=$('#drive-account');if(account)account.textContent=driveState.email||'Chưa đăng nhập';
 const last=$('#drive-last');if(last)last.textContent=driveState.lastSync?'Lần tải lên gần nhất: '+new Date(driveState.lastSync).toLocaleString('vi-VN'):'Chưa có bản tải lên thành công.';
 modal.querySelectorAll('[data-drive-connected]').forEach(el=>el.hidden=!driveState.connected);
 modal.querySelectorAll('[data-drive-idle]').forEach(el=>el.disabled=!!driveState.busy);
 const cancel=$('[data-action=drive-cancel]');if(cancel)cancel.hidden=!driveState.authenticating;
 const login=$('[data-action=drive-login]');if(login)login.textContent=driveState.connected?'Kết nối tài khoản khác':'Đăng nhập Google';
}
function driveSettings(){
 showModal('Đồng bộ Google Drive',`<p class="modal-description">Tự tải bản sao thư viện lên thư mục PaperNote trong Drive. Mất mạng vẫn viết bình thường; ứng dụng tự thử lại khi có mạng. Mỗi máy có bản riêng.</p>${native?`<section class="drive-summary"><strong id="drive-account"></strong><p id="drive-status" role="status" aria-live="polite"></p><small id="drive-last"></small></section><div class="drive-actions" data-drive-connected><button class="primary" data-action="drive-sync" data-drive-idle>${icon('cloud')}Đồng bộ ngay</button><button class="secondary" data-action="drive-list" data-drive-idle>${icon('restore')}Khôi phục từ Drive</button><button class="secondary" data-action="drive-disconnect" data-drive-idle>Ngắt kết nối</button></div><details id="drive-credentials" ${driveState.connected?'':'open'}><summary>Thiết lập kết nối Google</summary><p class="modal-description">Nhập mã OAuth loại Desktop app từ Google Cloud. Thông tin kết nối được Windows bảo vệ trên máy này.</p><label class="field">Client ID<input id="drive-client" autocomplete="off" spellcheck="false" value="${esc(driveState.clientId||'')}" placeholder="….apps.googleusercontent.com"></label><label class="field">Client secret<input id="drive-secret" type="password" autocomplete="off" placeholder="Client secret của Desktop app"></label><p id="drive-error" class="drive-error" role="alert"></p><div class="drive-actions"><button class="primary" data-action="drive-login" data-drive-idle>Đăng nhập Google</button><button class="secondary" data-action="drive-cancel" hidden>Hủy đăng nhập</button></div></details>`:`<p class="modal-description">${isIOS?'Đồng bộ Google Drive chưa được kết nối trong bản iPad. Sổ vẫn được lưu ngoại tuyến trên iPad.':'Mở bản ứng dụng Windows để đăng nhập và tự đồng bộ Google Drive.'}</p>`}<p class="modal-description drive-note">Khi khôi phục, sổ được nhập thêm vào thư viện hiện tại. Bản Windows tự tải lên khi PaperNote đang mở; chưa tự gộp chỉnh sửa giữa các máy.</p>${isIOS?'':'<button class="secondary" data-action="drive-help">Hướng dẫn kết nối</button>'}`);
 driveStatus();if(native)driveRequest('drive-status').catch(e=>toast(e.message));
}
function driveHelp(){showModal('Kết nối Google Drive',`<ol class="drive-help"><li>Mở Google Cloud Console, chọn dự án của bạn và bật <b>Google Drive API</b>.</li><li>Trong Google Auth Platform, cấu hình Branding và Audience. Nếu ứng dụng ở chế độ Testing, thêm email của bạn vào Test users.</li><li>Trong Data Access, thêm quyền <b>https://www.googleapis.com/auth/drive.file</b>. PaperNote chỉ truy cập các tệp do ứng dụng tạo.</li><li>Trong Clients, chọn OAuth Client ID loại <b>Desktop app</b>. Sao chép Client ID và Client secret vào phần Thiết lập kết nối.</li><li>Bấm Đăng nhập Google, chọn tài khoản trong trình duyệt và chấp nhận quyền Drive. Quay lại PaperNote để xem trạng thái.</li></ol><p class="modal-description">Dùng cùng một Client ID trên các máy để tìm được các bản sao. Nếu Google yêu cầu đăng nhập lại, mở phần kết nối và đăng nhập lại. Không nhập mật khẩu tài khoản Google vào PaperNote.</p><div class="drive-actions"><button class="secondary" data-action="drive-console">Mở Google Cloud</button><button class="primary" data-action="drive-settings">Quay lại kết nối</button></div>`);}
async function driveAction(action,b){
 try{
  if(action==='drive-settings'){driveSettings();return;}
  if(action==='drive-help'){driveHelp();return;}
  if(action==='drive-console'){native?.postMessage({type:'open-url',url:'https://console.cloud.google.com/auth/clients'});return;}
  if(action==='drive-login'){
   const clientId=$('#drive-client').value.trim(),secret=$('#drive-secret').value.trim();
   if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)||!secret){$('#drive-error').textContent='Nhập Client ID và Client secret loại Desktop app.';return;}
   $('#drive-error').textContent='';b.disabled=true;await driveRequest('drive-connect',{clientId,secret});if($('#drive-secret'))$('#drive-secret').value='';driveStatus();return;
  }
  if(action==='drive-sync'){finishText();await persist(false);await driveRequest('drive-sync');return;}
  if(action==='drive-cancel'){await driveRequest('drive-cancel');return;}
  if(action==='drive-disconnect'){await driveRequest('drive-disconnect');driveSettings();return;}
  if(action==='drive-list'){
   b.disabled=true;const files=await driveRequest('drive-list');
   showModal('Khôi phục từ Google Drive',`<p class="modal-description">Chọn bản thư viện cần lấy về. Sổ sẽ được nhập thêm, giữ nguyên sổ trên máy.</p><div class="drive-files">${files.length?files.map(f=>`<button class="secondary" data-action="drive-restore" data-id="${esc(f.id)}"><span>${esc(f.name)}</span><small>${f.modifiedTime?esc(new Date(f.modifiedTime).toLocaleString('vi-VN')):''}</small></button>`).join(''):'<p>Chưa có bản thư viện nào. Hãy đồng bộ từ một máy trước.</p>'}</div><button class="secondary" data-action="drive-settings">Quay lại kết nối</button>`);return;
  }
  if(action==='drive-restore'){
   b.disabled=true;const data=await driveRequest('drive-download',{id:b.dataset.id});await importBackup(JSON.parse(data));closeModal();return;
  }
 }catch(e){const error=$('#drive-error');if(error)error.textContent=e.message;else toast(e.message);}
 finally{if(b?.isConnected)b.disabled=false;driveStatus();}
}
function storedPrefs(){try{return JSON.parse(localStorage.getItem('papernote-tools')||'{}');}catch{return{};}}
let prefs={pen:'fountain',size:3,sensitivity:.5,sharpness:.3,flatness:.2,stabilization:.3,pattern:'solid',drawHold:true,penOnly:true,pressureCurve:1,highlighterStraight:false,eraserMode:'stroke',eraserSize:12,eraseFilter:'all',autoDeselect:false,lasso:'free',font:'Segoe UI',textSize:22,bold:false,italic:false,paperColor:'#ffffff',...storedPrefs()};
let lastWritingTool='pen',clipboard=[],lassoPath=null,ruler=false,rulerAngle=0,readOnly=false,activeLayer=0,openTabs=[],tabPages=new Map(),holdTimer,laserTimer,thumbGeneration=0;
let staticPageCache=null,paperRevision=0;
const savePrefs=()=>localStorage.setItem('papernote-tools',JSON.stringify(prefs));
function layerVisible(e,p=activePage()){return p.layers?.[e.layer||0]?.visible!==false;}
function editable(e,p=activePage()){return layerVisible(e,p)&&!p.layers?.[e.layer||0]?.locked;}
function currentLayerEditable(){return !activePage().layers?.[activeLayer]?.locked&&activePage().layers?.[activeLayer]?.visible!==false;}

function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show'); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3800); }
function button(action, label, glyph, cls = 'icon-button', extra = '') {return `<button class="${cls}" data-action="${action}" title="${label}" aria-label="${label}" ${extra}>${icon(glyph)}</button>`;}
function pageData(template='lined') { return {id:uid(), width:W, height:H, template, elements:[]}; }
function notebook(title, color=covers[0], template='lined', folder=null) { return {id:uid(),title,color,folder,created:Date.now(),updated:Date.now(),favorite:false,trashed:false,pages:[pageData(template)]}; }
function textElement(text,x,y,size=23,color='#294963') { return {id:uid(),type:'text',text,x,y,size,color}; }
function seed() {
 const a=notebook('Giải phẫu học',covers[0],'lined','study');a.favorite=true;
 a.pages[0].elements=[textElement('Giải phẫu học',78,92,38),textElement('Chương 01 — Hệ xương',80,155,24,'#167b70'),textElement('Mục tiêu buổi học',80,225,23),textElement('• Nhận biết cấu trúc và chức năng của hệ xương.\n• Phân biệt xương dài, xương ngắn và xương dẹt.\n• Ghi nhớ các mốc giải phẫu quan trọng.',80,274,19),textElement('Hệ xương nâng đỡ cơ thể, bảo vệ các cơ quan\nvà phối hợp với hệ cơ để tạo nên vận động.',80,418,20),textElement('Ghi chú của bạn',80,548,23,'#167b70'),textElement('Bắt đầu viết tại đây. Mỗi ý tưởng đều đáng được lưu lại.',80,596,17,'#718096')];
 a.pages.push(pageData('grid'));
 const b=notebook('Ý tưởng &\ncảm hứng',covers[1],'dotted');b.title='Ý tưởng & cảm hứng';b.pages[0].elements=[textElement('Một nơi cho ý tưởng',80,100,34,'#9d6151'),textElement('Những điều nhỏ làm nên ngày đẹp trời.',80,172,21),textElement('01   Dành thời gian để quan sát.\n02   Ghi lại điều khiến bạn tò mò.\n03   Thử một cách nhìn mới.',80,270,22)];
 const c=notebook('Kế hoạch tuần',covers[2],'grid');c.favorite=true;c.pages[0].elements=[textElement('Kế hoạch tuần',80,92,34,'#386d5a'),textElement('Ba điều muốn hoàn thành',80,170,23),textElement('☐  Ôn tập kiến thức đã học\n\n☐  Hoàn thành một việc quan trọng\n\n☐  Dành thời gian cho bản thân',80,245,21)];
 const d=notebook('Sổ tay cá nhân',covers[3],'blank');d.pages[0].elements=[textElement('Mỗi ngày một trang mới.',80,110,32,'#6e6792'),textElement('Hôm nay, bạn muốn ghi lại điều gì?',80,182,21)];
 return {version:1,folders:[{id:'study',name:'Học tập'},{id:'personal',name:'Cá nhân'}],notebooks:[a,b,c,d]};
}
async function openDB() {
 db=await new Promise((resolve,reject)=>{const req=indexedDB.open('PaperNote',1);req.onupgradeneeded=()=>req.result.createObjectStore('vault');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 return new Promise((resolve,reject)=>{const req=db.transaction('vault').objectStore('vault').get('library');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
function saveStatus() { $('.statusbar')?.classList.toggle('save-failed',saveError);const el=$('#save-label');if(el)el.innerHTML=icon(saveError?'help':'check')+(saveError?'Chưa lưu — hãy sao lưu ngay':saving?'Đang lưu…':'Đã lưu trên máy'); }
function persist(touch=true) {
 if(current&&touch) current.updated=Date.now();
 const snapshot=clone(library);saving=true;saveStatus();
 const task=saveChain.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite');tx.objectStore('vault').put(snapshot,'library');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Lưu bị gián đoạn'));})).then(async()=>{
  if(native)await new Promise((resolve,reject)=>{const request=uid();const timeout=setTimeout(()=>{nativePending.delete(request);reject(Error('Windows chưa xác nhận lưu dữ liệu.'));},15000);nativePending.set(request,{resolve:()=>{clearTimeout(timeout);resolve();},reject:message=>{clearTimeout(timeout);reject(Error(message));}});native.postMessage({type:'persist',request,data:JSON.stringify(snapshot)});});
  saveError=false;
 }).catch(err=>{saveError=true;toast('Không lưu được dữ liệu: '+err.message+'. Hãy xuất bản sao lưu.');throw err;});
 saveChain=task;task.catch(()=>{}).finally(()=>{if(saveChain===task){saving=false;saveStatus();}});return task;
}
function validate(data) {return validateLibrary(data);}
function relativeDate(value) { const days=Math.floor((Date.now()-(Number(value)||Date.now()))/86400000);return days<=0?'Hôm nay':days===1?'Hôm qua':new Date(value).toLocaleDateString('vi-VN'); }
function getBooks(){return library.notebooks.filter(n=>filter==='trash'?n.trashed:!n.trashed).filter(n=>filter==='favorites'?n.favorite:filter==='folder'?n.folder===folderId:true).filter(n=>!query||[n.title,...n.pages.flatMap(p=>[p.pdfText||'',...p.elements.filter(e=>e.type==='text').map(e=>e.text)])].join(' ').toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title,'vi'):sort==='created'?b.created-a.created:b.updated-a.updated);}
function coverHTML(n){return `<div class="cover" style="--cover:${esc(n.color)}"><span class="cover-sub">PaperNote</span><span class="cover-title">${esc(n.title)}</span><span class="cover-foot">YOUR EVERYDAY NOTES</span><span class="cover-pattern"></span></div>`;}
function cardsHTML() {
 const books=getBooks();$('#book-count').textContent=`${books.length} sổ tay${filter==='trash'?' trong thùng rác':' trong không gian của bạn'}`;
 $('#books').innerHTML=books.map(n=>`<article class="notebook"><button class="cover-button" data-open="${n.id}" aria-label="Mở ${esc(n.title)}">${coverHTML(n)}</button><div><h3 class="notebook-title" title="${esc(n.title)}">${esc(n.title)}</h3><p class="notebook-meta">${n.pages.length} trang · ${relativeDate(n.updated)}</p></div>${filter!=='trash'?`<button class="favorite-cover ${n.favorite?'selected':''}" data-favorite="${n.id}" aria-label="${n.favorite?'Bỏ yêu thích':'Yêu thích'} ${esc(n.title)}" aria-pressed="${n.favorite}">${icon('star')}</button>`:''}${button('book-menu','Tùy chọn sổ','more','icon-button card-menu',`data-id="${n.id}"`)}</article>`).join('')+(filter!=='trash'&&!query?`<button class="cover-button new-cover" data-action="new">${icon('plus')}<span>Tạo sổ mới</span></button>`:'');
 if(!books.length&&(query||filter==='trash'||filter==='favorites'))$('#books').innerHTML=`<div class="empty" style="grid-column:1/-1">${icon(filter==='trash'?'trash':'search')}<h2>${query?'Không tìm thấy sổ':filter==='trash'?'Thùng rác trống':'Chưa có sổ yêu thích'}</h2><p>${query?'Thử tìm bằng tên sổ hoặc nội dung đã gõ.':filter==='trash'?'Sổ đã xóa sẽ xuất hiện tại đây.':'Bấm ngôi sao trên bìa sổ để lưu vào đây.'}</p></div>`;
}
function renderLibrary() {
 cursorHover=false;$('#ink-cursor')?.setAttribute('hidden','');
 renderToken++;current=null;selection=[];drawing=null;textEdit=null;
 const count=library.notebooks.filter(n=>!n.trashed).length;
 const title=filter==='favorites'?'Yêu thích':filter==='recent'?'Gần đây':filter==='trash'?'Thùng rác':filter==='folder'?library.folders.find(f=>f.id===folderId)?.name||'Thư mục':'Tài liệu của tôi';
 const nav=(id,label,glyph,number='')=>`<button class="nav-item ${filter===id?'active':''}" data-filter="${id}" ${filter===id?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span><span class="count">${number}</span></button>`;
 app.innerHTML=`<div class="library ${listView?'list-view':''}"><aside class="sidebar"><div class="brand"><span class="brand-mark">${icon('logo')}</span><span>PaperNote</span></div><nav aria-label="Thư viện">${nav('all','Tài liệu','book',count)}${nav('recent','Gần đây','clock')}${nav('favorites','Yêu thích','star')}</nav><div class="nav-title">Thư mục${button('new-folder','Tạo thư mục','plus')}</div><div class="folder-nav">${library.folders.map(f=>`<button class="nav-item ${filter==='folder'&&folderId===f.id?'active':''}" data-folder="${f.id}">${icon('folder')}<span>${esc(f.name)}</span></button>`).join('')}</div><div class="sidebar-bottom">${nav('trash','Thùng rác','trash')}<button class="nav-item" data-action="settings">${icon('settings')}<span>Cài đặt & sao lưu</span></button><div class="offline"><span class="offline-dot"></span>Được lưu trên máy của bạn</div><div class="profile"><div class="avatar">B</div><div><strong style="font-size:12px;font-weight:600">Không gian của bạn</strong><small>Riêng tư · Ngoại tuyến</small></div></div></div></aside><main class="library-main"><header class="topline"><div class="location">Không gian của bạn &nbsp;/&nbsp; <b>${esc(title)}</b></div><div class="top-actions"><label class="search">${icon('search')}<input id="search" aria-label="Tìm sổ và nội dung" placeholder="Tìm sổ và nội dung…" value="${esc(query)}"></label>${button('help','Phím tắt & hướng dẫn','help')}</div></header><div class="library-heading"><div><h1>${esc(title)}</h1><p id="book-count"></p></div><div class="heading-actions">${filter==='folder'?button('folder-menu','Quản lý thư mục','more','secondary'):''}${filter!=='trash'?`<button class="secondary" data-action="import">${icon('import')}Nhập tài liệu</button><button class="primary" data-action="new">${icon('plus')}Tạo mới</button>`:''}</div></div>${filter==='all'&&!query&&library.folders.length?`<div class="folder-grid">${library.folders.map(f=>`<button class="folder-chip" data-folder="${f.id}">${icon('folder')}<span>${esc(f.name)}</span><span class="muted" style="font-size:11px">${library.notebooks.filter(n=>n.folder===f.id&&!n.trashed).length}</span></button>`).join('')}</div>`:''}<div class="section-row"><h2>${filter==='recent'?'Mở lại ý tưởng gần nhất':filter==='trash'?'Sổ đã xóa':'Tất cả sổ tay'}</h2><div class="sort-group"><select id="sort" aria-label="Sắp xếp sổ"><option value="updated">Sửa gần nhất</option><option value="created">Tạo gần nhất</option><option value="name">Tên sổ A–Z</option></select>${button('grid-view','Dạng lưới','grid','icon-button',`aria-pressed="${!listView}"`)}${button('list-view','Dạng danh sách','list','icon-button',`aria-pressed="${listView}"`)}</div></div><section class="shelf" id="books" aria-label="Sổ tay"></section>${filter!=='trash'?`<div class="hint-banner">${icon('pen')}<div><h3>Ý tưởng hay bắt đầu từ một trang giấy.</h3><p>Viết tay, gõ chữ hoặc thêm tài liệu. Mọi ghi chú luôn ở bên bạn.</p></div><span class="hint-shortcut">Ctrl + N &nbsp; Tạo sổ</span></div>`:''}</main></div>`;
 $('#sort').value=sort;cardsHTML();driveStatus();
 $('#search').addEventListener('input',e=>{query=e.target.value;cardsHTML();});
 $('#sort').addEventListener('change',e=>{sort=e.target.value;cardsHTML();});
}
function showModal(title,body,footer='') {modal.innerHTML=`<div class="modal-head"><h2>${esc(title)}</h2>${button('close-modal','Đóng','close')}</div><div class="modal-body">${body}</div>${footer?`<div class="modal-actions">${footer}</div>`:''}`;if(!modal.open)modal.showModal();requestAnimationFrame(()=>modal.querySelector('input:not([type=color])')?.focus());}
function closeModal(){modal.close();}
function askText(title,value,callback,label='Tên sổ') {showModal(title,`<form id="text-form"><label class="field">${label}<input id="text-value" value="${esc(value)}" maxlength="120" required></label></form>`,`<button class="secondary" data-action="close-modal">Hủy</button><button class="primary" form="text-form" type="submit">Lưu</button>`);$('#text-form').onsubmit=e=>{e.preventDefault();const v=$('#text-value').value.trim();if(!v)return;closeModal();callback(v);};$('#text-value').select();}
function confirmAction(title,message,callback) {showModal(title,`<p class="modal-description">${esc(message)}</p>`,`<button class="secondary" data-action="close-modal">Hủy</button><button class="primary danger-button" id="confirm-do">Xác nhận xóa</button>`);$('#confirm-do').onclick=()=>{closeModal();callback();};}
function newNotebook(){
 let template='lined',color=covers[0];
 showModal('Tạo sổ tay mới',`<form id="new-form"><label class="field">Tên sổ<input id="new-name" placeholder="Ví dụ: Ghi chú bài học" maxlength="120" required></label><div class="field">Bìa sổ<div class="cover-options">${covers.map((c,i)=>`<button type="button" class="cover-option ${i===0?'active':''}" style="--cover:${c}" data-cover="${c}" aria-label="Màu bìa ${i+1}" aria-pressed="${i===0}"></button>`).join('')}</div></div><div class="field">Mẫu giấy<div class="template-options">${Object.entries(templateNames).map(([v,n])=>`<button type="button" class="template-option ${v===template?'active':''}" data-template="${v}" aria-pressed="${v===template}"><span class="mini-paper ${v}"></span>${n}</button>`).join('')}</div></div><label class="field" style="margin-bottom:0">Thư mục<select id="new-folder"><option value="">Không có thư mục</option>${library.folders.map(f=>`<option value="${f.id}" ${folderId===f.id&&filter==='folder'?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label></form>`,`<button class="secondary" data-action="close-modal">Hủy</button><button class="primary" type="submit" form="new-form">Tạo sổ tay</button>`);
 modal.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>{color=b.dataset.cover;modal.querySelectorAll('[data-cover]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});});
 modal.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{template=b.dataset.template;modal.querySelectorAll('[data-template]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});});
 $('#new-form').insertAdjacentHTML('beforeend','<label class="option-check"><input id="new-whiteboard-mode" type="checkbox">Bảng trắng rộng, nền chấm bi</label>');
 $('#new-form').onsubmit=e=>{e.preventDefault();const title=$('#new-name').value.trim();if(!title)return;const n=notebook(title,color,template,$('#new-folder').value||null);if($('#new-whiteboard-mode')?.checked)makeWhiteboard(n.pages[0]);library.notebooks.unshift(n);closeModal();persist(false);openNotebook(n.id);if(n.pages[0].whiteboard)fitPage();};
}
function bookMenu(id) {
 const n=library.notebooks.find(n=>n.id===id);if(!n)return;
 const items=n.trashed?[['restore-book','Khôi phục sổ','restore'],['delete-book','Xóa vĩnh viễn','trash']]:[['open-book','Mở sổ','book'],['rename-book','Đổi tên','pen'],['move-book','Chuyển thư mục','folder'],['duplicate-book','Nhân bản sổ','duplicate'],['backup-book','Xuất sổ (.papernote)','export'],['trash-book','Chuyển vào thùng rác','trash']];
 showModal(n.title,`<div class="menu-options">${items.map(([a,l,i])=>`<button data-action="${a}" data-id="${id}" class="${a.includes('trash')||a.includes('delete')?'danger':''}">${icon(i)}${l}</button>`).join('')}</div>`);
}
function settings(){showModal('Cài đặt & dữ liệu',`<p class="modal-description">PaperNote lưu sổ trên thiết bị này. Hãy tạo bản sao lưu định kỳ hoặc trước khi chuyển máy.</p><div class="settings-row"><div><h3>Google Drive</h3><p>${isIOS?'Chưa kết nối trong bản iPad.':'Tự đồng bộ lên Drive khi có mạng.'}</p></div><button class="secondary" data-action="drive-settings">${icon('cloud')}Kết nối</button></div><div class="settings-row"><div><h3>Sao lưu toàn bộ thư viện</h3><p>Bao gồm trang viết, ảnh và thư mục.</p></div><button class="secondary" data-action="backup-all">${icon('export')}Sao lưu</button></div><div class="settings-row"><div><h3>Khôi phục từ bản sao lưu</h3><p>Nhập thêm sổ, giữ lại thư viện hiện tại.</p></div><button class="secondary" data-action="restore-file">${icon('import')}Khôi phục</button></div><div class="settings-row"><div><h3>Phím tắt & công cụ</h3><p>Viết nhanh hơn bằng bàn phím.</p></div><button class="secondary" data-action="help">Xem</button></div><p class="modal-description" style="margin-top:20px;margin-bottom:0">PaperNote 2.4.1 · ${isIOS?'iPad':'Windows'}<br>Bản ứng dụng độc lập lấy cảm hứng từ Goodnotes.<br>${isIOS?'Lưu ngoại tuyến trên iPad.':'Đồng bộ Google Drive tùy chọn · Lưu ngoại tuyến.'}</p>`);}
function help(){showModal('Một trang giấy, nhiều khả năng',`<p class="modal-description">Chọn bút rồi viết bằng chuột hoặc bút cảm ứng. Chụm hai ngón để phóng to/thu nhỏ; vuốt dọc ở mép giấy để chuyển trang, vuốt tiếp qua trang cuối để thêm trang. Công cụ chọn cho phép kéo một vùng và di chuyển nội dung. Nhấp đúp vào chữ để sửa; nhấn Delete để xóa phần đang chọn. Chọn bàn tay để kéo trang hoặc chạm băng che để ẩn/hiện. Bấm lại công cụ bút để chỉnh ngòi, lực nhấn và ổn định nét. Với bảng vẽ, mở “Thử bảng vẽ” để kiểm tra tín hiệu bút.</p><div class="kbd-grid"><span>Bút viết / Đánh dấu / Tẩy nét</span><kbd>P / H / E</kbd><span>Chọn / Hình vẽ / Gõ chữ</span><kbd>L / S / T</kbd><span>Sao chép / Cắt / Dán</span><kbd>Ctrl + C / X / V</kbd><span>Chọn tất cả / Xóa vùng chọn</span><kbd>Ctrl + A / Delete</kbd><span>Di chuyển vùng chọn</span><kbd>Mũi tên / Shift + Mũi tên</kbd><span>Di chuyển trang</span><kbd>V</kbd><span>Phóng to / Thu nhỏ</span><kbd>Ctrl + dấu cộng / trừ</kbd><span>Hoàn tác / Làm lại</span><kbd>Ctrl + Z / Y</kbd><span>Tạo sổ / Lưu</span><kbd>Ctrl + N / S</kbd><span>Thêm trang mới</span><kbd>Ctrl + Enter</kbd><span>Trang trước / Trang sau</span><kbd>Alt + ← / →</kbd><span>Đóng hộp thoại / Bỏ chọn</span><kbd>Esc</kbd></div>`);}
function activePage(){return current?.pages[pageIndex];}
function makeWhiteboard(p){p.whiteboard=true;p.template='dotted';p.width=Math.max(794,Math.min(5000,innerWidth));p.height=Math.max(1123,Math.min(5000,innerHeight*2));}
function newWhiteboard(){finishText();closeModal();const n=notebook('Bảng trắng chưa đặt tên',covers[0],'dotted');makeWhiteboard(n.pages[0]);library.notebooks.unshift(n);persist(false);openNotebook(n.id);fitPage();}
function syncPalette(){document.querySelectorAll('[data-nib]').forEach(b=>b.setAttribute('aria-pressed',String(['pen','pencil'].includes(tool)&&(tool==='pencil'?'pencil':prefs.pen)===b.dataset.nib)));document.querySelectorAll('[data-size]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.size)===penSize)));}
function openNotebook(id){finishText();if(current)tabPages.set(current.id,pageIndex);current=library.notebooks.find(n=>n.id===id&&!n.trashed);if(!current){toast('Hãy khôi phục sổ trong menu để mở.');return;}if(!openTabs.includes(id))openTabs.push(id);pageIndex=Math.min(tabPages.get(id)||0,current.pages.length-1);selection=[];renderEditor();persist();}
function renderEditor(){
 renderToken++;drawing=null;selection=[];selectionBox=null;lassoPath=null;const p=activePage();if(activeLayer>=(p.layers?.length||1))activeLayer=0;
 app.innerHTML=`<div class="editor ${p.whiteboard?'whiteboard':''}"><header class="editor-top"><div class="editor-utilities">${button('toggle-rail','Hiện hoặc ẩn danh sách trang','sidebar','icon-button',`aria-pressed="${railVisible}"`)}${button('page-search','Tìm trong sổ','search')}${button('layers','Lớp','layers')}${button('read-mode',readOnly?'Chế độ viết':'Chế độ chỉ đọc','document-view','icon-button',`aria-pressed="${readOnly}"`)}</div><div class="toolbar" role="toolbar" aria-label="Công cụ ghi chú">${['select','pen','eraser','text','sticker','image','shape','tape','laser','highlighter','pencil','hand'].map(t=>`<button class="tool ${t===tool?'active':''}" data-tool="${t}" aria-label="${tools[t]}" title="${tools[t]}" aria-pressed="${t===tool}">${icon(t)}</button>`).join('')}<span class="separator"></span>${button('toggle-ruler','Thước','ruler','tool')}</div><div class="editor-actions">${button('add-page','Thêm trang','plus-circle')}${button('export-pdf','Xuất PDF','export')}${button('editor-more','Tùy chọn sổ','more')}</div></header><div class="editor-body"><div class="undo-float" role="group" aria-label="Lịch sử chỉnh sửa">${button('undo','Hoàn tác (Ctrl+Z)','undo')}${button('redo','Làm lại (Ctrl+Y)','redo')}</div><div class="quick-palette" role="toolbar" aria-label="Ngòi bút, độ dày và màu mực"><div class="nib-options">${['fountain','ball','brush','pencil'].map(kind=>`<button class="palette-nib" data-nib="${kind}" title="${penNames[kind]}" aria-label="${penNames[kind]}" aria-pressed="false">${icon(kind)}</button>`).join('')}</div>${button('pen-settings','Cài đặt ngòi bút','down','palette-settings')}<span class="palette-divider"></span>${[1.5,3,6].map((size,i)=>`<button class="size-preset" data-size="${size}" aria-label="Độ dày ${size} px" aria-pressed="${penSize===size}"><span style="height:${i+1}px"></span></button>`).join('')}<select class="width-select" id="width" aria-label="Độ dày nét"></select><span class="palette-divider"></span>${['#000000','#0084ff','#ffffff','#7fca2c','#ff0000'].map(c=>`<button class="color-dot ${ink===c?'active':''}" data-color="${c}" style="--swatch:${c}" aria-label="Màu mực ${c}" aria-pressed="${ink===c}"></button>`).join('')}<label class="palette-custom" title="Màu mực tùy chỉnh"><input class="custom-color" id="custom-color" aria-label="Chọn màu mực tùy chỉnh" type="color" value="${ink}">${icon('down')}</label></div><aside class="page-rail ${railVisible?'':'hidden'}"><div class="rail-title"><span>Trang trong sổ</span><span>${current.pages.length}</span></div><div id="thumbnails"></div><button class="add-page" data-action="add-page">${icon('plus')}Thêm trang</button></aside><main class="desk" id="desk" aria-label="Trang ghi chú"><div class="paper-wrap" id="paper-wrap"><canvas id="paper" aria-label="Trang viết, chọn công cụ trên thanh công cụ để ghi chú" tabindex="0"></canvas></div></main></div><footer class="statusbar"><div class="save-state" id="save-label" role="status"></div><span id="page-status">Trang ${pageIndex+1} / ${current.pages.length} · ${templateNames[p.template]}</span><span class="tool-caption" id="tool-caption">${tools[tool]}</span><div class="zoom-controls">${button('zoom-out','Thu nhỏ','minus')}<button id="zoom-label" data-action="fit" title="Vừa trang" aria-label="Thu phóng hiện tại, bấm để vừa trang">${Math.round(zoom*100)}%</button>${button('zoom-in','Phóng to','plus')}</div></footer><select id="shape" class="shape-select" aria-label="Loại hình vẽ" ${tool!=='shape'?'hidden':''}><option value="rect">Chữ nhật</option><option value="ellipse">Hình elip</option><option value="line">Đường thẳng</option></select></div>`;
 canvas=$('#paper');ctx=canvas.getContext('2d');$('#width').value=penSize;$('#shape').value=shape;
 $('#width').onchange=e=>{finishText();penSize=Number(e.target.value);};$('#shape').onchange=e=>shape=e.target.value;
 $('#custom-color').oninput=e=>{finishText();setColor(e.target.value);};
 mountExtendedUI();attachCanvas();renderThumbs();resizePaper();saveStatus();updateUndo();syncPalette();
}
function resizePaper(){if(!current||!canvas)return;finishText();const p=activePage();const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(p.width*zoom*dpr);canvas.height=Math.round(p.height*zoom*dpr);canvas.style.width=p.width*zoom+'px';canvas.style.height=p.height*zoom+'px';$('#zoom-label').textContent=Math.round(zoom*100)+'%';updateCursor();paint();renderLinks();}
function cancelForPinch(){if(!drawing)return;clearTimeout(holdTimer);const d=drawing;if(d.original)activePage().elements=d.original;if(['draw','erase','move'].includes(d.kind)){const h=getHistory();h.undo.pop();updateUndo();}drawing=null;selectionBox=null;lassoPath=null;paint();updateContext();}
function rejectTouches(){for(const id of touchPoints.keys())suppressedTouches.add(id);if(touchPoints.size){touchPoints.clear();pinchGesture=null;cancelForPinch();}}
function navigatePage(direction){finishText();if(direction>0&&pageIndex===current.pages.length-1){if(!readOnly)addPage();return;}const next=Math.max(0,Math.min(current.pages.length-1,pageIndex+direction));if(next===pageIndex)return;pageIndex=next;renderEditor();}
function fitPage(){if(!current)return;const desk=$('#desk'),p=activePage();zoom=p.whiteboard?Math.max(.2,Math.min(2.5,desk.clientWidth/p.width)):Math.max(.2,Math.min(1.4,(desk.clientWidth-70)/p.width,(desk.clientHeight-60)/p.height));resizePaper();}
let cursorHover=false;
function inkCursor(color=ink,hollow=false){const d=Math.max(1,penSize),side=Math.ceil(d+4),center=side/2,edge=Math.min(1,d/4),r=(d-edge)/2;const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}"><circle cx="${center}" cy="${center}" r="${r}" fill="${hollow?'none':color}" stroke="#000000" stroke-width="${edge}"/></svg>`;return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.floor(center)} ${Math.floor(center)}, crosshair`;}
function updateCursor(){
 if(!canvas)return;let mark=$('#ink-cursor');if(!mark){mark=document.createElement('div');mark.id='ink-cursor';mark.setAttribute('aria-hidden','true');document.body.append(mark);}
 const enabled=!readOnly&&['pen','pencil','highlighter','shape','tape','laser','eraser'].includes(tool),size=tool==='eraser'?prefs.eraserSize*2:tool==='highlighter'?penSize*7:tool==='tape'?penSize*12:tool==='laser'?3:penSize,d=Math.max(1,size*zoom);
 canvas.style.cursor=readOnly||tool==='hand'?'grab':tool==='text'?'text':enabled?'none':'default';mark.hidden=!enabled||!cursorHover;mark.style.width=mark.style.height=d+'px';mark.style.borderWidth=Math.min(1,d/4)+'px';mark.style.background=tool==='eraser'?'transparent':tool==='laser'?'#ff354d':ink;
 const pad=$('#tablet-pad');if(pad)pad.style.cursor=inkCursor();
}
async function imageFor(src){if(!imageCache.has(src)){imageCache.set(src,new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;}));}return imageCache.get(src);}
function paperBackground(c,p){c.fillStyle=p.paperColor||'#ffffff';c.fillRect(0,0,p.width,p.height);c.strokeStyle='#dce3ed';c.fillStyle=p.whiteboard?'#d9dde2':'#b6c5d8';c.lineWidth=.8;const pitch=32;
 if(p.template==='lined'){for(let y=81;y<p.height-35;y+=pitch){c.beginPath();c.moveTo(45,y);c.lineTo(p.width-45,y);c.stroke();}}
 if(p.template==='grid'){for(let x=25;x<p.width;x+=25){c.beginPath();c.moveTo(x,0);c.lineTo(x,p.height);c.stroke();}for(let y=25;y<p.height;y+=25){c.beginPath();c.moveTo(0,y);c.lineTo(p.width,y);c.stroke();}}
 if(p.template==='dotted'){for(let x=32;x<p.width;x+=25)for(let y=32;y<p.height;y+=25){c.beginPath();c.arc(x,y,1,0,Math.PI*2);c.fill();}}
 if(p.template==='cornell'){c.beginPath();c.moveTo(190,80);c.lineTo(190,p.height-175);c.moveTo(45,p.height-175);c.lineTo(p.width-45,p.height-175);c.stroke();for(let y=110;y<p.height-180;y+=32){c.beginPath();c.moveTo(45,y);c.lineTo(p.width-45,y);c.stroke();}}
 if(p.template==='music'){for(let y=100;y<p.height-80;y+=140)for(let i=0;i<5;i++){c.beginPath();c.moveTo(50,y+i*13);c.lineTo(p.width-50,y+i*13);c.stroke();}}
 if(p.template==='planner'){c.font="20px 'Segoe UI'";c.fillStyle='#65778f';c.fillText('Kế hoạch trong tuần',50,65);for(let i=0;i<7;i++){const y=100+i*(p.height-145)/7;c.strokeRect(45,y,p.width-90,(p.height-145)/7);c.fillText(i===6?'Chủ nhật':'Thứ '+(i+2),60,y+32);}}
}
function drawElement(c,e,images) {
 c.save();c.strokeStyle=e.color||'#243952';c.fillStyle=e.color||'#243952';c.lineWidth=e.size||3;c.lineCap='round';c.lineJoin='round';
 if(e.rotation&&e.type!=='stroke'){const b=rawBounds(e);c.translate(b.x+b.w/2,b.y+b.h/2);c.rotate(e.rotation);c.translate(-b.x-b.w/2,-b.y-b.h/2);}
 if(e.pattern==='dashed')c.setLineDash([e.size*4,e.size*2.5]);if(e.pattern==='dotted')c.setLineDash([.1,e.size*2.5]);
 if(e.type==='stroke'){
  drawStroke(c,e);
 }else if(e.type==='text'){if(e.background){const b=rawBounds(e);c.fillStyle=e.background;c.fillRect(b.x-12,b.y-12,b.w+24,b.h+24);c.fillStyle=e.color;}c.font=textFont(e);c.textBaseline='top';e.text.split('\n').forEach((s,i)=>c.fillText(s,e.x,e.y+i*(e.size||22)*1.5));}
 else if(e.type==='image'){const img=images.get(e.src);if(img){if(e.crop){const a=e.crop;c.drawImage(img,a.x*img.width,a.y*img.height,a.w*img.width,a.h*img.height,e.x,e.y,e.w,e.h);}else c.drawImage(img,e.x,e.y,e.w,e.h);}}
 else if(e.type==='line'||e.type==='arrow'){c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+e.w,e.y+e.h);c.stroke();if(e.type==='arrow'){const a=Math.atan2(e.h,e.w),s=Math.max(12,e.size*4);c.beginPath();c.moveTo(e.x+e.w-s*Math.cos(a-.45),e.y+e.h-s*Math.sin(a-.45));c.lineTo(e.x+e.w,e.y+e.h);c.lineTo(e.x+e.w-s*Math.cos(a+.45),e.y+e.h-s*Math.sin(a+.45));c.stroke();}}
 else if(e.type==='rect'){if(e.fill){c.globalAlpha=.16;c.fillRect(e.x,e.y,e.w,e.h);c.globalAlpha=1;}c.strokeRect(e.x,e.y,e.w,e.h);}
 else if(e.type==='ellipse'||e.type==='triangle'){c.beginPath();if(e.type==='ellipse')c.ellipse(e.x+e.w/2,e.y+e.h/2,Math.abs(e.w/2),Math.abs(e.h/2),0,0,Math.PI*2);else{c.moveTo(e.x+e.w/2,e.y);c.lineTo(e.x+e.w,e.y+e.h);c.lineTo(e.x,e.y+e.h);c.closePath();}if(e.fill){c.globalAlpha=.16;c.fill();c.globalAlpha=1;}c.stroke();}
 c.restore();
}
async function preparedImages(p){const srcs=[p.background,...p.elements.filter(e=>e.type==='image').map(e=>e.src)].filter(Boolean);const entries=await Promise.all([...new Set(srcs)].map(async s=>[s,await imageFor(s)]));return new Map(entries);}
async function drawPage(target,p,scale,background=true){const images=await preparedImages(p);const c=target.getContext('2d');c.setTransform(scale,0,0,scale,0,0);c.clearRect(0,0,p.width,p.height);if(background){paperBackground(c,p);if(p.background&&images.get(p.background))c.drawImage(images.get(p.background),0,0,p.width,p.height);}for(const e of p.elements)if(layerVisible(e,p))drawElement(c,{...e,layer:undefined},images);return images;}
let paintGeneration=0,paintFrame=0;
function paint(){if(!paintFrame)paintFrame=requestAnimationFrame(()=>{paintFrame=0;paintNow();});}
async function paintNow(){if(!current||!canvas)return;const generation=++paintGeneration;const p=activePage(),target=canvas,images=await preparedImages(p);if(generation!==paintGeneration||canvas!==target||!target.isConnected)return;
 const c=ctx,scaleX=target.width/p.width,scaleY=target.height/p.height;
 const key=[p.id,paperRevision,target.width,target.height,p.template,p.paperColor,(p.layers||[]).map(l=>l.visible).join(',')].join('|');
 const changing=drawing&&['erase','move'].includes(drawing.kind);
 if(changing||staticPageCache?.key!==key){const base=document.createElement('canvas');base.width=target.width;base.height=target.height;const b=base.getContext('2d');b.setTransform(scaleX,0,0,scaleY,0,0);paperBackground(b,p);if(p.background&&images.get(p.background))b.drawImage(images.get(p.background),0,0,p.width,p.height);for(const e of p.elements)if(layerVisible(e,p))drawElement(b,e,images);if(!changing)staticPageCache={key,canvas:base};else{c.setTransform(1,0,0,1,0,0);c.drawImage(base,0,0);}}
 if(!changing){c.setTransform(1,0,0,1,0,0);c.drawImage(staticPageCache.canvas,0,0);}c.setTransform(scaleX,0,0,scaleY,0,0);
 if(drawing?.element)drawElement(c,drawing.element,images);
 if(ruler){c.save();c.translate(p.width/2,p.height/2);c.rotate(rulerAngle*Math.PI/180);c.fillStyle='#9dc7d64d';c.fillRect(-p.width,-30,p.width*2,60);c.strokeStyle='#648fa9';c.lineWidth=1/zoom;for(let x=-p.width;x<p.width;x+=10){c.beginPath();c.moveTo(x,-30);c.lineTo(x,-30+(x%50===0?20:10));c.stroke();}c.restore();}
 c.save();c.strokeStyle='#1967d2';c.lineWidth=1.5/zoom;c.setLineDash([5/zoom,4/zoom]);if(selection.length){const b=selectionBounds();if(b){c.fillStyle='#1967d20c';c.fillRect(b.x-5,b.y-5,b.w+10,b.h+10);c.strokeRect(b.x-5,b.y-5,b.w+10,b.h+10);}}
 if(selectionBox){const b=normalize(selectionBox);c.fillStyle='#1967d212';c.fillRect(b.x,b.y,b.w,b.h);c.strokeRect(b.x,b.y,b.w,b.h);}
 if(lassoPath?.length){c.beginPath();c.moveTo(lassoPath[0].x,lassoPath[0].y);for(const pt of lassoPath)c.lineTo(pt.x,pt.y);c.closePath();c.fillStyle='#1967d212';c.fill();c.stroke();}c.restore();
}
async function renderThumbs(){const token=++thumbGeneration;const container=$('#thumbnails');if(!container)return;const pages=current.pages.map((p,i)=>({p,i})).filter(({p})=>$('#rail-filter')?.value!=='bookmarks'||p.bookmark);container.innerHTML=pages.map(({p,i})=>`<div class="thumb-row"><button class="thumbnail ${i===pageIndex?'active':''}" data-page="${i}" aria-label="Trang ${i+1}" ${i===pageIndex?'aria-current="page"':''}><canvas width="159" height="${Math.round(159*p.height/p.width)}"></canvas></button><div class="thumb-label">${p.bookmark?'◆ ':''}${i+1}${button('page-menu','Tùy chọn trang '+(i+1),'more','icon-button',`data-index="${i}"`)}</div></div>`).join('');for(let i=0;i<pages.length;i++){if(token!==thumbGeneration)return;const c=container.querySelectorAll('canvas')[i];if(c)await drawPage(c,pages[i].p,159/pages[i].p.width);}}
function getHistory(){const id=activePage()?.id;if(!histories.has(id))histories.set(id,{undo:[],redo:[]});return histories.get(id);}
function checkpoint(){const h=getHistory();h.undo.push(clone(activePage().elements));if(h.undo.length>60)h.undo.shift();h.redo=[];updateUndo();}
function updateUndo(){if(!current)return;const h=getHistory();const u=$('[data-action=undo]'),r=$('[data-action=redo]');if(u)u.disabled=readOnly||!h.undo.length;if(r)r.disabled=readOnly||!h.redo.length;}
function changed(){paperRevision++;selectionBox=null;persist();paint();renderThumbs();updateUndo();updateContext();}
function undo(redo=false){finishText();const h=getHistory(),from=redo?h.redo:h.undo,to=redo?h.undo:h.redo;if(!from.length)return;to.push(clone(activePage().elements));activePage().elements=from.pop();selection=[];changed();}
function textFont(e){return `${e.italic?'italic ':''}${e.bold?'bold ':''}${e.size||22}px '${e.font||'Segoe UI'}',sans-serif`;}
function rawBounds(e){if(e.type==='stroke'){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const pt of e.points){minX=Math.min(minX,pt[0]);maxX=Math.max(maxX,pt[0]);minY=Math.min(minY,pt[1]);maxY=Math.max(maxY,pt[1]);}return{x:minX,y:minY,w:maxX-minX,h:maxY-minY};}if(e.type==='text'){const c=ctx||document.createElement('canvas').getContext('2d');c.save();c.font=textFont(e);const w=Math.max(...e.text.split('\n').map(s=>c.measureText(s).width));c.restore();return{x:e.x,y:e.y,w,h:e.text.split('\n').length*(e.size||22)*1.5};}return normalize(e);}
function bounds(e){const b=rawBounds(e);if(!e.rotation||e.type==='stroke')return b;const c=Math.abs(Math.cos(e.rotation)),s=Math.abs(Math.sin(e.rotation)),w=b.w*c+b.h*s,h=b.w*s+b.h*c;return{x:b.x+b.w/2-w/2,y:b.y+b.h/2-h/2,w,h};}
function normalize(b){return{x:Math.min(b.x,b.x+b.w),y:Math.min(b.y,b.y+b.h),w:Math.abs(b.w),h:Math.abs(b.h)};}
function contains(b,p,pad=5){return p.x>=b.x-pad&&p.x<=b.x+b.w+pad&&p.y>=b.y-pad&&p.y<=b.y+b.h+pad;}
function selectionBounds(){const es=activePage().elements.filter(e=>selection.includes(e.id));if(!es.length)return null;const bs=es.map(bounds),x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y));return{x,y,w:Math.max(...bs.map(b=>b.x+b.w))-x,h:Math.max(...bs.map(b=>b.y+b.h))-y};}
function moveElement(e,dx,dy){if(e.type==='stroke')e.points=e.points.map(p=>[p[0]+dx,p[1]+dy,p[2]]);else{e.x+=dx;e.y+=dy;}}
function hitElement(p){return [...activePage().elements].reverse().find(e=>editable(e)&&(e.type==='stroke'?strokeHit(e,p,8):contains(bounds(e),p,8)));}
function eraseAt(p,from=p){const elements=activePage().elements;for(let i=elements.length-1;i>=0;i--){const e=elements[i];if(!editable(e)||e.type!=='stroke')continue;const kind=e.highlight?'highlight':e.tape?'tape':e.pen==='pencil'?'pencil':'pen';if(prefs.eraseFilter!=='all'&&kind!==prefs.eraseFilter)continue;const r=prefs.eraserSize;if(prefs.eraserMode==='stroke'){if(e.points.some((a,j)=>distanceToSegment({x:a[0],y:a[1]},[from.x,from.y],[p.x,p.y])<=r+e.size/2)||strokeHit(e,p,r))elements.splice(i,1);}else{const parts=splitStroke(e,from,p,r);if(parts.length!==1||parts[0]!==e)elements.splice(i,1,...parts);}}}
function setTool(t,settingsOnRepeat=true){finishText();if(settingsOnRepeat&&tool===t&&['pen','pencil','highlighter','eraser'].includes(t)){penSettings();return;}if(['pen','pencil','highlighter'].includes(t))lastWritingTool=t;tool=t;selection=[];drawing=null;selectionBox=null;lassoPath=null;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===t);b.setAttribute('aria-pressed',b.dataset.tool===t);});$('#shape').hidden=t!=='shape';$('#tool-caption').innerHTML=icon(t)+tools[t];updateCursor();syncPalette();paint();updateContext();if(t==='image')insertImage();if(t==='sticker')elementsModal();}
function setColor(color){ink=color;document.querySelectorAll('[data-color]').forEach(b=>{b.classList.toggle('active',b.dataset.color===ink);b.setAttribute('aria-pressed',b.dataset.color===ink);});$('#custom-color').value=ink;updateCursor();syncPalette();}
function point(event,r=canvas.getBoundingClientRect()){const p=activePage();return{x:(event.clientX-r.left)*p.width/r.width,y:(event.clientY-r.top)*p.height/r.height,pressure:event.pointerType==='pen'?Math.max(.01,event.pressure):.5};}
function attachCanvas(){
 cursorHover=false;updateCursor();
 const track=e=>{if(e.pointerType==='pen'){lastStylusActivity=performance.now();rejectTouches();}cursorHover=true;const mark=$('#ink-cursor');mark.style.transform=`translate3d(${e.clientX}px,${e.clientY}px,0) translate(-50%,-50%)`;updateCursor();};
 canvas.addEventListener('pointerenter',e=>{if(e.pointerType==='pen')stylusHoverPointers.add(e.pointerId);track(e);});canvas.addEventListener('pointermove',track);canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='pen')stylusHoverPointers.delete(e.pointerId);cursorHover=false;updateCursor();});
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='pen'){activeStylusPointers.add(e.pointerId);lastStylusActivity=performance.now();rejectTouches();}
  if(e.pointerType==='touch'){if(stylusDetected()){e.preventDefault();suppressedTouches.add(e.pointerId);return;}touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size>=2){e.preventDefault();canvas.setPointerCapture(e.pointerId);cancelForPinch();const [a,b]=[...touchPoints.values()],rect=canvas.getBoundingClientRect(),x=(a.x+b.x)/2,y=(a.y+b.y)/2;pinchGesture={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,startX:Math.max(0,Math.min(activePage().width,(x-rect.left)/zoom)),startY:Math.max(0,Math.min(activePage().height,(y-rect.top)/zoom))};return;}}
  if(drawing?.kind==='laser'&&drawing.pointer===null)drawing=null;
  if((e.button!==0&&e.button!==5)||drawing)return;e.preventDefault();finishText();canvas.focus({preventScroll:true});const p=point(e);canvas.setPointerCapture(e.pointerId);
  const touchPan=prefs.penOnly&&e.pointerType==='touch',mode=e.button===5?'eraser':touchPan?'hand':tool;
  if(readOnly||mode==='hand'){const hit=hitElement(p);if(hit?.tape){checkpoint();hit.revealed=!hit.revealed;changed();return;}drawing={kind:'hand',pointer:e.pointerId,x:e.clientX,y:e.clientY,left:$('#desk').scrollLeft,top:$('#desk').scrollTop};return;}
  if(!currentLayerEditable()&&!['select','eraser','laser'].includes(mode)){toast('Lớp hiện tại đang khóa hoặc bị ẩn. Mở mục Lớp để chọn lớp khác.');return;}
  if(mode==='text'){editText(p);return;}
  if(mode==='image'){insertImage(p);return;}
  if(mode==='sticker'){elementsModal();return;}
  if(mode==='select'){
   const b=selectionBounds();if(b&&contains(b,p)){checkpoint();drawing={kind:'move',pointer:e.pointerId,start:p,original:clone(activePage().elements)};return;}
   const hit=hitElement(p);selection=hit?[hit.id]:[];
   if(hit){checkpoint();drawing={kind:'move',pointer:e.pointerId,start:p,original:clone(activePage().elements)};}
   else{if(prefs.lasso==='free')lassoPath=[p];else selectionBox={x:p.x,y:p.y,w:0,h:0};drawing={kind:'select',pointer:e.pointerId,start:p};}paint();updateContext();return;
  }
  if(mode!=='laser')checkpoint();if(mode==='eraser'){drawing={kind:'erase',pointer:e.pointerId,original:clone(activePage().elements),last:p};eraseAt(p);paint();return;}
  const element=mode==='shape'?{id:uid(),type:shape,x:p.x,y:p.y,w:0,h:0,size:penSize,color:ink,fill:prefs.shapeFill,pattern:prefs.pattern,layer:activeLayer}:{id:uid(),type:'stroke',points:[[p.x,p.y,p.pressure]],size:mode==='highlighter'?penSize*7:mode==='tape'?penSize*12:mode==='laser'?3:penSize,color:mode==='laser'?'#ff354d':ink,highlight:mode==='highlighter',tape:mode==='tape',pen:mode==='pencil'?'pencil':prefs.pen,sensitivity:prefs.sensitivity,pressureCurve:prefs.pressureCurve,stabilization:prefs.stabilization,sharpness:prefs.sharpness,flatness:prefs.flatness,pattern:prefs.pattern,layer:activeLayer};
  drawing={kind:mode==='laser'?'laser':'draw',pointer:e.pointerId,start:p,element,mode};paint();
 });
 canvas.addEventListener('pointermove',e=>{
  if(suppressedTouches.has(e.pointerId)){e.preventDefault();return;}
  if(touchPoints.has(e.pointerId))touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinchGesture&&touchPoints.size>=2){e.preventDefault();const [a,b]=[...touchPoints.values()],midX=(a.x+b.x)/2,midY=(a.y+b.y)/2,distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));zoom=Math.max(.2,Math.min(2.5,pinchGesture.zoom*distance/pinchGesture.distance));resizePaper();const desk=$('#desk'),rect=canvas.getBoundingClientRect();desk.scrollLeft+=rect.left+pinchGesture.startX*zoom-midX;desk.scrollTop+=rect.top+pinchGesture.startY*zoom-midY;return;}
  if(!drawing||drawing.pointer!==e.pointerId)return;const rect=canvas.getBoundingClientRect(),p=point(e,rect);
  clearTimeout(holdTimer);
  if(drawing.kind==='hand'){const desk=$('#desk');desk.scrollLeft=drawing.left-(e.clientX-drawing.x);desk.scrollTop=drawing.top-(e.clientY-drawing.y);return;}
  if(drawing.kind==='draw'||drawing.kind==='laser'){if(drawing.element.type==='stroke'){
   if(ruler||drawing.mode==='highlighter'&&prefs.highlighterStraight){const a=drawing.start;let x=p.x,y=p.y;if(ruler){const angle=rulerAngle*Math.PI/180,t=(x-a.x)*Math.cos(angle)+(y-a.y)*Math.sin(angle);x=a.x+t*Math.cos(angle);y=a.y+t*Math.sin(angle);}drawing.element.points=[[a.x,a.y,a.pressure],[x,y,p.pressure]];}
   else{const samples=e.getCoalescedEvents?.();for(const sample of samples?.length?samples:[e]){const pt=point(sample,rect);drawing.element.points.push([pt.x,pt.y,pt.pressure]);}}
   if(prefs.drawHold&&drawing.mode==='pen')holdTimer=setTimeout(()=>{if(drawing?.element?.type==='stroke'){drawing.element=recognizeShape(drawing.element);paint();}},750);
  }else{drawing.element.w=p.x-drawing.start.x;drawing.element.h=p.y-drawing.start.y;if(e.shiftKey&&['rect','ellipse'].includes(drawing.element.type)){const side=Math.max(Math.abs(drawing.element.w),Math.abs(drawing.element.h));drawing.element.w=Math.sign(drawing.element.w||1)*side;drawing.element.h=Math.sign(drawing.element.h||1)*side;}}}
  if(drawing.kind==='erase'){eraseAt(p,drawing.last);drawing.last=p;}
  if(drawing.kind==='select'){if(lassoPath)lassoPath.push(p);else{selectionBox.w=p.x-drawing.start.x;selectionBox.h=p.y-drawing.start.y;}}
  if(drawing.kind==='move'){const dx=p.x-drawing.start.x,dy=p.y-drawing.start.y;activePage().elements=clone(drawing.original);for(const el of activePage().elements)if(selection.includes(el.id))moveElement(el,dx,dy);}
  paint();
 });
 const end=e=>{if(suppressedTouches.has(e.pointerId)){suppressedTouches.delete(e.pointerId);e.preventDefault();return;}if(e.pointerType==='pen'){activeStylusPointers.delete(e.pointerId);lastStylusActivity=performance.now();rejectTouches();}if(e.pointerType==='touch'&&touchPoints.has(e.pointerId)){touchPoints.delete(e.pointerId);if(pinchGesture){pinchGesture=null;return;}}if(!drawing||drawing.pointer!==e.pointerId)return;clearTimeout(holdTimer);const d=drawing;
  if(d.element?.type==='stroke'&&!ruler&&!(d.mode==='highlighter'&&prefs.highlighterStraight)){const p=point(e),last=d.element.points.at(-1);if(Math.hypot(p.x-last[0],p.y-last[1])>.01)d.element.points.push([p.x,p.y,last[2]]);}
  const desk=$('#desk'),deltaY=e.clientY-d.y,forwardSwipe=d.kind==='hand'&&e.pointerType==='touch'&&deltaY< -100&&desk.scrollTop+desk.clientHeight>=desk.scrollHeight-2,backwardSwipe=d.kind==='hand'&&e.pointerType==='touch'&&deltaY>100&&desk.scrollTop<=1;drawing=null;
  if(forwardSwipe){navigatePage(1);return;}if(backwardSwipe){navigatePage(-1);return;}
  if(d.kind==='draw')activePage().elements.push(d.element);
  if(d.kind==='select'){const b=selectionBox&&normalize(selectionBox);selection=activePage().elements.filter(el=>{if(!editable(el))return false;const a=bounds(el);return lassoPath?insidePolygon({x:a.x+a.w/2,y:a.y+a.h/2},lassoPath):a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w&&a.y+a.h<=b.y+b.h;}).map(e=>e.id);selectionBox=null;lassoPath=null;paint();updateContext();return;}
  if(d.kind==='laser'){drawing={...d,pointer:null};clearTimeout(laserTimer);laserTimer=setTimeout(()=>{if(drawing?.kind==='laser'){drawing=null;paint();}},600);return;}
   if(d.kind!=='hand')changed();if(d.kind==='erase'&&prefs.autoDeselect){tool='eraser';setTool(lastWritingTool);}
 };
 canvas.addEventListener('pointerup',end);
 canvas.addEventListener('pointercancel',e=>{if(suppressedTouches.has(e.pointerId)){suppressedTouches.delete(e.pointerId);return;}if(e.pointerType==='pen'){activeStylusPointers.delete(e.pointerId);lastStylusActivity=performance.now();rejectTouches();}if(e.pointerType==='touch'){touchPoints.delete(e.pointerId);if(pinchGesture){pinchGesture=null;return;}}if(!drawing||drawing.pointer!==e.pointerId)return;clearTimeout(holdTimer);if(drawing.original)activePage().elements=drawing.original;if(['draw','erase','move'].includes(drawing.kind)){getHistory().undo.pop();updateUndo();}drawing=null;selectionBox=null;lassoPath=null;paint();updateContext();});
 canvas.addEventListener('dblclick',e=>{if(['select','text'].includes(tool)){const p=point(e),hit=hitElement(p);if(hit?.type==='text')editText(p,hit);}});
}
function editText(p,existing=null){finishText();if(!existing)existing=activePage().elements.find(e=>editable(e)&&e.type==='text'&&contains(bounds(e),p));const e=existing||{id:uid(),type:'text',x:p.x,y:p.y,size:prefs.textSize,font:prefs.font,bold:prefs.bold,italic:prefs.italic,color:ink,text:'',layer:activeLayer};
 const input=document.createElement('textarea');input.className='inline-text';input.setAttribute('aria-label','Nội dung ghi chú');input.value=e.text;input.style.left=e.x*zoom+'px';input.style.top=e.y*zoom+'px';input.style.fontSize=e.size*zoom+'px';input.style.color=e.color;input.style.width=Math.min(450*zoom,(activePage().width-e.x)*zoom)+'px';input.style.height=Math.max(70,e.text.split('\n').length*e.size*zoom*1.5+20)+'px';$('#paper-wrap').append(input);
 textEdit={input,element:e,existing:!!existing,original:e.text};input.onblur=()=>finishText();input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();textEdit=null;input.remove();}if(event.key==='Enter'&&event.ctrlKey){event.preventDefault();finishText();} });input.focus();
}
function finishText(){if(!textEdit)return;const edit=textEdit;textEdit=null;const value=edit.input.value.trimEnd();edit.input.onblur=null;edit.input.remove();if(value!==edit.original){checkpoint();if(edit.existing){if(value)edit.element.text=value;else activePage().elements=activePage().elements.filter(e=>e.id!==edit.element.id);}else if(value){edit.element.text=value;activePage().elements.push(edit.element);}changed();}}
function pageMenu(index=pageIndex){const p=current.pages[index];showModal('Trang '+(index+1),`<div class="menu-options"><button id="page-template">${icon('grid')}Đổi mẫu giấy</button><button id="page-copy">${icon('duplicate')}Nhân bản trang</button><button id="page-up" ${index===0?'disabled':''}>${icon('up')}Đưa lên trước</button><button id="page-down" ${index===current.pages.length-1?'disabled':''}>${icon('down')}Đưa xuống sau</button><button id="page-delete" class="danger" ${current.pages.length===1?'disabled':''}>${icon('trash')}Xóa trang</button></div>`);
 $('#page-template').onclick=()=>templateModal(index);
 $('#page-copy').onclick=()=>{const copy=clone(p);copy.id=uid();copy.elements.forEach(e=>e.id=uid());current.pages.splice(index+1,0,copy);pageIndex=index+1;closeModal();persist();renderEditor();};
 const swap=(offset)=>{[current.pages[index],current.pages[index+offset]]=[current.pages[index+offset],current.pages[index]];pageIndex=index+offset;closeModal();persist();renderEditor();};$('#page-up').onclick=()=>swap(-1);$('#page-down').onclick=()=>swap(1);
 $('#page-delete').onclick=()=>confirmAction('Xóa trang?','Trang này cùng nội dung trên trang sẽ bị xóa. Thao tác này không thể hoàn tác.',()=>{histories.delete(p.id);current.pages.splice(index,1);pageIndex=Math.min(index,current.pages.length-1);persist();renderEditor();});
}
function templateModal(index){const p=current.pages[index];showModal('Mẫu giấy',`<div class="template-options">${Object.entries(templateNames).map(([v,n])=>`<button class="template-option ${p.template===v?'active':''}" data-choose-template="${v}"><span class="mini-paper ${v}"></span>${n}</button>`).join('')}</div><div class="form-grid" style="margin-top:20px"><label class="field">Màu giấy<input type="color" id="paper-color" value="${p.paperColor||'#ffffff'}"></label><label class="field">Khổ giấy<select id="paper-size" ${p.background?'disabled':''}><option value="a4">A4 dọc</option><option value="landscape">A4 ngang</option><option value="letter">Letter</option><option value="square">Vuông</option><option value="custom" selected>Hiện tại</option></select></label></div>${p.background?'<p class="modal-description">Trang PDF giữ kích thước gốc. Mẫu giấy nằm phía sau nền PDF.</p>':''}`,`<button class="primary" data-action="close-modal">Xong</button>`);modal.querySelectorAll('[data-choose-template]').forEach(b=>b.onclick=()=>{p.template=b.dataset.chooseTemplate;modal.querySelectorAll('[data-choose-template]').forEach(x=>x.classList.toggle('active',x===b));persist();paint();renderThumbs();$('#page-status').textContent=`Trang ${pageIndex+1} / ${current.pages.length} · ${templateNames[p.template]}`;});$('#paper-color').oninput=e=>{p.paperColor=e.target.value;persist();paint();renderThumbs();};$('#paper-size').onchange=e=>{const sizes={a4:[794,1123],landscape:[1123,794],letter:[816,1056],square:[900,900]};if(!sizes[e.target.value])return;[p.width,p.height]=sizes[e.target.value];persist();resizePaper();renderThumbs();};}
function addPage(){finishText();const p=activePage(),next=pageData(p.template);next.width=p.width;next.height=p.height;next.paperColor=p.paperColor;if(p.whiteboard)next.whiteboard=true;current.pages.splice(pageIndex+1,0,next);pageIndex++;persist();renderEditor();}
async function chooseFile(accept,callback){const input=$('#file-input');input.value='';input.accept=accept;input.onchange=async()=>{const f=input.files[0];if(!f)return;try{await callback(f);}catch(e){closeModal();toast(e.message||'Không đọc được tài liệu.');}};input.click();}
function readDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Không đọc được tệp.'));r.readAsDataURL(file);});}
async function insertImage(position={x:90,y:120}){const docId=current.id,pageId=activePage().id;chooseFile('image/png,image/jpeg,image/webp',async file=>{if(file.size>20*1024*1024)throw Error('Vui lòng chọn ảnh dưới 20 MB.');if(!current||current.id!==docId||activePage().id!==pageId)return;const src=await readDataURL(file);if(!/^data:image\/(png|jpeg|webp);base64,/.test(src))throw Error('Chỉ hỗ trợ PNG, JPEG hoặc WebP.');const img=await imageFor(src);if(!img)throw Error('Ảnh không hợp lệ.');position={x:Math.max(10,Math.min(activePage().width-60,position.x)),y:Math.max(10,Math.min(activePage().height-60,position.y))};const w=Math.max(30,Math.min(500,img.width,activePage().width-position.x-25)),h=img.height*w/img.width;checkpoint();const e={id:uid(),type:'image',src,x:position.x,y:position.y,w,h,layer:activeLayer};activePage().elements.push(e);setTool('select');selection=[e.id];changed();toast('Đã chèn ảnh. Kéo để thay đổi vị trí.');});}
async function download(name,bytes,mime){
 if(Capacitor.isNativePlatform()){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(await bytes.arrayBuffer());
  const file=await Filesystem.writeFile({path:name,data:bytesToBase64(data),directory:Directory.Cache});
  await Share.share({title:name,url:file.uri,dialogTitle:'Lưu hoặc chia sẻ tệp'});return;
 }
 if(native){const data=bytes instanceof Uint8Array?bytes:new Uint8Array(await bytes.arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));native.postMessage({type:'download',name,data:btoa(binary)});return;}
 const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function backup(book=null){finishText();const data=book?{version:1,folders:library.folders,notebooks:[book],sources:Object.fromEntries([...new Set(book.pages.map(p=>p.pdfSource).filter(Boolean))].map(id=>[id,library.sources[id]])),elements:library.elements||[]}:library;await download(book?book.title.replace(/[<>:"/\\|?*]/g,'_')+'.papernote':`PaperNote-Sao-luu-${new Date().toLocaleDateString('sv-SE')}.papernote`,new Blob([JSON.stringify(data)],{type:'application/json'}),'application/json');closeModal();}
function progress(title,message){showModal(title,`<div class="progress"><div class="spinner"></div><span id="progress-message">${esc(message)}</span></div>`);modal.oncancel=e=>e.preventDefault();modal.querySelector('[data-action=close-modal]').disabled=true;}
function endProgress(){modal.oncancel=null;closeModal();}
async function importBackup(data){
 data=validate(data);const merged=clone(library);let count=0;const folderMap=new Map();for(const f of data.folders){const existing=merged.folders.find(x=>x.name===f.name);const id=existing?.id||uid();folderMap.set(f.id,id);if(!existing)merged.folders.push({id,name:f.name});}
  const sourceMap=new Map();merged.sources||={};for(const [old,bytes] of Object.entries(data.sources||{})){const id=uid();sourceMap.set(old,id);merged.sources[id]=bytes;}
  for(const n of data.notebooks){const copy=clone(n);copy.id=uid();copy.folder=folderMap.get(copy.folder)||null;copy.pages.forEach(p=>{p.id=uid();if(p.pdfSource)p.pdfSource=sourceMap.get(p.pdfSource);p.elements.forEach(e=>e.id=uid());});copy.updated=Date.now();merged.notebooks.push(copy);count++;}merged.elements||=[];for(const item of data.elements||[])if(merged.elements.length<200)merged.elements.push({...clone(item),id:uid()});if(merged.notebooks.length>1000||merged.folders.length>2000)throw Error('Thư viện sau khôi phục vượt giới hạn 1000 sổ hoặc 2000 thư mục.');validate(merged);library=merged;await persist(false);renderLibrary();toast(`Đã nhập ${count} sổ từ bản sao lưu.`);
}
async function importFile(file){
 if(file.size>150*1024*1024)throw Error('Vui lòng chọn tài liệu dưới 150 MB.');
 if(/\.(papernote|json)$/i.test(file.name)){
  await importBackup(JSON.parse(await file.text()));return;
 }
 if(!/\.pdf$/i.test(file.name))throw Error('Chọn tệp PDF hoặc bản sao lưu .papernote.');
 progress('Nhập tài liệu PDF','Đang mở tài liệu…');
 try{
  const pdfjs=await import('./pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='./pdf.worker.mjs';
  const originalBytes=new Uint8Array(await file.arrayBuffer());const originalBase64=bytesToBase64(originalBytes);const sourceId=uid();
  const document=await pdfjs.getDocument({data:originalBytes.slice(),cMapUrl:'./cmaps/',cMapPacked:true,standardFontDataUrl:'./standard_fonts/',wasmUrl:'./wasm/'}).promise;
  try{if(document.numPages>150)throw Error('Hiện hỗ trợ tối đa 150 trang mỗi PDF. Hãy tách tài liệu trước khi nhập.');const n=notebook(file.name.replace(/\.pdf$/i,''),covers[4],'blank',filter==='folder'?folderId:null);n.pages=[];
   for(let i=1;i<=document.numPages;i++){$('#progress-message').textContent=`Đang nhập trang ${i} / ${document.numPages}…`;const pdfPage=await document.getPage(i),view=pdfPage.getViewport({scale:1});const scale=Math.min(1.6,1400/Math.max(view.width,view.height));const viewport=pdfPage.getViewport({scale});const c=window.document.createElement('canvas');c.width=Math.ceil(viewport.width);c.height=Math.ceil(viewport.height);await pdfPage.render({canvasContext:c.getContext('2d'),viewport}).promise;const p=pageData('blank');p.height=Math.round(W*view.height/view.width);p.background=c.toDataURL('image/jpeg',.92);p.pdfSource=sourceId;p.pdfPage=i-1;const text=await pdfPage.getTextContent();p.pdfText=text.items.map(t=>t.str).join(' ');p.links=[];for(const a of await pdfPage.getAnnotations()){if(a.subtype!=='Link'||!a.rect)continue;const rect=view.convertToViewportRectangle(a.rect),s=W/view.width;const link={rect:[Math.min(rect[0],rect[2])*s,Math.min(rect[1],rect[3])*s,Math.max(rect[0],rect[2])*s,Math.max(rect[1],rect[3])*s]};if(a.url&&/^https?:\/\//i.test(a.url))link.url=a.url;else if(a.dest){try{const dest=typeof a.dest==='string'?await document.getDestination(a.dest):a.dest;if(dest)link.page=typeof dest[0]==='number'?dest[0]:await document.getPageIndex(dest[0]);}catch{}}if(link.url||Number.isInteger(link.page))p.links.push(link);}n.pages.push(p);pdfPage.cleanup();}
   library.sources||={};library.sources[sourceId]=originalBase64;library.notebooks.unshift(n);await persist(false);endProgress();openNotebook(n.id);toast(`Đã nhập ${n.pages.length} trang, giữ PDF gốc và nội dung tìm kiếm.`);
  }finally{await document.destroy();}
 }catch(e){endProgress();if(/password/i.test(e.message))throw Error('PDF có mật khẩu. Hãy mở khóa tệp trước khi nhập.');throw e;}
}
function bytesToBase64(data){let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);}
// shortcut: new annotations use a raster overlay; add vector export when exported ink must remain editable.
async function exportPDF(){finishText();const n=current;progress('Xuất tài liệu','Đang chuẩn bị các trang…');try{const pdf=await PDFDocument.create(),sources=new Map();pdf.setTitle(n.title);pdf.setCreator('PaperNote 2');for(let i=0;i<n.pages.length;i++){const p=n.pages[i];$('#progress-message').textContent=`Đang xuất trang ${i+1} / ${n.pages.length}…`;let page,original=!!(p.pdfSource&&library.sources?.[p.pdfSource]);if(original){if(!sources.has(p.pdfSource))sources.set(p.pdfSource,await PDFDocument.load(Uint8Array.from(atob(library.sources[p.pdfSource]),c=>c.charCodeAt(0))));const [copied]=await pdf.copyPages(sources.get(p.pdfSource),[p.pdfPage]);page=pdf.addPage(copied);}else page=pdf.addPage([p.width*.75,p.height*.75]);const c=document.createElement('canvas'),scale=1.5;c.width=Math.round(p.width*scale);c.height=Math.round(p.height*scale);await drawPage(c,p,scale,!original);const png=await pdf.embedPng(c.toDataURL('image/png'));const rotation=((page.getRotation().angle%360)+360)%360,box=page.getCropBox();if(rotation===90)page.drawImage(png,{x:box.x,y:box.y+box.height,width:box.height,height:box.width,rotate:degrees(-90)});else if(rotation===270)page.drawImage(png,{x:box.x+box.width,y:box.y,width:box.height,height:box.width,rotate:degrees(90)});else if(rotation===180)page.drawImage(png,{x:box.x+box.width,y:box.y+box.height,width:box.width,height:box.height,rotate:degrees(180)});else page.drawImage(png,{x:box.x,y:box.y,width:box.width,height:box.height});}await download(n.title.replace(/[<>:"/\\|?*]/g,'_')+'.pdf',await pdf.save(),'application/pdf');endProgress();if(!native)toast('Đã xuất tài liệu PDF.');}catch(e){endProgress();toast('Không xuất được PDF: '+e.message);}}

document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.tab){openNotebook(b.dataset.tab);return;}
 if(b.dataset.closeTab){const id=b.dataset.closeTab;openTabs=openTabs.filter(x=>x!==id);if(id===current.id){if(openTabs.length)openNotebook(openTabs.at(-1));else{finishText();renderLibrary();}}else renderEditor();return;}
 if(b.dataset.open){if(filter==='trash')bookMenu(b.dataset.open);else openNotebook(b.dataset.open);return;}
 if(b.dataset.favorite){const n=library.notebooks.find(n=>n.id===b.dataset.favorite);n.favorite=!n.favorite;persist(false);cardsHTML();return;}
 if(b.dataset.filter){filter=b.dataset.filter;folderId=null;query='';renderLibrary();return;}
 if(b.dataset.folder){filter='folder';folderId=b.dataset.folder;query='';renderLibrary();return;}
 if(b.dataset.nib){const kind=b.dataset.nib;if((tool==='pencil'?'pencil':prefs.pen)===kind&&['pen','pencil'].includes(tool)){penSettings();return;}if(kind!=='pencil')prefs.pen=kind;savePrefs();setTool(kind==='pencil'?'pencil':'pen',false);syncPalette();return;}if(b.dataset.size){penSize=Number(b.dataset.size);prefs.size=penSize;savePrefs();$('#width').value=penSize;updateCursor();syncPalette();return;}
 if(b.dataset.tool){setTool(b.dataset.tool);return;}if(b.dataset.color){finishText();setColor(b.dataset.color);return;}
 if(b.dataset.page!==undefined){finishText();pageIndex=Number(b.dataset.page);renderEditor();return;}
 const action=b.dataset.action;if(!action)return;
 if(action.startsWith('drive-')){driveAction(action,b);return;}
 if(action==='new-whiteboard'){newWhiteboard();return;}
 if(current&&readOnly&&['undo','redo','add-page','selection-style','cut-selection','delete-selection','rotate-selection','clear-page','sticky-note','current-template','current-page-menu'].includes(action)){toast('Đang ở chế độ chỉ đọc. Bấm biểu tượng mắt để viết.');return;}
 if(extensionAction(action))return;
 const id=b.dataset.id,n=id?library.notebooks.find(n=>n.id===id):current;
 switch(action){
 case 'close-modal':closeModal();break;
 case 'new':newNotebook();break;
 case 'help':help();break;
 case 'settings':settings();break;
 case 'new-folder':askText('Tạo thư mục','',name=>{library.folders.push({id:uid(),name});persist(false);renderLibrary();},'Tên thư mục');break;
 case 'folder-menu':showModal('Quản lý thư mục',`<div class="menu-options"><button data-action="rename-folder">${icon('pen')}Đổi tên thư mục</button><button data-action="delete-folder" class="danger">${icon('trash')}Xóa thư mục</button></div>`);break;
 case 'rename-folder':askText('Đổi tên thư mục',library.folders.find(f=>f.id===folderId).name,name=>{library.folders.find(f=>f.id===folderId).name=name;persist(false);renderLibrary();},'Tên thư mục');break;
 case 'delete-folder':confirmAction('Xóa thư mục?','Sổ bên trong được giữ lại trong Tài liệu. Chỉ thư mục bị xóa.',()=>{library.notebooks.filter(n=>n.folder===folderId).forEach(n=>n.folder=null);library.folders=library.folders.filter(f=>f.id!==folderId);folderId=null;filter='all';persist(false);renderLibrary();});break;
 case 'grid-view':listView=false;renderLibrary();break;
 case 'list-view':listView=true;renderLibrary();break;
 case 'book-menu':bookMenu(id);break;
 case 'open-book':closeModal();openNotebook(id);break;
 case 'rename-book':askText('Đổi tên sổ',n.title,title=>{n.title=title;persist(false);renderLibrary();});break;
 case 'move-book':showModal('Chuyển sổ đến…',`<div class="menu-options"><button data-move="">${icon('book')}Tài liệu (không có thư mục)</button>${library.folders.map(f=>`<button data-move="${f.id}">${icon('folder')}${esc(f.name)}</button>`).join('')}</div>`);modal.querySelectorAll('[data-move]').forEach(x=>x.onclick=()=>{n.folder=x.dataset.move||null;persist(false);closeModal();renderLibrary();toast('Đã chuyển sổ.');});break;
 case 'duplicate-book':{const copy=clone(n);copy.id=uid();copy.title+=' (bản sao)';copy.created=copy.updated=Date.now();copy.pages.forEach(p=>{p.id=uid();p.elements.forEach(e=>e.id=uid());});library.notebooks.unshift(copy);persist(false);closeModal();renderLibrary();break;}
 case 'trash-book':n.trashed=true;persist(false);closeModal();renderLibrary();toast('Đã chuyển sổ vào thùng rác.');break;
 case 'restore-book':n.trashed=false;persist(false);closeModal();renderLibrary();toast('Đã khôi phục sổ.');break;
 case 'delete-book':confirmAction('Xóa vĩnh viễn?',`Sổ “${n.title}” sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.`,()=>{library.notebooks=library.notebooks.filter(x=>x.id!==id);persist(false);renderLibrary();});break;
 case 'backup-book':backup(n);break;
 case 'backup-current':backup(current);break;
 case 'backup-all':backup();break;
 case 'restore-file':closeModal();chooseFile('.papernote,.json',importFile);break;
 case 'import':chooseFile('.pdf,.papernote,.json',importFile);break;
 case 'library':finishText();persist().catch(()=>{});renderLibrary();break;
 case 'rename-current':finishText();askText('Đổi tên sổ',current.title,title=>{current.title=title;persist();$('.doc-name').textContent=title;});break;
 case 'toggle-rail':finishText();railVisible=!railVisible;$('.page-rail').classList.toggle('hidden',!railVisible);b.setAttribute('aria-pressed',railVisible);break;
 case 'favorite-current':current.favorite=!current.favorite;persist();b.style.color=current.favorite?'#ffdb79':'';b.setAttribute('aria-pressed',current.favorite);break;
 case 'add-page':addPage();break;
 case 'page-menu':finishText();pageMenu(Number(b.dataset.index));break;
 case 'editor-more':finishText();showModal('Tùy chọn sổ',`<div class="menu-options"><button data-action="rename-current">${icon('pen')}Đổi tên sổ</button><button data-action="new-whiteboard">${icon('plus')}Bảng trắng mới</button><button data-action="pen-settings">${icon('pen')}Cài đặt bút</button><button data-action="tablet-test">${icon('pen')}Thử bảng vẽ</button><button data-action="bookmark-page">${icon('bookmark')}Đánh dấu trang</button><button data-action="settings">${icon('settings')}Cài đặt & sao lưu</button><button data-action="current-template">${icon('grid')}Đổi mẫu giấy trang này</button><button data-action="current-page-menu">${icon('duplicate')}Quản lý trang này</button><button data-action="export-png">${icon('image')}Xuất trang thành ảnh PNG</button><button data-action="backup-current">${icon('export')}Xuất sổ có thể chỉnh sửa (.papernote)</button><button data-action="help">${icon('help')}Phím tắt & hướng dẫn</button></div>`);break;
 case 'current-template':templateModal(pageIndex);break;
 case 'current-page-menu':pageMenu();break;
 case 'undo':undo();break;
 case 'redo':undo(true);break;
 case 'zoom-in':zoom=Math.min(2.5,zoom+.1);resizePaper();break;
 case 'zoom-out':zoom=Math.max(.2,zoom-.1);resizePaper();break;
 case 'fit':fitPage();break;
 case 'export-pdf':exportPDF();break;
 }
});
document.addEventListener('keydown',e=>{
 const editing=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable;
 if(current&&!modal.open&&(e.ctrlKey||e.metaKey)&&!e.altKey&&(!editing||e.target.tagName==='SELECT')){const action=['+','='].includes(e.key)||e.code==='NumpadAdd'?'zoom-in':e.key==='-'||e.code==='NumpadSubtract'?'zoom-out':null;if(action){e.preventDefault();if(!drawing)$(`[data-action="${action}"]`).click();return;}}
 if(e.key==='Escape'&&!modal.open){finishText();selection=[];selectionBox=null;paint();return;}
 if(editing||modal.open)return;
 if(e.ctrlKey||e.metaKey){
  if(current&&!editing&&['c','x','v','a'].includes(e.key.toLowerCase())){e.preventDefault();const k=e.key.toLowerCase();if(k==='c')copySelection();if(k==='x'&&!readOnly)copySelection(true);if(k==='v'&&!readOnly)pasteSelection();if(k==='a')extensionAction('select-all');return;}
  if(e.key.toLowerCase()==='n'){e.preventDefault();finishText();newNotebook();}
  if(e.key.toLowerCase()==='s'){e.preventDefault();finishText();persist().then(()=>toast('Đã lưu trên máy.')).catch(()=>{});}
  if(current&&!readOnly&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}
  if(current&&!readOnly&&e.key.toLowerCase()==='y'){e.preventDefault();undo(true);}
  if(current&&!readOnly&&e.key==='Enter'){e.preventDefault();addPage();}return;
 }
 if(!current)return;
 if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();finishText();pageIndex=Math.max(0,Math.min(current.pages.length-1,pageIndex+(e.key==='ArrowLeft'?-1:1)));renderEditor();return;}
 const keys={p:'pen',h:'highlighter',e:'eraser',l:'select',s:'shape',t:'text',v:'hand'};if(keys[e.key.toLowerCase()]){e.preventDefault();setTool(keys[e.key.toLowerCase()]);}
 if(['Delete','Backspace'].includes(e.key)&&selection.length&&!readOnly){e.preventDefault();deleteSelection();}
 if(selection.length&&!readOnly&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();checkpoint();const d=e.shiftKey?10:1;for(const el of activePage().elements)if(selection.includes(el.id)&&editable(el))moveElement(el,e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0);changed();}
});
modal.addEventListener('click',e=>{if(e.target===modal&&e.clientX<modal.getBoundingClientRect().left)closeModal();});
window.addEventListener('beforeunload',()=>finishText());
function mountExtendedUI(){
 const tabs=document.createElement('nav');tabs.className='doc-tabs';tabs.setAttribute('aria-label','Các sổ đang mở');tabs.innerHTML=button('library','Về thư viện','home','tab-home')+openTabs.filter(id=>library.notebooks.some(n=>n.id===id&&!n.trashed)).map(id=>{const n=library.notebooks.find(n=>n.id===id);return `<span class="doc-tab ${id===current.id?'active':''}"><button data-tab="${id}" class="${id===current.id?'doc-name':''}" ${id===current.id?'aria-current="page"':''}>${esc(n.title)}</button>${id===current.id?button('editor-more','Tùy chọn sổ','down','tab-menu'):''}<button data-close-tab="${id}" aria-label="Đóng tab ${esc(n.title)}">${icon('close')}</button></span>`;}).join('')+button('new-whiteboard','Bảng trắng mới','plus','tab-add');$('.editor-top').before(tabs);
 const context=document.createElement('div');context.id='tool-context';context.className='tool-context';$('.editor-body').append(context);
 $('#shape').insertAdjacentHTML('beforeend','<option value="triangle">Tam giác</option><option value="arrow">Mũi tên</option>');$('#shape').value=shape;
 const rail=$('.rail-title');rail.insertAdjacentHTML('afterend',`<select id="rail-filter" aria-label="Lọc trang"><option value="all">Tất cả trang</option><option value="bookmarks">Trang đánh dấu</option></select>`);$('#rail-filter').onchange=()=>renderThumbs();
 const status=$('#page-status');status.insertAdjacentHTML('beforebegin',`<div class="page-navigation">${button('previous-page','Trang trước','back')}${button('next-page','Trang sau','chevron')}</div>`);
 const width=$('#width');width.innerHTML=[.5,1,1.5,2,3,4,6,8,12].map(v=>`<option value="${v}">${v} px</option>`).join('');if(![.5,1,1.5,2,3,4,6,8,12].includes(penSize))width.insertAdjacentHTML('beforeend',`<option value="${penSize}">${penSize} px</option>`);width.value=penSize;width.onchange=e=>{penSize=Number(e.target.value);prefs.size=penSize;savePrefs();updateCursor();syncPalette();};
 const desk=$('#desk');desk.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&stylusDetected()){e.preventDefault();suppressedTouches.add(e.pointerId);e.stopPropagation();}},true);desk.addEventListener('pointermove',e=>{if(suppressedTouches.has(e.pointerId)){e.preventDefault();e.stopPropagation();}},true);desk.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom=Math.max(.2,Math.min(2.5,zoom+(e.deltaY<0?.05:-.05)));resizePaper();return;}if(!e.deltaY)return;const direction=Math.sign(e.deltaY),atEdge=direction>0?desk.scrollTop+desk.clientHeight>=desk.scrollHeight-2:desk.scrollTop<=1;if(!atEdge||direction<0&&pageIndex===0){wheelPageDelta=0;return;}e.preventDefault();wheelPageDelta+=e.deltaY;clearTimeout(wheelPageReset);wheelPageReset=setTimeout(()=>wheelPageDelta=0,240);if(Math.abs(wheelPageDelta)>=90){wheelPageDelta=0;navigatePage(direction);}},{passive:false});
 updateContext();renderLinks();
}
function optSelect(id,label,options,value){return `<label class="context-field">${label}<select id="${id}">${options.map(([v,l])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${l}</option>`).join('')}</select></label>`;}
function updateContext(){
 const target=$('#tool-context');if(!target||!current)return;
 const selected=selection.length>0;target.dataset.mode=tool;target.classList.toggle('has-selection',selected);target.classList.toggle('ruler-visible',ruler);
 const small=(action,label,glyph)=>`<button class="context-button" data-action="${action}" title="${label}">${glyph?icon(glyph):''}${label}</button>`;
 let body='';
 if(selected){body=`<span class="context-title">${selection.length} đối tượng</span>${small('copy-selection','Sao chép','duplicate')}${small('cut-selection','Cắt','cut')}${small('paste-selection','Dán','paste')}${small('selection-style','Kiểu & kích thước','settings')}${small('rotate-selection','Xoay 90°','rotate')}${small('save-element','Lưu bộ sưu tập','sticker')}${small('delete-selection','Xóa','trash')}`;}
 else if(['pen','pencil'].includes(tool)){body=optSelect('pen-kind','Loại bút',Object.entries(penNames),tool==='pencil'?'pencil':prefs.pen)+small('pen-settings','Cài đặt nét','settings')+optSelect('stroke-pattern','Kiểu nét',[['solid','Liền'],['dashed','Nét đứt'],['dotted','Chấm']],prefs.pattern);}
 else if(tool==='highlighter')body=small('pen-settings','Cài đặt đánh dấu','settings')+`<label class="context-check"><input type="checkbox" id="straight-highlight" ${prefs.highlighterStraight?'checked':''}>Nét thẳng</label>`;
 else if(tool==='eraser')body=optSelect('eraser-mode','Tẩy',[['stroke','Toàn nét'],['precision','Chính xác']],prefs.eraserMode)+optSelect('erase-filter','Nội dung',[['all','Tất cả nét'],['pen','Chỉ bút mực'],['pencil','Chỉ bút chì'],['highlight','Chỉ đánh dấu'],['tape','Chỉ băng che']],prefs.eraseFilter)+small('pen-settings','Cỡ tẩy & tùy chọn','settings')+small('clear-page','Xóa nội dung trang','trash');
 else if(tool==='select')body=optSelect('lasso-mode','Chọn vùng',[['free','Lasso tự do'],['rect','Hình chữ nhật']],prefs.lasso)+small('select-all','Chọn tất cả','select')+small('paste-selection','Dán','paste');
 else if(tool==='text')body=optSelect('text-font','Phông chữ',[['Segoe UI','Segoe UI'],['Arial','Arial'],['Georgia','Georgia'],['Consolas','Consolas']],prefs.font)+optSelect('text-size','Cỡ chữ',[14,18,22,28,36,48].map(v=>[v,v]),prefs.textSize)+`<button class="context-button ${prefs.bold?'active':''}" data-action="toggle-bold" aria-pressed="${prefs.bold}"><b>B</b></button><button class="context-button ${prefs.italic?'active':''}" data-action="toggle-italic" aria-pressed="${prefs.italic}"><i>I</i></button>`+small('sticky-note','Giấy ghi chú','sticker');
 else if(tool==='shape')body=`<label class="context-check"><input type="checkbox" id="shape-fill" ${prefs.shapeFill?'checked':''}>Tô màu bên trong</label><span class="context-hint">Giữ Shift để vẽ vuông hoặc tròn.</span>`;
 else if(tool==='tape')body='<span class="context-hint">Vẽ băng che. Chuyển sang bàn tay hoặc chỉ đọc rồi chạm để ẩn/hiện.</span>';
 else if(tool==='laser')body='<span class="context-hint">Vệt laser tự biến mất, không ghi vào trang.</span>';
 else body=small('page-search','Tìm trong sổ','search')+small('paste-selection','Dán','paste');
 target.innerHTML=`<div class="context-tools">${body}</div><div class="context-global">${small('toggle-ruler','Thước','ruler')}${ruler?`<input id="ruler-angle" type="number" min="-180" max="180" value="${rulerAngle}" aria-label="Góc thước (độ)">`:''}${small('layers','Lớp','layers')}${small('tablet-test','Thử bảng vẽ','pen')}${small('page-search','Tìm','search')}</div>`;
 const bind=(id,fn)=>{const el=$('#'+id);if(el)el.onchange=fn;};
 bind('pen-kind',e=>{if(e.target.value==='pencil'){if(tool!=='pencil')setTool('pencil');}else{prefs.pen=e.target.value;if(tool!=='pen')setTool('pen');}savePrefs();updateContext();});
 bind('stroke-pattern',e=>{prefs.pattern=e.target.value;savePrefs();});
 bind('eraser-mode',e=>{prefs.eraserMode=e.target.value;savePrefs();});bind('erase-filter',e=>{prefs.eraseFilter=e.target.value;savePrefs();});
 bind('lasso-mode',e=>{prefs.lasso=e.target.value;savePrefs();});bind('straight-highlight',e=>{prefs.highlighterStraight=e.target.checked;savePrefs();});bind('shape-fill',e=>{prefs.shapeFill=e.target.checked;savePrefs();});
 bind('text-font',e=>{prefs.font=e.target.value;savePrefs();});bind('text-size',e=>{prefs.textSize=Number(e.target.value);savePrefs();});
 bind('ruler-angle',e=>{rulerAngle=Math.max(-180,Math.min(180,Number(e.target.value)||0));paint();});
}
function penSettings(){
 finishText();const erase=tool==='eraser',highlight=tool==='highlighter';
 const range=(key,label,value,min,max,step)=>`<label class="range-field"><span>${label}<output id="${key}-output">${value}</output></span><input type="range" id="setting-${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
 showModal(erase?'Tùy chỉnh tẩy':highlight?'Tùy chỉnh đánh dấu':'Bút & cảm giác viết',`${!erase&&!highlight?`<div class="pen-kinds">${Object.entries(penNames).map(([v,l])=>`<button data-pen-kind="${v}" class="${(tool==='pencil'?'pencil':prefs.pen)===v?'active':''}" aria-pressed="${(tool==='pencil'?'pencil':prefs.pen)===v}">${icon(v)}${l}</button>`).join('')}</div>`:''}<canvas id="pen-preview" width="440" height="105" aria-label="Xem trước nét"></canvas>${!erase&&!highlight?optSelect('setting-pattern','Kiểu nét',[['solid','Liền'],['dashed','Nét đứt'],['dotted','Chấm']],prefs.pattern):''}${range(erase?'eraserSize':'size',erase?'Bán kính tẩy (px)':'Độ dày cơ bản (px)',erase?prefs.eraserSize:penSize,erase?2:.5,erase?45:20,erase?1:.5)}${!erase&&!highlight?range('sensitivity','Độ nhạy lực nhấn',prefs.sensitivity,0,1,.05)+range('pressureCurve','Đường lực nhấn (nhỏ = mềm, lớn = cứng)',prefs.pressureCurve,0.25,4,.05)+range('sharpness','Độ nhọn đầu nét',prefs.sharpness,0,1,.05)+range('flatness','Độ dẹt ngòi bút máy',prefs.flatness,0,1,.05)+range('stabilization','Ổn định nét',prefs.stabilization,0,1,.05):''}${erase?`<label class="option-check"><input id="setting-autoDeselect" type="checkbox" ${prefs.autoDeselect?'checked':''}>Tự trở lại bút sau khi tẩy</label>`:`<label class="option-check"><input id="setting-drawHold" type="checkbox" ${prefs.drawHold?'checked':''}>Vẽ và giữ để tạo hình</label><label class="option-check"><input id="setting-penOnly" type="checkbox" ${prefs.penOnly?'checked':''}>Chỉ viết bằng bút; ngón tay kéo trang</label>`}<p class="modal-description" style="margin:15px 0 0">Bút bi có độ dày đều. Bút máy và bút cọ nhận lực nhấn từ thiết bị. Chuột không có cảm biến lực nhấn.</p>`,`<button class="primary" data-action="close-modal">Xong</button>`);
 const preview=()=>{const c=$('#pen-preview').getContext('2d');c.clearRect(0,0,440,105);c.fillStyle='#f8fafc';c.fillRect(0,0,440,105);const points=[];for(let i=0;i<=180;i++)points.push([15+i*2.25,55+Math.sin(i/16)*22,.08+.87*(Math.sin(i/30)+1)/2]);drawStroke(c,{points,color:erase?'#9aaabd':ink,size:erase?prefs.eraserSize:highlight?penSize*5:penSize*2,pen:tool==='pencil'?'pencil':prefs.pen,highlight,pattern:prefs.pattern,sensitivity:prefs.sensitivity,pressureCurve:prefs.pressureCurve,flatness:prefs.flatness,sharpness:prefs.sharpness,stabilization:prefs.stabilization});};
 modal.querySelectorAll('[data-pen-kind]').forEach(b=>b.onclick=()=>{const kind=b.dataset.penKind;if(kind!=='pencil')prefs.pen=kind;tool=kind==='pencil'?'pencil':'pen';lastWritingTool=tool;savePrefs();modal.querySelectorAll('[data-pen-kind]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});document.querySelectorAll('[data-tool]').forEach(x=>{x.classList.toggle('active',x.dataset.tool===tool);x.setAttribute('aria-pressed',x.dataset.tool===tool);});$('#tool-caption').innerHTML=icon(tool)+tools[tool];updateContext();updateCursor();syncPalette();preview();});
 modal.querySelectorAll('[id^=setting-]').forEach(input=>input.oninput=()=>{const key=input.id.slice(8);prefs[key]=key==='pattern'?input.value:input.type==='checkbox'?input.checked:Number(input.value);if(key==='size'){penSize=prefs.size;const select=$('#width');if(![...select.options].some(o=>Number(o.value)===penSize))select.add(new Option(penSize+' px',penSize));select.value=penSize;}const output=$('#'+key+'-output');if(output)output.textContent=input.value;savePrefs();updateCursor();syncPalette();preview();});preview();
}
function tabletTest(){
 finishText();showModal('Thử bảng vẽ & lực nhấn',`<p class="modal-description">Viết nhẹ rồi nhấn mạnh trong khung bên dưới. Đây là dữ liệu ứng dụng thực sự nhận từ thiết bị.</p><canvas id="tablet-pad" width="440" height="230" tabindex="0" aria-label="Khung thử bảng vẽ"></canvas><div id="tablet-stats" class="tablet-stats" aria-live="polite">Chưa nhận thao tác bút.</div><meter id="pressure-meter" min="0" max="1" value="0" aria-label="Lực nhấn hiện tại"></meter><label class="range-field"><span>Đường lực nhấn <output id="tablet-curve-value">${prefs.pressureCurve}</output></span><input type="range" id="tablet-curve" min="0.25" max="4" step="0.05" value="${prefs.pressureCurve}"></label><p class="modal-description" style="margin:12px 0 0">Nếu bảng vẽ chỉ báo “Chuột”, hãy kiểm tra Windows Ink trong trình điều khiển. Bản này nhận bút qua Windows Ink/Pointer Events; không dùng Wintab. Cảm biến nghiêng được hiển thị để kiểm tra, chưa dùng để mô phỏng ngòi bút.</p>`,`<button class="secondary" id="clear-tablet">Xóa khung thử</button><button class="primary" data-action="close-modal">Xong</button>`);
 const pad=$('#tablet-pad'),c=pad.getContext('2d');pad.style.cursor=inkCursor();let strokes=[],active=null,min=1,max=0,count=0;
 const paintPad=()=>{c.fillStyle='#fff';c.fillRect(0,0,440,230);for(const e of strokes)drawStroke(c,e);if(active)drawStroke(c,active);};
 const input=e=>{const r=pad.getBoundingClientRect();const pressure=e.pointerType==='pen'?Math.max(.01,e.pressure):.5;min=Math.min(min,pressure);max=Math.max(max,pressure);count++;$('#pressure-meter').value=pressure;$('#tablet-stats').textContent=`${e.pointerType==='pen'?'Bút':e.pointerType==='touch'?'Chạm tay':'Chuột'} · Lực: ${pressure.toFixed(3)} · Khoảng: ${min.toFixed(3)}–${max.toFixed(3)} · Nghiêng X/Y: ${e.tiltX||0}° / ${e.tiltY||0}° · ${count} mẫu`;return[(e.clientX-r.left)*440/r.width,(e.clientY-r.top)*230/r.height,pressure];};
 pad.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pad.setPointerCapture(e.pointerId);active={id:uid(),type:'stroke',points:[input(e)],size:penSize*2,color:ink,pen:tool==='pencil'?'pencil':prefs.pen,sensitivity:prefs.sensitivity,sharpness:prefs.sharpness,flatness:prefs.flatness,stabilization:prefs.stabilization,pressureCurve:prefs.pressureCurve};paintPad();};
 pad.onpointermove=e=>{if(!active)return;e.preventDefault();const samples=e.getCoalescedEvents?.();for(const sample of samples?.length?samples:[e])active.points.push(input(sample));paintPad();};
 pad.onpointerup=()=>{if(active)strokes.push(active);active=null;paintPad();};pad.onpointercancel=()=>{active=null;paintPad();};
 $('#clear-tablet').onclick=()=>{strokes=[];active=null;min=1;max=0;count=0;$('#tablet-stats').textContent='Chưa nhận thao tác bút.';paintPad();};
 $('#tablet-curve').oninput=e=>{prefs.pressureCurve=Number(e.target.value);$('#tablet-curve-value').textContent=prefs.pressureCurve;savePrefs();};paintPad();
}
function deleteSelection(){if(!selection.length||readOnly)return;checkpoint();activePage().elements=activePage().elements.filter(e=>!selection.includes(e.id)||!editable(e));selection=[];changed();}
function copySelection(cut=false){if(!selection.length)return;clipboard=clone(activePage().elements.filter(e=>selection.includes(e.id)&&editable(e)));toast(`Đã ${cut?'cắt':'sao chép'} ${clipboard.length} đối tượng.`);if(cut)deleteSelection();}
function pasteSelection(elements=clipboard){if(!elements.length){toast('Chưa có nội dung để dán.');return;}if(readOnly||!currentLayerEditable()){toast('Chuyển sang chế độ viết và lớp không khóa để dán.');return;}checkpoint();const copies=clone(elements);for(const e of copies){e.id=uid();e.layer=activeLayer;moveElement(e,20,20);}activePage().elements.push(...copies);if(tool!=='select')setTool('select');selection=copies.map(e=>e.id);changed();}
function selectionStyle(){
 const selected=activePage().elements.filter(e=>selection.includes(e.id)&&editable(e));if(!selected.length)return;const image=selected.length===1&&selected[0].type==='image';
 showModal('Chỉnh vùng chọn',`<form id="selection-form"><div class="form-grid"><label class="field">Màu nét/chữ<input id="selection-color" type="color" value="${selected[0].color||ink}"></label><label class="field">Tỉ lệ (%)<input id="selection-scale" type="number" min="10" max="500" value="100" required></label><label class="field">Xoay (độ)<input id="selection-rotate" type="number" min="-360" max="360" value="0" required></label><label class="field">Độ dày / cỡ chữ<input id="selection-size" type="number" min="0.5" max="200" step="0.5" placeholder="Giữ nguyên"></label></div><label class="option-check"><input type="checkbox" id="apply-color">Áp dụng màu đã chọn</label>${image?'<button type="button" class="secondary" id="crop-image">Cắt ảnh</button>':''}<div class="selection-order"><button type="button" id="send-back" class="secondary">Đưa xuống dưới</button><button type="button" id="bring-front" class="secondary">Đưa lên trên</button></div></form>`,`<button class="secondary" data-action="close-modal">Hủy</button><button class="primary" type="submit" form="selection-form">Áp dụng</button>`);
 $('#selection-color').oninput=()=>$('#apply-color').checked=true;
 $('#selection-form').onsubmit=e=>{e.preventDefault();const factor=Number($('#selection-scale').value)/100,angle=Number($('#selection-rotate').value)*Math.PI/180,size=Number($('#selection-size').value),b=selectionBounds();if(!Number.isFinite(factor)||factor<.1||factor>5||!Number.isFinite(angle))return;checkpoint();for(const el of selected){if($('#apply-color').checked&&el.type!=='image')el.color=$('#selection-color').value;if(size>0&&size<=200&&el.type!=='image')el.size=size;if(factor!==1)scaleElement(el,b,factor);if(angle){if(el.type==='text'){const tb=rawBounds(el);el.w=tb.w;el.h=tb.h;}rotateElement(el,{x:b.x+b.w/2,y:b.y+b.h/2},angle);}}closeModal();changed();};
 const order=front=>{checkpoint();const rest=activePage().elements.filter(e=>!selection.includes(e.id));activePage().elements=front?[...rest,...selected]:[...selected,...rest];closeModal();changed();};$('#send-back').onclick=()=>order(false);$('#bring-front').onclick=()=>order(true);if(image)$('#crop-image').onclick=()=>cropImage(selected[0]);
}
function cropImage(e){showModal('Cắt ảnh',`<form id="crop-form"><p class="modal-description">Nhập phần trăm cần cắt ở mỗi cạnh. Ảnh gốc được giữ để bạn có thể đặt lại.</p><div class="form-grid">${['left','right','top','bottom'].map((side,i)=>`<label class="field">${['Trái','Phải','Trên','Dưới'][i]} (%)<input type="number" id="crop-${side}" min="0" max="90" value="0" required></label>`).join('')}</div></form>`,`<button class="secondary" id="crop-reset">Ảnh gốc</button><button class="primary" type="submit" form="crop-form">Cắt ảnh</button>`);$('#crop-reset').onclick=()=>{checkpoint();delete e.crop;closeModal();changed();};$('#crop-form').onsubmit=event=>{event.preventDefault();const [l,r,t,b]=['left','right','top','bottom'].map(s=>Number($('#crop-'+s).value)/100);if([l,r,t,b].some(v=>!Number.isFinite(v)||v<0)||l+r>=.95||t+b>=.95){toast('Phải giữ lại ít nhất 5% chiều rộng và chiều cao.');return;}checkpoint();e.crop={x:l,y:t,w:1-l-r,h:1-t-b};closeModal();changed();};}
function elementsModal(){
 const items=library.elements||[];showModal('Bộ sưu tập',`<p class="modal-description">Lưu vùng chọn để dùng lại trong các trang khác. Các mẫu được lưu cùng thư viện và bản sao lưu.</p><div class="element-list">${items.length?items.map(s=>`<div><button class="secondary" data-insert-element="${s.id}">${icon('sticker')}${esc(s.name)}</button><button class="icon-button" data-delete-element="${s.id}" aria-label="Xóa ${esc(s.name)}">${icon('trash')}</button></div>`).join(''):'<p class="muted">Chọn nội dung bằng lasso rồi bấm “Lưu bộ sưu tập”.</p>'}</div><div class="builtin-elements"><button class="secondary" id="add-sticky">Giấy ghi chú</button><button class="secondary" id="add-checklist">Danh sách việc</button></div>`);
 modal.querySelectorAll('[data-insert-element]').forEach(b=>b.onclick=()=>{const s=items.find(s=>s.id===b.dataset.insertElement);closeModal();pasteSelection(s.elements);});modal.querySelectorAll('[data-delete-element]').forEach(b=>b.onclick=()=>{library.elements=library.elements.filter(s=>s.id!==b.dataset.deleteElement);persist(false);elementsModal();});$('#add-sticky').onclick=()=>stickyNote();$('#add-checklist').onclick=()=>{closeModal();pasteSelection([{id:uid(),type:'text',x:80,y:110,size:23,color:ink,text:'☐ Việc thứ nhất\n☐ Việc thứ hai\n☐ Việc thứ ba'}]);};
}
function stickyNote(){askText('Giấy ghi chú','',text=>{if(!current||readOnly||!currentLayerEditable())return;checkpoint();const e={id:uid(),type:'text',x:100,y:140,size:prefs.textSize,color:'#493f28',background:'#fff1a8',text,font:prefs.font,layer:activeLayer};activePage().elements.push(e);if(tool!=='select')setTool('select');selection=[e.id];changed();},'Nội dung');}
function layersModal(){const p=activePage();p.layers||=[{name:'Nội dung',visible:true,locked:false}];showModal('Các lớp trên trang',`<div class="layer-list">${p.layers.map((l,i)=>`<div class="layer-row"><button class="context-button ${activeLayer===i?'active':''}" data-layer="${i}">${esc(l.name)} <small>(${p.elements.filter(e=>(e.layer||0)===i).length})</small></button><button class="icon-button" data-layer-visible="${i}" aria-pressed="${l.visible!==false}" aria-label="Ẩn hoặc hiện ${esc(l.name)}">${icon('eye')}</button><button class="icon-button" data-layer-lock="${i}" aria-pressed="${!!l.locked}" aria-label="Khóa hoặc mở ${esc(l.name)}">${icon('lock')}</button></div>`).join('')}</div><button id="add-layer" class="secondary" ${p.layers.length>=10?'disabled':''}>${icon('plus')}Thêm lớp</button><p class="modal-description" style="margin:15px 0 0">Nội dung mới được thêm vào lớp đang chọn. Lớp khóa không nhận chỉnh sửa; lớp ẩn không được xuất.</p>`);modal.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{activeLayer=Number(b.dataset.layer);selection=[];layersModal();});modal.querySelectorAll('[data-layer-visible]').forEach(b=>b.onclick=()=>{const l=p.layers[Number(b.dataset.layerVisible)];l.visible=l.visible===false;selection=[];persist();paint();renderThumbs();layersModal();});modal.querySelectorAll('[data-layer-lock]').forEach(b=>b.onclick=()=>{p.layers[Number(b.dataset.layerLock)].locked=!p.layers[Number(b.dataset.layerLock)].locked;selection=[];persist();layersModal();});$('#add-layer').onclick=()=>askText('Thêm lớp','',name=>{p.layers.push({name,visible:true,locked:false});activeLayer=p.layers.length-1;persist();layersModal();},'Tên lớp');}
function searchNotebook(){finishText();showModal('Tìm trong sổ',`<label class="field">Tên nội dung<input id="page-query" placeholder="Tìm chữ đã gõ hoặc chữ trong PDF…"></label><div id="page-results" class="menu-options"></div>`);$('#page-query').oninput=()=>{const q=$('#page-query').value.toLocaleLowerCase('vi');$('#page-results').innerHTML=current.pages.map((p,i)=>({p,i,text:[p.pdfText||'',...p.elements.filter(e=>e.type==='text').map(e=>e.text)].join('\n')})).filter(r=>q&&r.text.toLocaleLowerCase('vi').includes(q)).map(r=>`<button data-result-page="${r.i}">${icon('book')}<span>Trang ${r.i+1}<small style="display:block;max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b7c92">${esc(r.text.slice(Math.max(0,r.text.toLocaleLowerCase('vi').indexOf(q)-25),r.text.toLocaleLowerCase('vi').indexOf(q)+90))}</small></span></button>`).join('');$('#page-results').querySelectorAll('[data-result-page]').forEach(b=>b.onclick=()=>{pageIndex=Number(b.dataset.resultPage);closeModal();renderEditor();});};}
function renderLinks(){if(!current)return;$('#pdf-links')?.remove();const links=activePage().links||[];if(!readOnly||!links.length)return;const layer=document.createElement('div');layer.id='pdf-links';layer.className='pdf-links';for(const l of links){const button=document.createElement('button');button.title=l.url||'Đi đến trang '+(l.page+1);button.setAttribute('aria-label',button.title);Object.assign(button.style,{left:l.rect[0]*zoom+'px',top:l.rect[1]*zoom+'px',width:(l.rect[2]-l.rect[0])*zoom+'px',height:(l.rect[3]-l.rect[1])*zoom+'px'});button.onclick=()=>{if(l.url){if(native)native.postMessage({type:'open-url',url:l.url});else window.open(l.url,'_blank','noopener');}else if(Number.isInteger(l.page)){const index=current.pages.findIndex(p=>p.pdfSource===activePage().pdfSource&&p.pdfPage===l.page);if(index>=0){pageIndex=index;renderEditor();}}};layer.append(button);}$('#paper-wrap').append(layer);}
function extensionAction(action){switch(action){
 case 'pen-settings':penSettings();break;
 case 'tablet-test':tabletTest();break;
 case 'select-all':if(readOnly)return true;selection=activePage().elements.filter(e=>editable(e)).map(e=>e.id);paint();updateContext();break;
 case 'copy-selection':copySelection();break;
 case 'cut-selection':copySelection(true);break;
 case 'paste-selection':pasteSelection();break;
 case 'delete-selection':deleteSelection();break;
 case 'selection-style':selectionStyle();break;
 case 'rotate-selection':{if(readOnly)return true;const b=selectionBounds();if(!b)break;checkpoint();for(const e of activePage().elements.filter(e=>selection.includes(e.id)&&editable(e))){if(e.type==='text'){const tb=rawBounds(e);e.w=tb.w;e.h=tb.h;}rotateElement(e,{x:b.x+b.w/2,y:b.y+b.h/2},Math.PI/2);}changed();break;}
 case 'save-element':{const elements=clone(activePage().elements.filter(e=>selection.includes(e.id)&&editable(e)));if(!elements.length)break;if((library.elements||[]).length>=200){toast('Bộ sưu tập đã đủ 200 mục.');break;}const b=selectionBounds();elements.forEach(e=>moveElement(e,60-b.x,60-b.y));askText('Lưu bộ sưu tập','',name=>{library.elements||=[];library.elements.push({id:uid(),name,elements});persist(false);toast('Đã lưu bộ sưu tập.');},'Tên nội dung');break;}
 case 'toggle-ruler':ruler=!ruler;paint();updateContext();break;
 case 'toggle-bold':prefs.bold=!prefs.bold;savePrefs();updateContext();break;
 case 'toggle-italic':prefs.italic=!prefs.italic;savePrefs();updateContext();break;
 case 'sticky-note':stickyNote();break;
 case 'layers':finishText();layersModal();break;
 case 'read-mode':finishText();readOnly=!readOnly;selection=[];renderEditor();break;
 case 'bookmark-page':closeModal();activePage().bookmark=!activePage().bookmark;persist();renderEditor();break;
 case 'page-search':searchNotebook();break;
 case 'previous-page':finishText();if(pageIndex>0){pageIndex--;renderEditor();}break;
 case 'next-page':finishText();if(pageIndex<current.pages.length-1){pageIndex++;renderEditor();}break;
 case 'clear-page':if(readOnly)return true;confirmAction('Xóa nội dung trang?','Xóa các đối tượng trên lớp không khóa. Nền PDF và lớp khóa được giữ nguyên; bạn có thể hoàn tác.',()=>{checkpoint();activePage().elements=activePage().elements.filter(e=>!editable(e));selection=[];changed();});break;
 case 'export-png':finishText();closeModal();(async()=>{try{const p=activePage(),c=document.createElement('canvas');c.width=p.width*2;c.height=p.height*2;await drawPage(c,p,2);c.toBlob(blob=>download(current.title+'-trang-'+(pageIndex+1)+'.png',blob,'image/png'));}catch(e){toast(e.message);}})();break;
 default:return false;
 }return true;}
async function boot(){
 app.innerHTML='<div class="progress" style="padding-top:25vh"><div class="spinner"></div>Đang mở PaperNote…</div>';
 try{
  const stored=await openDB();let nativeData=null;
  if(native){nativeData=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Bộ lưu trữ Windows chưa phản hồi. Hãy đóng và mở lại ứng dụng.')),10000);const handler=event=>{if(event.data.type==='vault'){clearTimeout(timeout);native.removeEventListener('message',handler);resolve(event.data.data);}};native.addEventListener('message',handler);native.postMessage({type:'ready'});});}
  if(stored)library=validate(stored);else if(nativeData){library=validate(JSON.parse(nativeData));}else library=seed();
  if(library.release!==2){const tx=db.transaction('vault','readwrite');tx.objectStore('vault').put(clone(library),'before-2');library.release=2;}penSize=prefs.size;
  native?.addEventListener('message',event=>{const m=event.data;if(m.type==='math-result'){insertMath(m);return;}if(m.type==='math-closed'||m.type==='math-error'){mathPending.delete(m.request);if(m.type==='math-error')toast(m.message);return;}if(m.type==='drive-status'){driveState=m;driveStatus();return;}if(m.type==='drive-result'||m.type==='drive-error'){const pending=drivePending.get(m.request);drivePending.delete(m.request);if(pending){if(m.type==='drive-result')pending.resolve(m.data);else pending.reject(m.message);}else if(m.type==='drive-error')toast(m.message);return;}if(m.type==='persisted'||m.type==='persist-error'){const pending=nativePending.get(m.request);nativePending.delete(m.request);if(pending){if(m.type==='persisted')pending.resolve();else pending.reject(m.message);}return;}if(m.type==='saved')toast(m.cancelled?'Đã hủy xuất tệp.':'Đã lưu: '+m.name);if(m.type==='error'){saveError=true;saveStatus();toast(m.message);}if(m.type==='flush'){finishText();persist(false).then(()=>native.postMessage({type:'flushed'})).catch(()=>native.postMessage({type:'flush-failed'}));}});
  await persist(false);renderLibrary();window.__papernoteReady=true;if(native){driveRequest('drive-status').catch(()=>{});window.addEventListener('online',()=>driveRequest('drive-sync').catch(()=>{}));}
 }catch(e){app.innerHTML=`<div class="empty"><h2>Chưa mở được thư viện</h2><p>${esc(e.message)}</p><p style="margin-top:15px">Hãy đóng và mở lại PaperNote. Dữ liệu hiện có được giữ nguyên.</p></div>`;}
}
boot();
