const fs=require('fs');const path=require('path');
const esbuild=require('esbuild');
const deps=process.env.PAPERNOTE_DEPENDENCIES||path.join(__dirname,'node_modules');
async function main(){
 await esbuild.build({entryPoints:[path.join(__dirname,'web/main.js')],outfile:path.join(__dirname,'web/app.js'),bundle:true,format:'iife',target:'chrome120',external:['./pdf.mjs'],loader:{'.svg':'text'},nodePaths:[deps],minify:true,legalComments:'eof'});
 const pdfjs=path.join(deps,'pdfjs-dist');
 for(const file of ['pdf.mjs','pdf.worker.mjs'])fs.copyFileSync(path.join(pdfjs,'build',file),path.join(__dirname,'web',file));
 for(const dir of ['cmaps','standard_fonts','wasm'])fs.cpSync(path.join(pdfjs,dir),path.join(__dirname,'web',dir),{recursive:true});
 const license=path.join(__dirname,'web','licenses');fs.mkdirSync(license,{recursive:true});
 for(const [name,file] of [['pdfjs-dist','LICENSE'],['pdf-lib','LICENSE.md']]){const p=path.join(deps,name,file);if(fs.existsSync(p))fs.copyFileSync(p,path.join(license,name+'.txt'));}
 console.log('PaperNote UI built.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
