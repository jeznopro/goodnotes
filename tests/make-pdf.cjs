const fs=require('fs'),path=require('path');
const {PDFDocument,StandardFonts,PDFName,degrees}=require('C:/Users/MinhTriet/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdf-lib');
(async()=>{const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const a=pdf.addPage([595,842]),b=pdf.addPage([650,880]);a.drawText('Searchable Original PDF',{x:70,y:700,size:25,font});a.drawText('Go to page two',{x:70,y:650,size:16,font});b.drawText('Second searchable page',{x:90,y:600,size:22,font});b.setCropBox(20,30,600,800);b.setRotation(degrees(90));
 const link=pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[65,640,230,670],Border:[0,0,0],Dest:[b.ref,PDFName.of('Fit')]}));a.node.set(PDFName.of('Annots'),pdf.context.obj([link]));
 const out=path.join(__dirname,'results','original-searchable.pdf');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,await pdf.save());console.log(out);})();
