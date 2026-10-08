module.exports={
 id:'003_v51_certificates',
 up(db){
  if(!db.prepare('PRAGMA table_info(certificates)').all().some(c=>c.name==='snapshot_json'))db.exec("ALTER TABLE certificates ADD COLUMN snapshot_json TEXT");
  const settings=Object.fromEntries(db.prepare('SELECT key,value FROM site_settings').all().map(r=>[r.key,r.value]));
  const {DEFAULT_LAYOUT,sanitizeLayout}=require('../../services/certificate-layout');
  let layout=DEFAULT_LAYOUT;try{if(settings.certificate_layout_json)layout=sanitizeLayout(JSON.parse(settings.certificate_layout_json));}catch{}
  const update=db.prepare('UPDATE certificates SET snapshot_json=? WHERE id=?');
  const existing=db.prepare('SELECT cert.id,cert.course_id,u.name student_name,c.name course_name,c.duration_hours FROM certificates cert JOIN users u ON u.id=cert.user_id JOIN courses c ON c.id=cert.course_id WHERE snapshot_json IS NULL').all();
  for(const row of existing)update.run(JSON.stringify({version:1,student_name:row.student_name,course_name:row.course_name,duration_hours:row.duration_hours,lessons:db.prepare('SELECT title FROM lessons WHERE course_id=? ORDER BY sort_order,id').all(row.course_id),layout,front_url:settings.certificate_front_url||'/uploads/certificates/demo-front.png',back_url:settings.certificate_back_url||'/uploads/certificates/demo-back.png',academy_name:settings.academy_name||'AcademiaVE'}),row.id);
  db.exec('CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status,created_at DESC);CREATE INDEX IF NOT EXISTS idx_lessons_course_order ON lessons(course_id,sort_order,id);CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);');
 }
};
