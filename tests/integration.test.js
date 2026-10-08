const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');

let available=true;
for(const pkg of ['express','better-sqlite3','bcryptjs','helmet','express-session','express-rate-limit','multer','nodemailer','pdf-lib']){
  try{require.resolve(pkg);}catch{available=false;break;}
}

if(!available){
  test('integración HTTP (requiere npm install)',{skip:'Dependencias npm no instaladas en este entorno'},()=>{});
}else{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'academiave-v5-'));
  process.env.NODE_ENV='test';
  process.env.DB_FILE=path.join(tmp,'academy.sqlite');
  process.env.DATA_DIR=tmp;
  process.env.SESSION_SECRET='test-session-secret-abcdefghijklmnopqrstuvwxyz-123456';
  process.env.PUBLIC_URL='http://127.0.0.1';
  process.env.EXCHANGE_RATE='100';
  process.env.ADMIN_EMAIL='admin@test.local';
  process.env.ADMIN_PASSWORD='StrongAdminPass123!';
  const {createApp}=require('../src/app');
  const {getDatabase,closeDatabase}=require('../src/db');
  const app=createApp();
  let server,base;

  function client(){
    let cookie='';
    return async function request(url,options={}){
      const headers=new Headers(options.headers||{}); if(cookie)headers.set('cookie',cookie);
      const response=await fetch(base+url,{...options,headers,redirect:'manual'});
      const set=response.headers.get('set-cookie'); if(set)cookie=set.split(';')[0];
      const type=response.headers.get('content-type')||''; const body=type.includes('json')?await response.json():await response.text();
      return {response,body,cookie};
    };
  }
  async function jsonRequest(c,url,method='GET',body=null,csrf=''){
    if(!csrf && method!=='GET')csrf=(await c('/api/auth/me')).body.csrfToken;
    const headers={}; if(body!==null)headers['content-type']='application/json'; if(csrf)headers['x-csrf-token']=csrf;
    return c(url,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  }
  async function login(c,email,password){const r=await jsonRequest(c,'/api/auth/login','POST',{email,password});assert.equal(r.response.status,200);return r.body;}

  test.before(async()=>{await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',()=>{base=`http://127.0.0.1:${server.address().port}`;resolve();});});});
  test.after(async()=>{await new Promise(resolve=>server.close(resolve));closeDatabase();fs.rmSync(tmp,{recursive:true,force:true});});

  test('health check público',async()=>{const c=client();const r=await c('/api/health');assert.equal(r.response.status,200);assert.equal(r.body.ok,true);});

  test('administración guarda Pago Móvil y tasa de cambio',async()=>{
    const admin=client();const logged=await login(admin,'admin@test.local','StrongAdminPass123!');const csrf=logged.csrfToken;
    const saved=await jsonRequest(admin,'/api/admin/settings','PUT',{payment_bank:'Banco Test',payment_phone:'04140000000',payment_document:'V-10000000',exchange_rate:'123.4567'},csrf);
    assert.equal(saved.response.status,200);assert.equal(saved.body.settings.exchange_rate,'123.4567');assert.equal(saved.body.settings.payment_bank,'Banco Test');
    const config=await admin('/api/payment-config');assert.equal(config.response.status,200);assert.equal(config.body.exchangeRate,123.4567);assert.equal(config.body.bank,'Banco Test');
  });

  test('registro, permisos, pago, aprobación, progreso y certificado',async()=>{
    const student=client();
    const reg=await jsonRequest(student,'/api/auth/register','POST',{name:'Alumno Test',email:'alumno@test.local',password:'Password123!'});
    assert.equal(reg.response.status,201); const csrf=reg.body.csrfToken;
    const forbidden=await student('/api/admin/stats'); assert.equal(forbidden.response.status,403);
    const catalog=await student('/api/courses'); assert.equal(catalog.response.status,200); const course=catalog.body.courses[0]; assert.ok(course);
    const pay=await jsonRequest(student,'/api/payments','POST',{courseId:course.id,payerName:'Alumno Test',payerBank:'Banco Test',payerPhone:'04141234567',payerDocument:'V-12345678',reference:'REF-TEST-001'},csrf);
    assert.equal(pay.response.status,201);

    const admin=client(); const adminLogin=await login(admin,'admin@test.local','StrongAdminPass123!'); const adminCsrf=adminLogin.csrfToken;
    const approve=await jsonRequest(admin,`/api/admin/payments/${pay.body.payment.id}/approve`,'POST',{},adminCsrf); assert.equal(approve.response.status,200);
    const classroom=await student(`/api/courses/${course.slug}/classroom`); assert.equal(classroom.response.status,200); assert.ok(classroom.body.lessons.length>0);
    for(const lesson of classroom.body.lessons){const done=await jsonRequest(student,`/api/lessons/${lesson.id}/progress`,'POST',{completed:true},csrf);assert.equal(done.response.status,200);}
    const cert=await jsonRequest(student,`/api/courses/${course.slug}/certificate`,'POST',{},csrf); assert.equal(cert.response.status,200); assert.match(cert.body.certificate.code,/^AVE-/);
    const verify=await student(`/api/certificates/${cert.body.certificate.code}`); assert.equal(verify.response.status,200); assert.equal(verify.body.certificate.student_name,'Alumno Test');
  });

  test('CMS crea borrador, guarda secciones y publica versión',async()=>{
    const admin=client();const logged=await login(admin,'admin@test.local','StrongAdminPass123!');const csrf=logged.csrfToken;
    const draft=await jsonRequest(admin,'/api/admin/cms/home/draft','POST',{},csrf);assert.equal(draft.response.status,200);
    const sections=draft.body.sections.map((s,i)=>({section_key:s.section_key,section_type:s.section_type,variant:s.variant,enabled:s.enabled,settings:s.settings}));
    sections[0].settings.title='Inicio de integración';
    const saved=await jsonRequest(admin,'/api/admin/cms/home/draft','PUT',{sections},csrf);assert.equal(saved.response.status,200);
    const published=await jsonRequest(admin,'/api/admin/cms/home/publish','POST',{},csrf);assert.equal(published.response.status,200);
    const site=await admin('/api/site');assert.equal(site.response.status,200);assert.equal(site.body.home.sections[0].settings.title,'Inicio de integración');
  });

  test('reset de contraseña usa hash, expira y eleva session_version',async()=>{
    const db=getDatabase();const user=db.prepare('SELECT id,session_version FROM users WHERE email=?').get('alumno@test.local');const before=user.session_version;
    const token='known-reset-token-for-test';const hash=crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('INSERT INTO password_reset_tokens (user_id,token_hash,expires_at_ms) VALUES (?,?,?)').run(user.id,hash,Date.now()+60000);
    const c=client();const reset=await jsonRequest(c,'/api/auth/reset-password','POST',{token,password:'NewPassword123!',confirmPassword:'NewPassword123!'});assert.equal(reset.response.status,200);
    const after=db.prepare('SELECT session_version FROM users WHERE id=?').get(user.id).session_version;assert.equal(after,before+1);
    const reused=await jsonRequest(c,'/api/auth/reset-password','POST',{token,password:'AnotherPassword123!',confirmPassword:'AnotherPassword123!'});assert.equal(reused.response.status,400);
  });
}
