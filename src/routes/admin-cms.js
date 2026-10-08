const express=require('express');

function createAdminCmsRoutes({auth,cms,audit}){
  const router=express.Router(); router.use(auth.requireAdmin);
  router.get('/cms/:slug',(req,res)=>{const data=cms.getEditor(req.params.slug);if(!data)return res.status(404).json({error:'Página no encontrada.'});res.json({page:data.page,version:data.version,sections:data.sections,sectionTypes:cms.SECTION_TYPES});});
  router.post('/cms/:slug/draft',auth.requireCsrf,(req,res,next)=>{try{const data=cms.ensureDraft(req.params.slug,req.user.id);audit.write({actorUserId:req.user.id,action:'cms.draft_created',entityType:'page',entityId:req.params.slug,ip:req.ip});res.json(data);}catch(error){next(error);}});
  router.put('/cms/:slug/draft',auth.requireCsrf,(req,res,next)=>{try{const data=cms.saveDraft(req.params.slug,req.user.id,req.body.sections);audit.write({actorUserId:req.user.id,action:'cms.draft_saved',entityType:'page',entityId:req.params.slug,metadata:{sections:data.sections.length},ip:req.ip});res.json(data);}catch(error){next(error);}});
  router.get('/cms/:slug/preview',(req,res)=>{const data=cms.getEditor(req.params.slug);if(!data)return res.status(404).json({error:'Página no encontrada.'});res.json({page:data.page,version:data.version,sections:data.sections,preview:true});});
  router.post('/cms/:slug/publish',auth.requireCsrf,(req,res,next)=>{try{const data=cms.publish(req.params.slug,req.user.id);audit.write({actorUserId:req.user.id,action:'cms.published',entityType:'page',entityId:req.params.slug,metadata:{version:data.version.version_number},ip:req.ip});res.json(data);}catch(error){next(error);}});
  router.delete('/cms/:slug/draft',auth.requireCsrf,(req,res)=>{cms.discardDraft(req.params.slug);audit.write({actorUserId:req.user.id,action:'cms.draft_discarded',entityType:'page',entityId:req.params.slug,ip:req.ip});res.json({ok:true});});
  return router;
}
module.exports={createAdminCmsRoutes};
