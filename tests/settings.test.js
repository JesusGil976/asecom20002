const test=require('node:test');
const assert=require('node:assert/strict');
const {createSettingsService,ADMIN_SETTING_KEYS}=require('../src/services/settings');

function fakeDb(){
  const values=new Map();
  return {
    values,
    prepare(sql){
      if(sql.startsWith('SELECT value FROM site_settings')) return {get:key=>values.has(key)?{value:values.get(key)}:undefined};
      if(sql.startsWith('INSERT INTO site_settings')) return {run:(key,value)=>{values.set(key,String(value));return {changes:1};}};
      if(sql.startsWith('SELECT key,value FROM design_tokens')) return {all:()=>[]};
      throw new Error(`SQL no soportado en fakeDb: ${sql}`);
    },
    transaction(fn){return (...args)=>fn(...args);}
  };
}

test('configuración administrativa permite guardar Pago Móvil y tasa',()=>{
  for(const key of ['payment_bank','payment_phone','payment_document','exchange_rate']) assert.ok(ADMIN_SETTING_KEYS.includes(key),`${key} debe estar permitido`);
  const db=fakeDb();
  const settings=createSettingsService(db);
  const result=settings.updateSettings({
    payment_bank:'Banco de prueba',
    payment_phone:'0414-0000000',
    payment_document:'V-10000000',
    exchange_rate:'47.1250'
  });
  assert.equal(result.payment_bank,'Banco de prueba');
  assert.equal(result.exchange_rate,'47.125');
  assert.equal(settings.get('exchange_rate'),'47.125');
});

test('configuración administrativa permite persistir plantillas de certificado',()=>{
  for(const key of ['certificate_front_url','certificate_back_url']) assert.ok(ADMIN_SETTING_KEYS.includes(key),`${key} debe estar permitido`);
  const db=fakeDb();
  const settings=createSettingsService(db);
  const result=settings.updateSettings({certificate_front_url:'/uploads/certificates/front.png',certificate_back_url:'/uploads/certificates/back.png'});
  assert.equal(result.certificate_front_url,'/uploads/certificates/front.png');
  assert.equal(result.certificate_back_url,'/uploads/certificates/back.png');
});

test('rechaza una tasa de cambio inválida',()=>{
  const db=fakeDb();
  const settings=createSettingsService(db);
  assert.throws(()=>settings.updateSettings({exchange_rate:'abc'}),/Tasa de cambio inválida/);
});
