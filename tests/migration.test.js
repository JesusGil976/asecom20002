const test=require('node:test'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const {migrate}=require('../src/db');const {seedAll}=require('../src/db/seed');
test('actualización desde esquema v5.0.3.1 conserva filas, hashes y vuelve a migrar sin cambios',()=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');db.exec('CREATE TABLE schema_migrations(id TEXT PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
 for(const name of ['001_v43_compat','002_v5_platform']){const migration=require('../src/db/migrations/'+name);migration.up(db);db.prepare('INSERT INTO schema_migrations(id) VALUES(?)').run(migration.id);}
 seedAll(db);const admin=db.prepare("SELECT id FROM users WHERE role='admin'").get().id;const course=db.prepare('SELECT id FROM courses LIMIT 1').get().id;const lesson=db.prepare('SELECT id FROM lessons LIMIT 1').get().id;
 const payment=db.prepare("INSERT INTO payments(user_id,course_id,amount_usd,amount_bs,exchange_rate,payer_name,payer_bank,payer_phone,payer_document,reference,status) VALUES(?,?,25,2500,100,'Test','Banco','04140000000','V-1','MIG-1','approved')").run(admin,course).lastInsertRowid;
 db.prepare('INSERT INTO enrollments(user_id,course_id,payment_id) VALUES(?,?,?)').run(admin,course,payment);
 db.prepare('INSERT INTO lesson_progress(user_id,lesson_id,completed) VALUES(?,?,1)').run(admin,lesson);
 db.prepare("INSERT INTO certificates(user_id,course_id,code) VALUES(?,?,'MIG-CERT')").run(admin,course);
 db.prepare("INSERT INTO coupons(code,discount_type,discount_value) VALUES('MIG-COUPON','percent',20)").run();
 db.prepare("INSERT INTO payment_receipts(payment_id,original_name,stored_name,storage_path,mime_type) VALUES(?,'receipt.png','unique.png','/old/uploads/private/unique.png','image/png')").run(payment);
 db.prepare("INSERT INTO sessions(sid,sess,expire) VALUES('session','{}',9999999999999)").run();db.prepare("INSERT INTO locations(name,address) VALUES('Sede','Caracas')").run();
 const tables=['users','courses','lessons','enrollments','payments','payment_receipts','coupons','lesson_progress','certificates','site_settings','pages','page_versions','page_sections','design_tokens','locations','sessions','navigation_items'];
 const before=Object.fromEntries(tables.map(table=>[table,db.prepare('SELECT * FROM '+table).all()]));migrate(db);migrate(db);
 for(const table of tables){const after=db.prepare('SELECT * FROM '+table).all();if(table==='certificates')for(const row of after)delete row.snapshot_json;if(table==='lessons')for(const row of after){assert.equal(row.status,'published');delete row.status;delete row.video_asset_id;}if(table==='lesson_progress')for(const row of after)delete row.position_seconds;assert.deepEqual(after,before[table],table);}
 const snapshot=JSON.parse(db.prepare("SELECT snapshot_json FROM certificates WHERE code='MIG-CERT'").get().snapshot_json);assert.equal(snapshot.student_name,'Administrador');assert.ok(snapshot.lessons.length);assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(db.pragma('foreign_key_check'),[]);db.close();
});
