export const penNames={fountain:'Bút máy',ball:'Bút bi',brush:'Bút cọ',pencil:'Bút chì'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function smoothPoints(points,amount=0){
 if(points.length<3)return points;
 const sigma=.6+clamp(amount,0,1)*3,radius=Math.ceil(sigma*2),weights=Array.from({length:radius*2+1},(_,i)=>Math.exp(-((i-radius)**2)/(2*sigma*sigma)));
 const total=weights.reduce((a,b)=>a+b,0);
 // Symmetric filtering has no trailing lag; reflected ends retain their position and tangent.
 const at=i=>{if(i<0){const p=points[Math.min(-i,points.length-1)],a=points[0];return[2*a[0]-p[0],2*a[1]-p[1],a[2]??.5];}if(i>=points.length){const a=points.at(-1),p=points[Math.max(0,2*points.length-i-2)];return[2*a[0]-p[0],2*a[1]-p[1],a[2]??.5];}return points[i];};
 return points.map((p,i)=>{if(i===0||i===points.length-1)return p;const sum=[0,0,0];for(let j=-radius;j<=radius;j++){const q=at(i+j),w=weights[j+radius];sum[0]+=q[0]*w;sum[1]+=q[1]*w;sum[2]+=(q[2]??.5)*w;}return[amount?sum[0]/total:p[0],amount?sum[1]/total:p[1],clamp(sum[2]/total,0,1)];});
}
function resamplePoints(points){
 if(points.length<2)return points;
 let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
 const step=Math.max(1.25,length/16000),out=[points[0].slice()];let remaining=step,anchor=points[0];
 for(let i=1;i<points.length;i++){
  const end=points[i];let distance=Math.hypot(end[0]-anchor[0],end[1]-anchor[1]);
  if(distance<1e-8){anchor=end;if(Math.hypot(end[0]-out.at(-1)[0],end[1]-out.at(-1)[1])<1e-8)out[out.length-1]=end.slice();continue;}
  while(distance>=remaining){const t=remaining/distance,next=[anchor[0]+(end[0]-anchor[0])*t,anchor[1]+(end[1]-anchor[1])*t,(anchor[2]??.5)+((end[2]??.5)-(anchor[2]??.5))*t];out.push(next);anchor=next;distance=Math.hypot(end[0]-anchor[0],end[1]-anchor[1]);remaining=step;}
  remaining-=distance;anchor=end;
 }
 const end=points.at(-1);if(Math.hypot(end[0]-out.at(-1)[0],end[1]-out.at(-1)[1])>1e-8)out.push(end.slice());else out[out.length-1]=end.slice();return out;
}
export function strokeSamples(e){return smoothPoints(resamplePoints(e.points),e.stabilization||0);}
export function strokeWidth(e,pressure=.5,angle=0,index=0,total=1){
 const size=e.size||3,p=Math.pow(clamp(pressure,0,1),e.pressureCurve||1),s=e.sensitivity??.5,kind=e.pen||'legacy';
 if(e.highlight||e.tape||kind==='ball')return size;
 let factor=kind==='brush'?.12+Math.pow(p,1.5)*2.1:kind==='fountain'?.38+p*(.5+s):kind==='pencil'?.4+p*.8:.35+p*1.3;
 if(kind==='fountain')factor*=1-(e.flatness||0)*.5*Math.abs(Math.sin(angle-Math.PI/4));
 if(e.sharpness&&total>2){const end=Math.min(index,total-1-index);factor*=1-e.sharpness*.75*Math.max(0,1-end/5);}
 return size*Math.max(.08,factor);
}
export function drawStroke(c,e){
 const points=strokeSamples(e);if(!points.length)return;
 c.save();c.strokeStyle=e.color;c.fillStyle=e.color;c.lineCap=e.tape?'butt':'round';c.lineJoin='round';c.globalAlpha=e.tape?(e.revealed?.12:1):e.highlight?(e.opacity??.3):e.pen==='pencil'?(e.opacity??.68):(e.opacity??1);
 if(e.highlight||e.tape||e.pen==='ball'||e.pattern&&e.pattern!=='solid'){
  c.lineWidth=e.size||3;if(e.pattern==='dashed')c.setLineDash([e.size*4,e.size*2.5]);if(e.pattern==='dotted')c.setLineDash([.1,e.size*2.5]);
  c.beginPath();c.moveTo(points[0][0],points[0][1]);traceCurve(c,points);if(points.length===1)c.lineTo(points[0][0]+.01,points[0][1]);c.stroke();
 }else{
  // Fill one outline so translucent graphite does not darken at every sample joint.
  const left=[],right=[],angles=[],radii=[];
  for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],angle=Math.atan2(b[1]-a[1],b[0]-a[0]),r=strokeWidth(e,p[2],angle,i,points.length)/2;const dx=Math.sin(angle)*r,dy=-Math.cos(angle)*r;left.push([p[0]+dx,p[1]+dy]);right.push([p[0]-dx,p[1]-dy]);angles.push(angle);radii.push(r);}
  if(points.length===1){c.beginPath();c.arc(points[0][0],points[0][1],strokeWidth(e,points[0][2])/2,0,Math.PI*2);c.fill();}
  else{const last=points.length-1;c.beginPath();c.moveTo(...left[0]);traceCurve(c,left);c.arc(points[last][0],points[last][1],radii[last],angles[last]-Math.PI/2,angles[last]+Math.PI/2);traceCurve(c,right.reverse());c.arc(points[0][0],points[0][1],radii[0],angles[0]+Math.PI/2,angles[0]+Math.PI*1.5);c.closePath();c.fill();}
 }
 c.restore();
}
function traceCurve(c,points){for(let i=1;i<points.length-1;i++){const p=points[i],next=points[i+1];c.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);}if(points.length>1)c.lineTo(points.at(-1)[0],points.at(-1)[1]);}
export function distanceToSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?clamp(((p.x-a[0])*dx+(p.y-a[1])*dy)/len,0,1):0;return Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy);}
export function strokeHit(e,p,radius){return e.points.some((a,i)=>distanceToSegment(p,a,e.points[Math.min(i+1,e.points.length-1)])<=radius+(e.size||3)/2);}
export function splitStroke(e,from,to,radius){
 // Resample long sparse segments before erasing, preventing a gap from reconnecting on reload.
 const points=strokeSamples({...e,stabilization:0}),groups=[];let group=[],cut=false;
 for(const p of points){if(distanceToSegment({x:p[0],y:p[1]},[from.x,from.y],[to.x,to.y])<=radius+(e.size||3)/2){if(group.length)groups.push(group);group=[];cut=true;}else group.push(p);}
 if(group.length)groups.push(group);if(!cut)return[e];
 return groups.filter(g=>g.length>1).map(points=>({...e,id:crypto.randomUUID(),points,stabilization:0}));
}
export function insidePolygon(p,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export function scaleElement(e,origin,factor){
 if(e.type==='stroke'){e.points=e.points.map(p=>[origin.x+(p[0]-origin.x)*factor,origin.y+(p[1]-origin.y)*factor,p[2]]);e.size*=factor;}
 else{e.x=origin.x+(e.x-origin.x)*factor;e.y=origin.y+(e.y-origin.y)*factor;if(e.w!==undefined){e.w*=factor;e.h*=factor;}if(e.size)e.size*=factor;}
}
export function rotateElement(e,center,angle){const rotate=(x,y)=>{const dx=x-center.x,dy=y-center.y;return[center.x+dx*Math.cos(angle)-dy*Math.sin(angle),center.y+dx*Math.sin(angle)+dy*Math.cos(angle)];};
 if(e.type==='stroke')e.points=e.points.map(p=>rotate(p[0],p[1]).concat(p[2]));
 else {const cx=e.x+(e.w||0)/2,cy=e.y+(e.h||0)/2,[x,y]=rotate(cx,cy);e.x=x-(e.w||0)/2;e.y=y-(e.h||0)/2;e.rotation=(e.rotation||0)+angle;}
}
// shortcut: hold recognition covers lines, rectangles and ellipses; add polygon fitting for more shapes.
export function recognizeShape(e){
 if(e.points.length<4)return e;const pts=e.points,first=pts[0],last=pts.at(-1);const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 const style={id:e.id,size:e.size,color:e.color,layer:e.layer,pattern:e.pattern};
 if(Math.hypot(last[0]-first[0],last[1]-first[1])>Math.max(w,h)*.25){const max=Math.max(...pts.map(p=>distanceToSegment({x:p[0],y:p[1]},first,last)));if(max<Math.max(7,Math.hypot(w,h)*.08))return{...style,type:'line',x:first[0],y:first[1],w:last[0]-first[0],h:last[1]-first[1]};return e;}
 if(w<15||h<15)return e;
 const edgeError=pts.reduce((s,p)=>s+Math.min(Math.abs(p[0]-x),Math.abs(p[0]-x-w),Math.abs(p[1]-y),Math.abs(p[1]-y-h)),0)/pts.length;
 const ellipseError=pts.reduce((s,p)=>s+Math.abs(Math.hypot((p[0]-x-w/2)/(w/2),(p[1]-y-h/2)/(h/2))-1),0)/pts.length;
 if(edgeError<Math.min(w,h)*.08||ellipseError<.15)return{...style,type:edgeError<Math.min(w,h)*.08?'rect':'ellipse',x,y,w,h};return e;
}
