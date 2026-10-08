const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto');
const {PDFDocument}=require('pdf-lib');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'academiave-flows-'));
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:tmp,PUBLIC_UPLOAD_DIR:path.join(tmp,'public'),DB_FILE:path.join(tmp,'academy.sqlite'),SESSION_SECRET:'workflow-tests-secret-abcdefghijklmnopqrstuvwxyz',PUBLIC_URL:'http://localhost:3000',ADMIN_EMAIL:'admin@flows.local',ADMIN_PASSWORD:'TestAdminPassword2026!',EXCHANGE_RATE:'123.45',MAX_RECEIPT_BYTES:'200000',LOG_LEVEL:'error',MAIL_HOST:'127.0.0.1',MAIL_USER:'',MAIL_PASSWORD:''});
const {createApp}=require('../src/app');const {getDatabase,closeDatabase}=require('../src/db');let server,base,smtp;const messages=[],sockets=new Set();
function client(){let cookie='',csrf='';return async(url,method='GET',body,options={})=>{const headers={...options.headers};if(cookie)headers.cookie=cookie;if(method!=='GET'&&options.csrf!==false)headers['x-csrf-token']=csrf;if(body!==undefined&&!(body instanceof FormData)){headers['content-type']='application/json';body=JSON.stringify(body);}const response=await fetch(base+url,{method,headers,body});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=(response.headers.get('content-type')||'').includes('json')?await response.json():Buffer.from(await response.arrayBuffer());if(data.csrfToken)csrf=data.csrfToken;return {status:response.status,data,headers:response.headers};};}
let admin,student,stranger,course,lessons,payment,receiptId,cert;
const paymentData=(id,reference,couponCode='')=>({courseId:id,payerName:'Alumna Test',payerBank:'Banco Test',payerPhone:'04141234567',payerDocument:'V-12345678',reference,couponCode});
async function register(c,email){await c('/api/auth/me');const r=await c('/api/auth/register','POST',{name:'María Rojas',email,password:'TestStudentPassword2026!'});assert.equal(r.status,201);return r.data;}
async function login(c,email,password){await c('/api/auth/me');const r=await c('/api/auth/login','POST',{email,password});assert.equal(r.status,200);return r.data;}
test.before(async()=>{
 smtp=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.write('220 localhost SMTP test\r\n');let input='',dataMode=false,mail='';socket.on('data',chunk=>{input+=chunk;while(input.includes('\r\n')){const at=input.indexOf('\r\n'),line=input.slice(0,at);input=input.slice(at+2);if(dataMode){if(line==='.'){messages.push(mail);mail='';dataMode=false;socket.write('250 accepted\r\n');}else mail+=line+'\r\n';}else if(/^EHLO|^HELO/i.test(line))socket.write('250 localhost\r\n');else if(/^DATA/i.test(line)){dataMode=true;socket.write('354 Send message\r\n');}else if(/^QUIT/i.test(line)){socket.end('221 Bye\r\n');}else socket.write('250 OK\r\n');}});});await new Promise(resolve=>smtp.listen(0,'127.0.0.1',resolve));process.env.MAIL_PORT=String(smtp.address().port);
 const app=createApp();await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',()=>{base=`http://127.0.0.1:${server.address().port}`;resolve();});});
 admin=client();student=client();stranger=client();await login(admin,process.env.ADMIN_EMAIL,process.env.ADMIN_PASSWORD);await register(student,'student@flows.local');await register(stranger,'stranger@flows.local');
 const r=await admin('/api/admin/courses','POST',{name:'Curso de Unicode · Formación',slug:'flows',price_usd:25,status:'published',duration_hours:40});assert.equal(r.status,201);course=r.data.course;
 lessons=[];for(let n=0;n<3;n++){const r=await admin(`/api/admin/courses/${course.id}/lessons`,'POST',{title:'Lección '+n,content:'Contenido privado',status:'published',sort_order:n,is_free:n===0});assert.equal(r.status,201);lessons.push(r.data.lesson);}
});
test.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>smtp.close(resolve));await new Promise(resolve=>server.close(resolve));closeDatabase();fs.rmSync(tmp,{recursive:true,force:true});});
test('CSRF se exige incluso en login; origen y CSP no se debilitan',async()=>{
 const guest=client();assert.equal((await guest('/api/auth/login','POST',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD},{csrf:false})).status,403);
 assert.equal((await student('/api/lessons/1/progress','POST',{completed:true},{headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await student('/api/admin/stats')).status,403);const health=await guest('/api/health');assert.match(health.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(health.headers.get('cache-control'),'private, no-store');
});
test('configuración inválida revierte el lote y no devuelve guardado falso',async()=>{
 const before=(await admin('/api/admin/settings')).data.settings.exchange_rate;
 for(const patch of [{exchange_rate:'200',unknown:'x'},{exchange_rate:'NaN'},{logo_url:'javascript:alert(1)'},{primary_color:'red'}])assert.equal((await admin('/api/admin/settings','PUT',patch)).status,400);
 assert.equal((await admin('/api/admin/settings')).data.settings.exchange_rate,before);
});
test('cupón porcentual, cotización y pago multipart con comprobante privado',async()=>{
 assert.equal((await admin('/api/admin/coupons','POST',{code:'FLOWS20',discount_type:'percent',discount_value:20,max_uses:1})).status,201);
 const q=await student(`/api/payments/quote?courseId=${course.id}&couponCode=FLOWS20`);assert.equal(q.status,200);assert.equal(q.data.quote.amountUsd,20);assert.equal(q.data.quote.amountBs,2469);
 const fd=new FormData();for(const[k,v]of Object.entries(paymentData(course.id,'REF-FLOW-01','FLOWS20')))fd.append(k,String(v));fd.append('receipt',new Blob([fs.readFileSync(path.join(__dirname,'../public/uploads/certificates/default-front.png'))],{type:'image/png'}),'../../receipt.png');
 const pay=await student('/api/payments','POST',fd);assert.equal(pay.status,201);payment=pay.data.payment;assert.equal(payment.amountUsd,20);
 const row=getDatabase().prepare('SELECT id,stored_name,storage_path FROM payment_receipts WHERE payment_id=?').get(payment.id);receiptId=row.id;assert.ok(!row.stored_name.includes('..'));assert.ok(row.storage_path.startsWith(tmp));
 assert.equal((await student(`/api/payment-receipts/${receiptId}`)).status,200);assert.equal((await stranger(`/api/payment-receipts/${receiptId}`)).status,403);assert.equal((await client()(`/api/payment-receipts/${receiptId}`)).status,401);
 assert.equal((await student(`/api/payments/quote?courseId=${course.id}&couponCode=FLOWS20`)).status,400);
});
test('pago pendiente bloquea duplicados; aprobación única matricula y conserva tasa histórica',async()=>{
 assert.equal((await student('/api/payments','POST',paymentData(course.id,'REF-FLOW-DUP'))).status,409);
 assert.equal((await student('/api/courses/flows/classroom')).status,403);
 assert.equal((await admin('/api/admin/settings','PUT',{exchange_rate:'200'})).status,200);
 assert.equal((await admin(`/api/admin/payments/${payment.id}/approve`,'POST',{})).status,200);assert.equal((await admin(`/api/admin/payments/${payment.id}/approve`,'POST',{})).status,409);
 assert.equal((await student('/api/courses/flows/classroom')).status,200);const historical=getDatabase().prepare('SELECT exchange_rate,amount_bs FROM payments WHERE id=?').get(payment.id);assert.deepEqual(historical,{exchange_rate:123.45,amount_bs:2469});
});
test('PDF de clase sólo lo lee administración o un matriculado; bytes incorrectos se rechazan',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([100,100]);const bytes=await pdf.save();const fd=new FormData();fd.append('file',new Blob([bytes],{type:'application/pdf'}),'material.pdf');const uploaded=await admin(`/api/admin/upload/pdf/${lessons[0].id}`,'POST',fd);assert.equal(uploaded.status,201);
 assert.equal((await student(uploaded.data.url)).status,200);assert.equal((await stranger(uploaded.data.url)).status,403);
 const invalid=new FormData();invalid.append('file',new Blob(['<script>alert(1)</script>'],{type:'image/png'}),'fake.png');assert.equal((await admin('/api/admin/upload/image','POST',invalid)).status,400);
 const truncated=new FormData();truncated.append('file',new Blob(['%PDF-1.7\n'],{type:'application/pdf'}),'fake.pdf');assert.equal((await admin(`/api/admin/upload/pdf/${lessons[0].id}`,'POST',truncated)).status,400);
});
test('progreso reversible, certificado a dos páginas y snapshot histórico',async()=>{
 assert.equal((await student('/api/courses/flows/certificate','POST',{})).status,409);
 for(const lesson of lessons){assert.equal((await student(`/api/lessons/${lesson.id}/view`,'POST',{})).status,200);assert.equal((await student(`/api/lessons/${lesson.id}/progress`,'POST',{completed:true})).status,200);}
 assert.equal((await student(`/api/lessons/${lessons[0].id}/progress`,'POST',{completed:false})).status,200);assert.equal((await student('/api/courses/flows/classroom')).data.progress.completed,2);await student(`/api/lessons/${lessons[0].id}/progress`,'POST',{completed:true});
 const issued=await student('/api/courses/flows/certificate','POST',{});assert.equal(issued.status,200);cert=issued.data.certificate;
 const pdf=await student(`/api/certificates/${cert.code}/pdf`);assert.equal(pdf.status,200);const document=await PDFDocument.load(pdf.data);assert.equal(document.getPageCount(),2);assert.ok(Math.abs(document.getPage(0).getWidth()-841.89)<.01);
 assert.equal((await stranger(`/api/certificates/${cert.code}/pdf`)).status,403);
 assert.equal((await admin(`/api/admin/courses/${course.id}`,'PUT',{...course,name:'Nuevo nombre',price_usd:25,status:'published',duration_hours:100})).status,200);
 const verified=await client()(`/api/certificates/${cert.code}`);assert.equal(verified.data.certificate.course_name,'Curso de Unicode · Formación');assert.equal(verified.data.certificate.duration_hours,40);
 const snapshot=JSON.parse(getDatabase().prepare('SELECT snapshot_json FROM certificates WHERE code=?').get(cert.code).snapshot_json);assert.equal(snapshot.lessons.length,3);
});
test('archivar retira del catálogo y conserva aula del alumno matriculado',async()=>{
 assert.equal((await admin(`/api/admin/courses/${course.id}`,'DELETE')).status,200);assert.equal((await student('/api/courses/flows/classroom')).status,200);assert.equal((await stranger('/api/courses/flows/classroom')).status,403);assert.ok(!(await client()('/api/courses')).data.courses.some(c=>c.id===course.id));
});
test('CMS inválido no cambia borrador; preview privado y publish persiste contenido válido',async()=>{
 const published=(await client()('/api/site')).data.home.sections;const draft=await admin('/api/admin/cms/home/draft','POST',{});const sections=draft.data.sections.map(({section_key,section_type,variant,enabled,settings})=>({section_key,section_type,variant,enabled,settings}));
 const invalid=structuredClone(sections);invalid[0].settings.title='<script>alert(1)</script>';assert.equal((await admin('/api/admin/cms/home/draft','PUT',{sections:invalid})).status,400);
 assert.deepEqual((await client()('/api/site')).data.home.sections,published);assert.equal((await stranger('/api/admin/cms/home/preview')).status,403);
 sections[0].settings.title='Nuevo borrador';sections.reverse();assert.equal((await admin('/api/admin/cms/home/draft','PUT',{sections})).status,200);assert.equal((await admin('/api/admin/cms/home/preview')).status,200);assert.equal((await admin('/api/admin/cms/home/publish','POST',{})).status,200);assert.ok((await client()('/api/site')).data.home.sections.some(s=>s.settings.title==='Nuevo borrador'));
});
test('cupón fijo, expiración, desactivación y rechazo sin matrícula',async()=>{
 const available=(await stranger('/api/courses')).data.courses[0];
 const created=await admin('/api/admin/coupons','POST',{code:'FIXED5',discount_type:'fixed',discount_value:5});assert.equal(created.status,201);
 const q=await stranger(`/api/payments/quote?courseId=${available.id}&couponCode=FIXED5`);assert.equal(q.data.quote.discountUsd,5);
 assert.equal((await admin('/api/admin/coupons','POST',{code:'EXPIRED',discount_type:'percent',discount_value:10,expires_at:'2020-01-01'})).status,201);assert.equal((await stranger(`/api/payments/quote?courseId=${available.id}&couponCode=EXPIRED`)).status,400);
 assert.equal((await admin('/api/admin/coupons','POST',{code:'BAD-DATE',discount_type:'percent',discount_value:10,expires_at:'invalid'})).status,400);
 const pay=await stranger('/api/payments','POST',{...paymentData(available.id,'REF-REJECT-01','FIXED5'),amountUsd:1,exchangeRate:1});assert.equal(pay.status,201);assert.equal(pay.data.payment.amountUsd,available.price-5);assert.equal(pay.data.payment.exchangeRate,200);
 assert.equal((await admin(`/api/admin/payments/${pay.data.payment.id}/reject`,'POST',{reason:'Referencia incorrecta'})).status,200);assert.equal((await admin(`/api/admin/payments/${pay.data.payment.id}/approve`,'POST',{})).status,409);assert.equal((await stranger(`/api/courses/${available.slug}/classroom`)).status,403);
 assert.equal((await admin(`/api/admin/coupons/${created.data.coupon.id}`,'PUT',{active:false})).status,200);assert.equal((await stranger(`/api/payments/quote?courseId=${available.id}&couponCode=FIXED5`)).status,400);
});
test('preview libre no revela clases privadas y subida admin exige rol',async()=>{
 const catalog=(await client()('/api/courses')).data.courses[0];const detail=(await client()(`/api/courses/${catalog.slug}`)).data;const free=detail.lessons.find(l=>l.is_free),locked=detail.lessons.find(l=>!l.is_free);assert.ok(free&&locked);
 assert.equal((await client()(`/api/courses/${catalog.slug}/preview/${free.id}`)).status,200);assert.equal((await client()(`/api/courses/${catalog.slug}/preview/${locked.id}`)).status,404);assert.equal((await stranger('/api/admin/upload/image','POST',{})).status,403);
 const fd=new FormData();for(const[k,v]of Object.entries(paymentData(catalog.id,'REF-OVERSIZE-01')))fd.append(k,String(v));fd.append('receipt',new Blob([Buffer.alloc(200001)],{type:'application/pdf'}),'too-large.pdf');assert.equal((await stranger('/api/payments','POST',fd)).status,413);
});
test('cookies HttpOnly y SameSite; contraseñas mayores a 72 bytes no se truncan',async()=>{
 const c=client();const me=await c('/api/auth/me');assert.match(me.headers.get('set-cookie'),/HttpOnly/);assert.match(me.headers.get('set-cookie'),/SameSite=Lax/);
 assert.equal((await c('/api/auth/register','POST',{name:'Test',email:'long@flows.local',password:'é'.repeat(40),role:'admin'})).status,400);
});
test('recuperación entrega correo SMTP local; token único invalida todas las sesiones',async()=>{
 const second=client();await login(second,'student@flows.local','TestStudentPassword2026!');const before=messages.length;
 const unknown=await stranger('/api/auth/forgot-password','POST',{email:'missing@flows.local'});const known=await stranger('/api/auth/forgot-password','POST',{email:'student@flows.local'});assert.deepEqual(unknown.data,known.data);assert.equal(messages.length,before+1);
 const token=messages.at(-1).replace(/=\r?\n/g,'').replace(/=3D/g,'=').match(/token=([a-f0-9]{64})/)?.[1];assert.ok(token);assert.ok(getDatabase().prepare('SELECT token_hash FROM password_reset_tokens').get().token_hash!==token);
 const resetClient=client();await resetClient('/api/auth/me');const reset=await resetClient('/api/auth/reset-password','POST',{token,password:'NewStudentPassword2026!',confirmPassword:'NewStudentPassword2026!'});assert.equal(reset.status,200);assert.equal((await student('/api/dashboard')).status,401);assert.equal((await second('/api/dashboard')).status,401);
 await resetClient('/api/auth/me');assert.equal((await resetClient('/api/auth/reset-password','POST',{token,password:'NewStudentPassword2026!',confirmPassword:'NewStudentPassword2026!'})).status,400);
 await login(student,'student@flows.local','NewStudentPassword2026!');assert.equal((await student('/api/auth/logout','POST',{})).status,200);assert.equal((await student('/api/dashboard')).status,401);
});
test('reset expirado y dos solicitudes paralelas sólo permiten un uso',async()=>{
 const db=getDatabase(),user=db.prepare('SELECT id FROM users WHERE email=?').get('stranger@flows.local');const make=(token,expires)=>db.prepare('INSERT INTO password_reset_tokens(user_id,token_hash,expires_at_ms) VALUES(?,?,?)').run(user.id,crypto.createHash('sha256').update(token).digest('hex'),expires);
 const c=client();await c('/api/auth/me');make('expired',Date.now()-1);assert.equal((await c('/api/auth/reset-password','POST',{token:'expired',password:'Password2026!',confirmPassword:'Password2026!'})).status,400);
 make('parallel',Date.now()+60000);const a=client(),b=client();await a('/api/auth/me');await b('/api/auth/me');const responses=await Promise.all([a('/api/auth/reset-password','POST',{token:'parallel',password:'PasswordAAAA2026!',confirmPassword:'PasswordAAAA2026!'}),b('/api/auth/reset-password','POST',{token:'parallel',password:'PasswordBBBB2026!',confirmPassword:'PasswordBBBB2026!'})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
});
