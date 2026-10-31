import assert from 'node:assert/strict';
import {strokeSamples} from '../web/ink.mjs';

const duplicate={points:[[0,0,.5],[30,0,.5],[30,0,.5],[31,0,.5],[70,0,.5]],stabilization:0};
const straight=strokeSamples(duplicate);
assert.ok(straight.every((p,i)=>!i||p[0]>=straight[i-1][0]-1e-7),'duplicate or uneven samples must not make straight ink double back');

const noisy=Array.from({length:121},(_,i)=>[i,i===0||i===120?0:(i%2?1.25:-1.25),i%2?.9:.1]);
const smooth=strokeSamples({points:noisy,stabilization:.3});
const interior=smooth.filter(p=>p[0]>12&&p[0]<108);
const rms=Math.sqrt(interior.reduce((s,p)=>s+p[1]*p[1],0)/interior.length);
assert.ok(rms<.3,`a 1.25px alternating wobble should be reduced below .3px RMS, got ${rms}`);
assert.ok(interior.every((p,i)=>!i||Math.abs(p[2]-interior[i-1][2])<.2),'pressure noise must not create sawtooth widths');
assert.deepEqual(smooth[0],noisy[0]);assert.deepEqual(smooth.at(-1),noisy.at(-1));
assert.deepEqual(noisy[1],[1,1.25,.9],'rendering must not rewrite raw input');

const circle=Array.from({length:81},(_,i)=>[100+40*Math.cos(i*Math.PI/40),100+40*Math.sin(i*Math.PI/40),.5]);
const curved=strokeSamples({points:circle,stabilization:.3});
assert.ok(curved.every(p=>Math.abs(Math.hypot(p[0]-100,p[1]-100)-40)<1.5),'smoothing should retain small curved strokes');

const sparse=[[0,0,.2],[50,0,.6],[100,0,1]],dense=Array.from({length:401},(_,i)=>[i*.25,0,.2+i*.002]);
const a=strokeSamples({points:sparse,stabilization:.3}),b=strokeSamples({points:dense,stabilization:.3});
assert.equal(a.length,b.length,'identical geometry must not depend on device sample frequency');
assert.ok(a.every((p,i)=>Math.hypot(p[0]-b[i][0],p[1]-b[i][1])<1e-5));

const repeated=strokeSamples({points:[[5,5,.2],[5,5,.4],[5,5,.8]],stabilization:.5});
assert.equal(repeated.length,1,'stationary samples should form a dot, not zero-length normals');
assert.ok(repeated.every(p=>p.every(Number.isFinite)));
console.log(JSON.stringify({ok:true,jitterRms:rms,uniformSampleCount:a.length}));
