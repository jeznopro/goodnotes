import assert from 'node:assert/strict';
import {validateLibrary} from '../web/schema.mjs';
const data={version:1,folders:[],notebooks:[{id:'book-1',title:'Tiếng Việt',color:'#123456',pages:[{id:'page-1',width:794,height:1123,template:'lined',elements:[{id:'stroke-1',type:'stroke',size:3,color:'#203047',points:[[0,0,.5],[20,30,1]]}]}]}]};
assert.equal(validateLibrary(data),data);
const bad=change=>{const copy=structuredClone(data);change(copy);assert.throws(()=>validateLibrary(copy));};
bad(d=>d.notebooks[0].id='bad" onclick="');bad(d=>d.notebooks[0].pages[0].elements[0].points[0][0]=NaN);bad(d=>d.notebooks[0].pages[0].elements[0].points=[]);bad(d=>d.notebooks[0].pages[0].elements[0].pen='unsupported');bad(d=>d.notebooks[0].pages[0].pdfSource='missing');
bad(d=>d.notebooks[0].pages[0].links=[{rect:[0,0,10,10],url:'javascript:alert(1)'}]);
bad(d=>d.notebooks[0].pages[0].elements.push({id:'img',type:'image',x:10,y:10,w:20,h:20,src:'https://untrusted/image.png'}));
const v2=structuredClone(data);v2.release=2;v2.notebooks[0].pages[0].elements[0].pen='brush';v2.notebooks[0].pages[0].layers=[{name:'Lớp 1',visible:true,locked:false}];v2.notebooks[0].pages[0].template='cornell';assert.equal(validateLibrary(v2),v2);
v2.notebooks[0].pages[0].whiteboard=true;assert.equal(validateLibrary(v2),v2);bad(d=>d.notebooks[0].pages[0].whiteboard='yes');
console.log('Backup trust-boundary checks passed, including v1 compatibility and v2 ink.');
const geo=structuredClone(data);geo.notebooks[0].pages[0].elements=[{id:'math-1',type:'image',x:20,y:30,w:400,h:300,src:'data:image/png;base64,iVBORw0KGgo=',geo:{app:'graphing',ggb:'UEsDBAo='}}];assert.equal(validateLibrary(geo),geo);
for(const change of [e=>e.geo.app='unsupported',e=>e.geo.ggb='javascript:alert(1)',e=>e.geo.ggb='UEs'+'A'.repeat(14000000),e=>e.type='rect']){const copy=structuredClone(geo);change(copy.notebooks[0].pages[0].elements[0]);assert.throws(()=>validateLibrary(copy));}
console.log('GeoGebra backup metadata is retained and validated.');
