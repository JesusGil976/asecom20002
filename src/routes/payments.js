const express=require('express');
const multer=require('multer');
const fs=require('fs');
const { cleanText, roundMoney }=require('../utils/text');
const { paymentLimiter }=require('../middleware/rate-limits');
const { quotePayment }=require('../services/pricing');
const { safePrivateUpload }=require('../services/files');

function createPaymentRoutes({db,auth,settings,audit}){
  const router=express.Router();
  const memory=multer({storage:multer.memoryStorage(),limits:{fileSize:Number(process.env.MAX_RECEIPT_BYTES||8*1024*1024)}});
  router.use(auth.requireAuth);

  router.get('/payment-config',(req,res)=>{
    const cfg=settings.getMany(['payment_bank','payment_phone','payment_document','exchange_rate']);
    res.json({bank:cfg.payment_bank,phone:cfg.payment_phone,document:cfg.payment_document,exchangeRate:Number(cfg.exchange_rate||0),currency:'VES'});
  });

  router.get('/payments/quote',(req,res,next)=>{try{const q=quotePayment(db,settings,req.query.courseId,req.query.couponCode);res.json({quote:{courseId:q.course.id,originalAmountUsd:q.course.price,discountUsd:q.discount,amountUsd:q.amountUsd,amountBs:q.amountBs,exchangeRate:q.exchangeRate,couponCode:q.coupon?.code||null}});}catch(error){next(error);}});

  router.get('/payments/my',(req,res)=>{
    const payments=db.prepare(`SELECT p.id,c.slug course_slug,c.name course_name,p.original_amount_usd,p.discount_usd,p.amount_usd amount,p.amount_bs,p.exchange_rate,p.reference,p.status,p.rejection_reason,p.created_at,p.reviewed_at,p.approved_at,CASE WHEN pr.id IS NULL THEN NULL ELSE '/api/payment-receipts/'||pr.id END receipt_url FROM payments p JOIN courses c ON c.id=p.course_id LEFT JOIN payment_receipts pr ON pr.payment_id=p.id WHERE p.user_id=? ORDER BY p.created_at DESC,p.id DESC`).all(req.user.id);
    res.json({payments});
  });

  router.post('/payments',paymentLimiter,auth.requireCsrf,memory.single('receipt'),(req,res,next)=>{
    let saved=null;
    try{
      const courseId=Number(req.body.courseId); const payerName=cleanText(req.body.payerName,120); const payerBank=cleanText(req.body.payerBank,120); const payerPhone=cleanText(req.body.payerPhone,30); const payerDocument=cleanText(req.body.payerDocument,40); const reference=cleanText(req.body.reference,80); const couponCode=cleanText(req.body.couponCode,50).toUpperCase();
      if(!Number.isInteger(courseId)||courseId<=0) return res.status(400).json({error:'Curso no válido.'});
      if(payerName.length<2||payerBank.length<2||payerPhone.length<5||payerDocument.length<3) return res.status(400).json({error:'Completa correctamente todos los datos del pago.'});
      if(reference.length<4) return res.status(400).json({error:'La referencia bancaria no es válida.'});
      const course=db.prepare("SELECT id,name,price_usd price FROM courses WHERE id=? AND status='published'").get(courseId); if(!course) return res.status(404).json({error:'Curso no encontrado o no disponible.'});
      if(db.prepare('SELECT id FROM enrollments WHERE user_id=? AND course_id=?').get(req.user.id,courseId)) return res.status(409).json({error:'Ya tienes acceso a este curso.'});
      if(db.prepare("SELECT id FROM payments WHERE user_id=? AND course_id=? AND status='pending'").get(req.user.id,courseId)) return res.status(409).json({error:'Ya tienes un pago pendiente para este curso.'});
      if(db.prepare('SELECT id FROM payments WHERE reference=?').get(reference)) return res.status(409).json({error:'Esa referencia bancaria ya fue registrada.'});
      const quote=quotePayment(db,settings,courseId,couponCode);const coupon=quote.coupon,discount=quote.discount,finalUsd=quote.amountUsd,exchangeRate=quote.exchangeRate,amountBs=quote.amountBs;
      if(req.file) saved=safePrivateUpload(req.file,{allow:['image','pdf'],maxBytes:Number(process.env.MAX_RECEIPT_BYTES||8*1024*1024)});
      const paymentId=db.transaction(()=>{ const result=db.prepare(`INSERT INTO payments (user_id,course_id,original_amount_usd,discount_usd,amount_usd,amount_bs,exchange_rate,coupon_id,payer_name,payer_bank,payer_phone,payer_document,reference,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`).run(req.user.id,course.id,course.price,discount,finalUsd,amountBs,exchangeRate,coupon?coupon.id:null,payerName,payerBank,payerPhone,payerDocument,reference); const id=Number(result.lastInsertRowid); if(saved) db.prepare('INSERT INTO payment_receipts (payment_id,original_name,stored_name,storage_path,mime_type,size_bytes) VALUES (?,?,?,?,?,?)').run(id,cleanText(req.file.originalname,255),saved.storedName,saved.storagePath,saved.mimeType,saved.sizeBytes); if(coupon) db.prepare('UPDATE coupons SET uses_count=uses_count+1 WHERE id=?').run(coupon.id); return id; })();
      audit.write({actorUserId:req.user.id,action:'payment.created',entityType:'payment',entityId:paymentId,metadata:{courseId,amountUsd:finalUsd},ip:req.ip});
      res.status(201).json({payment:{id:paymentId,courseName:course.name,originalAmountUsd:course.price,discountUsd:discount,amountUsd:finalUsd,amountBs,exchangeRate,status:'pending',hasReceipt:Boolean(saved)}});
    }catch(error){ if(saved?.storagePath){try{fs.unlinkSync(saved.storagePath)}catch{}} next(error); }
  });
  return router;
}
module.exports={createPaymentRoutes};
