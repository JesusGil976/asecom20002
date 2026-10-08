const {cleanText,roundMoney}=require('../utils/text');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function quotePayment(db,settings,courseId,rawCode=''){
 const course=db.prepare("SELECT id,name,price_usd price FROM courses WHERE id=? AND status='published'").get(Number(courseId));
 if(!course)fail('Curso no encontrado o no disponible.',404);
 const code=cleanText(rawCode,50).toUpperCase();let coupon=null,discount=0;
 if(code){
  coupon=db.prepare('SELECT * FROM coupons WHERE code=? AND active=1').get(code);
  if(!coupon)fail('El cupón no existe o está inactivo.');
  if(coupon.expires_at&&(!Number.isFinite(Date.parse(coupon.expires_at))||Date.parse(coupon.expires_at)<=Date.now()))fail('El cupón ha expirado.');
  if(coupon.max_uses!==null&&coupon.uses_count>=coupon.max_uses)fail('El cupón alcanzó su límite de usos.');
  discount=Math.min(roundMoney(coupon.discount_type==='percent'?course.price*coupon.discount_value/100:coupon.discount_value),course.price);
 }
 const amountUsd=Math.max(0,roundMoney(course.price-discount)),exchangeRate=Number(settings.get('exchange_rate','0'));
 if(!Number.isFinite(exchangeRate)||exchangeRate<=0)fail('La tasa de cambio todavía no está configurada por la academia.',503);
 return {course,coupon,discount,amountUsd,exchangeRate,amountBs:roundMoney(amountUsd*exchangeRate)};
}
module.exports={quotePayment};
