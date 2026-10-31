const fs=require('fs'),vm=require('vm'),path=require('path');
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'results/goodnotes-svg-expressions.json'),'utf8'));
const jsx=(tag,props)=>({tag,props}),empty=new Proxy({}, {get:(_,key)=>['jsx','jsxs'].includes(key)?jsx:undefined});
const tags=new Set(['svg','path','circle','ellipse','rect','line','polyline','polygon','g','defs','clipPath','linearGradient','stop','mask','use']);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function markup(node){
 if(!node||!tags.has(node.tag))return '';
 let attrs='';for(const [key,value] of Object.entries(node.props||{})){
  if(['children','ref','key'].includes(key)||key.startsWith('on')||!['string','number'].includes(typeof value))continue;
  const attr=key==='className'?'class':key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
  const name=['viewBox','clipPathUnits','gradientUnits','gradientTransform','preserveAspectRatio'].includes(key)?key:attr;
  if((key==='href'||key==='xlinkHref')&&!String(value).startsWith('#'))continue;
  attrs+=' '+name+'="'+escape(value)+'"';
 }
 const children=node.props?.children,body=(Array.isArray(children)?children:[children]).map(markup).join('');
 return '<'+node.tag+attrs+'>'+body+'</'+node.tag+'>';
}
const output=[],seen=new Set();let failed=0;
for(const item of input){
 try{
  const context={};for(const id of item.expression.match(/[A-Za-z_$][\w$]*/g)||[])if(!['Object','Array','String','Math','undefined','Infinity','NaN'].includes(id))context[id]=empty;
  const node=vm.runInNewContext(item.expression,context,{timeout:100});const svg=markup(node);
  if(!svg||!svg.includes('<path')&&!svg.includes('<circle')&&!svg.includes('<rect')||seen.has(svg))continue;
  seen.add(svg);output.push({id:output.length,source:item.source,offset:item.offset,svg});
 }catch{failed++;}
}
fs.writeFileSync(path.join(__dirname,'results/goodnotes-icon-catalog.json'),JSON.stringify(output,null,2));
for(let start=0;start<output.length;start+=120){
 const cells=output.slice(start,start+120).map(item=>'<div><span>'+item.svg+'</span><b>'+item.id+'</b></div>').join('');
 fs.writeFileSync(path.join(__dirname,'results/icon-catalog-'+start+'.html'),'<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#eee;display:grid;grid-template-columns:repeat(15,80px);font:12px Arial}body>div{height:72px;text-align:center}span{display:flex;height:48px;background:#2c4f80;align-items:center;justify-content:center;color:white;margin:3px}svg{width:29px;height:29px;stroke:none;fill:none}b{display:block;margin-top:4px}</style>'+cells);
}
console.log(JSON.stringify({icons:output.length,unsupported:failed,pages:Math.ceil(output.length/120)}));
