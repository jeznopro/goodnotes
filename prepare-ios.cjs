const fs=require('node:fs');
const path=require('node:path');
const web=path.join(__dirname,'web');
const www=path.join(__dirname,'www');
fs.rmSync(www,{recursive:true,force:true});
fs.cpSync(web,www,{recursive:true});
