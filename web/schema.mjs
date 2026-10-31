const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e7;
const id=v=>typeof v==='string'&&/^[\w-]{1,180}$/.test(v);
const color=v=>typeof v==='string'&&/^#[a-f\d]{6}$/i.test(v);
const image=v=>typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(v);
export function validateLibrary(data){
 const fail=()=>{throw Error('Bản sao lưu không hợp lệ hoặc có nội dung không được hỗ trợ.');};
 if(!data||data.version!==1||!Array.isArray(data.notebooks)||!Array.isArray(data.folders)||data.notebooks.length>1000||data.folders.length>2000)fail();
 const ids=new Set();
 const element=e=>{
  if(!e||!id(e.id)||!['stroke','text','image','rect','ellipse','line','triangle','arrow'].includes(e.type))fail();
  if(e.color!==undefined&&!color(e.color))fail();if(e.background!==undefined&&!color(e.background))fail();
  for(const key of ['x','y','w','h','size','rotation','layer','opacity','sensitivity','stabilization','sharpness','flatness','pressureCurve'])if(e[key]!==undefined&&!finite(e[key]))fail();
  if(e.pressureCurve!==undefined&&(e.pressureCurve<.25||e.pressureCurve>4))fail();
  if(e.size!==undefined&&(e.size<=0||e.size>2000))fail();
  if(e.type==='stroke'){if(!color(e.color)||!Array.isArray(e.points)||!e.points.length||e.points.length>200000)fail();for(const p of e.points)if(!Array.isArray(p)||p.length<2||!finite(p[0])||!finite(p[1])||p[2]!==undefined&&(!finite(p[2])||p[2]<0||p[2]>1))fail();if(e.pen&&!['legacy','ball','brush','fountain','pencil'].includes(e.pen))fail();if(e.pattern&&!['solid','dashed','dotted'].includes(e.pattern))fail();}
  else if(!finite(e.x)||!finite(e.y))fail();
  if(e.type==='text'&&(typeof e.text!=='string'||e.text.length>100000||!['Segoe UI','Georgia','Arial','Consolas',undefined].includes(e.font)))fail();
  if(e.type==='image'&&(!image(e.src)||!finite(e.w)||!finite(e.h)||e.w<=0||e.h<=0))fail();
  if(e.geo!==undefined&&(e.type!=='image'||!e.geo||!['graphing','geometry','3d','classic'].includes(e.geo.app)||typeof e.geo.ggb!=='string'||e.geo.ggb.length>14000000||!/^UEs[A-Za-z0-9+/]*={0,2}$/.test(e.geo.ggb)))fail();
  if(['rect','ellipse','line','triangle','arrow'].includes(e.type)&&(!finite(e.w)||!finite(e.h)))fail();
  if(e.crop&&(!['x','y','w','h'].every(k=>finite(e.crop[k]))||e.crop.x<0||e.crop.y<0||e.crop.w<=0||e.crop.h<=0||e.crop.x+e.crop.w>1.001||e.crop.y+e.crop.h>1.001))fail();
 };
 for(const n of data.notebooks){if(!n||!id(n.id)||ids.has(n.id)||typeof n.title!=='string'||n.title.length>300||!color(n.color)||!Array.isArray(n.pages)||!n.pages.length||n.pages.length>2000)fail();ids.add(n.id);
  for(const p of n.pages){if(!p||!id(p.id)||!Array.isArray(p.elements)||p.elements.length>30000||!['lined','grid','dotted','blank','cornell','music','planner'].includes(p.template)||!finite(p.width)||!finite(p.height)||p.width<100||p.height<100||p.width>5000||p.height>5000)fail();if(p.whiteboard!==undefined&&typeof p.whiteboard!=='boolean')fail();if(p.background&&!image(p.background))fail();if(p.paperColor&&!color(p.paperColor))fail();if(p.pdfText!==undefined&&typeof p.pdfText!=='string')fail();if(p.pdfSource&&(!id(p.pdfSource)||!Number.isInteger(p.pdfPage)||p.pdfPage<0||!data.sources?.[p.pdfSource]))fail();for(const e of p.elements)element(e);
   if(p.layers&&(!Array.isArray(p.layers)||p.layers.length>30||p.layers.some(l=>!l||typeof l.name!=='string'||l.name.length>120)))fail();
   if(p.links&&(!Array.isArray(p.links)||p.links.some(l=>!l||!Array.isArray(l.rect)||l.rect.length!==4||!l.rect.every(finite)||l.url&&!/^https?:\/\//i.test(l.url))))fail();
  }
 }
 for(const f of data.folders)if(!f||!id(f.id)||typeof f.name!=='string'||f.name.length>300)fail();
 if(data.sources){if(typeof data.sources!=='object'||Array.isArray(data.sources))fail();for(const [key,value] of Object.entries(data.sources))if(!id(key)||typeof value!=='string'||!/^[A-Za-z0-9+/=]+$/.test(value))fail();}
 if(data.elements){if(!Array.isArray(data.elements)||data.elements.length>200)fail();for(const s of data.elements){if(!s||!id(s.id)||typeof s.name!=='string'||s.name.length>120||!Array.isArray(s.elements))fail();for(const e of s.elements)element(e);}}
 return data;
}
