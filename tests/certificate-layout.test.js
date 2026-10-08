const test=require('node:test');
const assert=require('node:assert/strict');
const {createCertificateLayoutService,sanitizeLayout,DEFAULT_LAYOUT}=require('../src/services/certificate-layout');

function fakeDb(){
  const values=new Map();
  return {
    values,
    prepare(sql){
      if(sql.startsWith('SELECT value FROM site_settings')) return {get:key=>values.has(key)?{value:values.get(key)}:undefined};
      if(sql.startsWith('INSERT INTO site_settings')) return {run:(key,value)=>{values.set(key,String(value));return {changes:1};}};
      throw new Error(`SQL no soportado: ${sql}`);
    }
  };
}

test('layout de certificado conserva sólo campos y propiedades permitidas',()=>{
  const safe=sanitizeLayout({front:{student_name:{x:44,y:40,width:70,height:8,size:36,color:'#123456',align:'right',style:'italic',evil:'x'},unknown:{x:1}},back:{content:{x:-40,y:101,width:500,height:0,size:200,color:'red'}}});
  assert.equal(safe.front.student_name.x,30); // ancho 70 => x máximo 30
  assert.equal(safe.front.student_name.color,'#123456');
  assert.equal(safe.front.student_name.align,'right');
  assert.equal(safe.front.student_name.style,'italic');
  assert.equal(Object.hasOwn(safe.front,'unknown'),false);
  assert.equal(safe.back.content.x,0);
  assert.equal(safe.back.content.width,100);
  assert.equal(safe.back.content.height,3);
  assert.equal(safe.back.content.size,60);
  assert.equal(safe.back.content.color,DEFAULT_LAYOUT.back.content.color);
});

test('layout se persiste como JSON y puede restaurarse',()=>{
  const db=fakeDb();
  const service=createCertificateLayoutService(db);
  const initial=service.get();
  initial.front.student_name.x=7.5;
  const saved=service.update(initial);
  assert.equal(saved.front.student_name.x,7.5);
  assert.equal(service.get().front.student_name.x,7.5);
  const reset=service.reset();
  assert.equal(reset.front.student_name.x,DEFAULT_LAYOUT.front.student_name.x);
});
