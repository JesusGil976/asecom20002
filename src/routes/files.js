const express=require('express');
const fs=require('fs');
const path=require('path');
const {config}=require('../config');
function storagePath(file){const relocated=path.join(config.privateUploadDir,path.basename(file.stored_name));return fs.existsSync(relocated)?relocated:path.resolve(file.storage_path);}

function createFileRoutes({db,auth}){
  const router=express.Router();
  router.get('/payment-receipts/:id',auth.requireAuth,(req,res)=>{
    const receipt=db.prepare('SELECT pr.*,p.user_id FROM payment_receipts pr JOIN payments p ON p.id=pr.payment_id WHERE pr.id=?').get(Number(req.params.id));
    if(!receipt) return res.status(404).json({error:'Comprobante no encontrado.'});
    if(req.user.role!=='admin'&&receipt.user_id!==req.user.id) return res.status(403).json({error:'No tienes acceso a este comprobante.'});
    if(!fs.existsSync(storagePath(receipt))) return res.status(404).json({error:'Archivo no disponible.'});
    res.setHeader('Content-Type',receipt.mime_type); res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox"); res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(receipt.original_name)}`); res.sendFile(storagePath(receipt));
  });
  router.get('/media/:id',auth.requireAuth,(req,res)=>{
    const media=db.prepare("SELECT * FROM media WHERE id=? AND kind='pdf'").get(Number(req.params.id)); if(!media) return res.status(404).json({error:'Archivo no encontrado.'});
    if(req.user.role!=='admin'){ const lesson=db.prepare("SELECT course_id FROM lessons WHERE id=? AND status='published'").get(media.lesson_id); const enrollment=lesson&&db.prepare('SELECT id FROM enrollments WHERE user_id=? AND course_id=?').get(req.user.id,lesson.course_id); if(!enrollment) return res.status(403).json({error:'No tienes acceso a este material.'}); }
    if(!fs.existsSync(storagePath(media))) return res.status(404).json({error:'Archivo no disponible.'});
    res.setHeader('Content-Type','application/pdf'); res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox"); res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(media.original_name)}`); res.sendFile(storagePath(media));
  });
  return router;
}
module.exports={createFileRoutes};
