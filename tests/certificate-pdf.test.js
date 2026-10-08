const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('child_process'),{PDFDocument}=require('pdf-lib');
const {createCertificateService}=require('../src/services/certificates'),{DEFAULT_LAYOUT}=require('../src/services/certificate-layout');
function service(lessons){return createCertificateService({prepare:sql=>({get:()=>sql.includes('snapshot_json')?undefined:{duration_hours:150},all:()=>lessons})},{get:key=>({certificate_front_url:'/uploads/certificates/default-front.png',certificate_back_url:'/uploads/certificates/default-back.png',academy_name:'AcademiaVE'}[key]||'')},{get:()=>structuredClone(DEFAULT_LAYOUT)});}
const certificate={code:'AVE-LONG-2026',student_name:'María Rojas · Formación',course_name:'Curso práctico',course_id:1,issued_at:'2026-10-03'};
test('PDF conserva 150 clases completas en dos páginas A4; Unicode funciona',async()=>{
 const lessons=Array.from({length:150},(_,i)=>({title:'Lección '+String(i+1).padStart(3,'0')}));const bytes=await service(lessons).createPdf(certificate);const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2);for(const page of pdf.getPages()){assert.equal(page.getWidth(),841.89);assert.equal(page.getHeight(),595.28);}
 const text=spawnSync('pdftotext',['-','-'],{input:bytes,encoding:'utf8'});if(text.error?.code==='ENOENT')return;assert.equal(text.status,0,text.stderr);for(const lesson of lessons)assert.ok(text.stdout.includes(lesson.title),lesson.title);assert.match(text.stdout,/María Rojas/);
});
test('PDF rechaza temario imposible de alojar y caracteres ausentes, sin recorte silencioso',async()=>{
 await assert.rejects(()=>service(Array.from({length:1000},()=>({title:'Título extenso '.repeat(20)}))).createPdf(certificate),e=>e.status===422);
 await assert.rejects(()=>service([]).createPdf({...certificate,student_name:'學習者'}),e=>e.status===422);
});
