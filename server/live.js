import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const router=Router();
const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const base=()=>{if(!url||!key)throw Object.assign(Error('Supabase credentials missing from .env'),{status:503});return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
const userClient=token=>createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
const run=f=>(req,res,next)=>Promise.resolve(f(req,res,next)).catch(next);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const text=(v,max=200)=>String(v??'').trim().slice(0,max);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_EMAILS=new Set(['kunalvishwakarma2903@gmail.com','shwetaansh@livance.co.in']);
const email=v=>{const e=text(v,254).toLowerCase();if(!emailPattern.test(e))throw fail(400,'Enter a valid email address');return e};
const limit=new Map();
function basicLimit(req,rate=12,period=3600000){const ip=String(req.headers['x-forwarded-for']||req.ip||'').split(',')[0];const k=`${req.path}/${ip}`;const now=Date.now();const r=limit.get(k)||{n:0,end:now+period};if(r.end<now){r.end=now+period;r.n=0}r.n++;limit.set(k,r);if(limit.size>10000)limit.clear();if(r.n>rate)throw fail(429,'Too many requests. Please try again later.')}
const token=req=>{const m=/^Bearer (\S+)$/i.exec(req.headers.authorization||'');if(!m)throw fail(401,'Sign in required');return m[1]};
async function identity(req){const access=token(req),client=userClient(access);const {data:{user},error}=await client.auth.getUser(access);if(error||!user)throw fail(401,'Your session has expired');const {data:profile,error:pe}=await client.from('profiles').select('id,role,full_name').eq('id',user.id).maybeSingle();if(pe)throw fail(503,`Profile lookup failed: ${pe.message}`);const role=profile?.role==='admin'&&!ADMIN_EMAILS.has(user.email?.toLowerCase())?'member':profile?.role||'member';return {user,client,role,name:profile?.full_name||user.user_metadata?.full_name||''}}
async function asAdmin(req){const actor=await identity(req);if(actor.role!=='admin')throw fail(403,'Administrator access required');return actor}
// All email is server-side. No Resend key is sent to the browser.
function htmlEscape(s){return String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
function configuredMail(){return !!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM)}
async function deliver(to,subject,body,kind='transactional',opt={}){
 if(!configuredMail())throw fail(503,'Email is not configured. Set RESEND_API_KEY and a verified EMAIL_FROM.');
 const recipient=email(to),title=text(subject,240),content=text(body,9000);
 if(!title||!content)throw fail(400,'Email subject and body are required');
 const html='<div style="font:15px/1.7 Arial,sans-serif;color:#253047;max-width:680px">'+htmlEscape(content).replace(/\n/g,'<br>')+(opt.unsubscribe?`<hr><p style="font-size:12px;color:#667085">To stop marketing email, <a href="${htmlEscape(opt.unsubscribe)}">unsubscribe here</a>.</p>`:'')+'</div>';
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.RESEND_API_KEY}`},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[recipient],subject:title,html, ...(opt.unsubscribe?{headers:{'List-Unsubscribe':`<${opt.unsubscribe}>`}}:{})})});
 const data=await r.json().catch(()=>({}));if(!r.ok||!data.id)throw fail(502,`Email provider: ${data.message||r.status}`);return data.id;
}
router.get('/health',(_req,res)=>res.json({ok:true,backend:'livance',supabase:!!(url&&key),email:configuredMail(),paymentMode:'booking_request_only'}));
router.get('/session',run(async(req,res)=>{const a=await identity(req);res.json({id:a.user.id,email:a.user.email,role:a.role,name:a.name,phone:a.user.user_metadata?.phone||''})}));
router.get('/public-state',run(async(_req,res)=>{const {data,error}=await base().from('livance_public_state').select('payload,version').eq('id',1).maybeSingle();if(error)throw fail(503,error.message);res.json({version:data?.version||0,data:data?.payload||null})}));
router.get('/admin/state',run(async(req,res)=>{const a=await asAdmin(req);const {data,error}=await a.client.from('livance_state').select('payload,version').eq('id',1).maybeSingle();if(error)throw fail(503,error.message);res.json({version:data?.version||0,data:data?.payload||null})}));
// Single-writer optimistic concurrency: never silently overwrite another admin's changes.
router.put('/admin/state',run(async(req,res)=>{
 const a=await asAdmin(req),expected=Number(req.body?.version),data=req.body?.data;
 if(!Number.isInteger(expected)||expected<0||!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Invalid state payload');
 const obj=structuredClone(data);
 delete obj.session;delete obj.access_token;delete obj.refresh_token;
 if(Array.isArray(obj.users))obj.users=obj.users.map(u=>{const {password,token,refreshToken,...rest}=u;return rest});
 // Do not allow fake paid orders from the browser to be treated as real payment evidence.
 if(Array.isArray(obj.orders))obj.orders=obj.orders.map(o=>({...o,status:o.status==='paid'?'unverified':o.status}));
 if(JSON.stringify(obj).length>1500000)throw fail(413,'State exceeds 1.5 MB');
 let response;
 if(expected===0){const {data:row,error}=await a.client.from('livance_state').insert({id:1,payload:obj,version:1}).select('version').single();if(error){if(error.code==='23505')throw fail(409,'The state was initialized in another session');throw fail(503,error.message)}response=row}
 else {const {data:row,error}=await a.client.from('livance_state').update({payload:obj,version:expected+1,updated_at:new Date().toISOString()}).eq('id',1).eq('version',expected).select('version').maybeSingle();if(error)throw fail(503,error.message);if(!row)throw fail(409,'Another admin changed the data. Reload to review before saving.');response=row}
 res.json({ok:true,version:response.version});
}));
router.post('/enquiries',run(async(req,res)=>{
 basicLimit(req);if(req.body?.website)return res.status(202).json({ok:true});
 const b=req.body||{};let phone=text(b.phone,20).replace(/\D/g,'');if(phone.length===12&&phone.startsWith('91'))phone=phone.slice(2);
 if(text(b.name,100).length<2||!/^\d{10}$/.test(phone))throw fail(400,'Enter your name and 10-digit mobile');
 const row={name:text(b.name,100),email:email(b.email),phone,company:text(b.company,140)||null,solution:text(b.solution,80)||null,vo_plan:text(b.voPlan,50)||null,seats:b.seats?Number(b.seats):null,centre:text(b.centre,80)||null,message:text(b.message,1500)||null,source:text(b.source,150)||'Website',marketing_opt_in:b.marketingOptIn===true};
 const {data,error}=await base().from('livance_enquiries').insert(row).select('id').single();if(error)throw fail(503,error.message);
 // Best-effort notifications; a lead is saved even if the email provider is unavailable.
 if(configuredMail()&&process.env.NOTIFY_EMAIL){deliver(process.env.NOTIFY_EMAIL,'New Livance enquiry: '+row.name,`New enquiry received.\n\nName: ${row.name}\nEmail: ${row.email}\nPhone: ${row.phone}\nSolution: ${row.solution||'—'}\nCentre: ${row.centre||'—'}\nMessage: ${row.message||'—'}`,'lead').catch(e=>console.error('Lead email failed:',e.message))}
 res.status(201).json({ok:true,id:data.id});
}));
router.get('/admin/enquiries',run(async(req,res)=>{const a=await asAdmin(req);const {data,error}=await a.client.from('livance_enquiries').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw fail(503,error.message);res.json(data)}));
router.post('/booking-requests',run(async(req,res)=>{
 basicLimit(req,18);const a=await identity(req),b=req.body||{};
 const kind=text(b.kind,40);if(!['meeting_room','day_pass','virtual_office','credits'].includes(kind))throw fail(400,'Invalid booking type');
 const p=b.params&&typeof b.params==='object'&&!Array.isArray(b.params)?b.params:{};
 const date=text(p.date,10),start=Number(p.start),end=start+Number(p.hours);
 if(kind==='meeting_room'&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!(start>=9&&end<=19&&start<end)||!text(p.roomId,80)))throw fail(400,'Select a valid date, room and timeslot');
 if(kind==='day_pass'&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(Number(p.qty))||Number(p.qty)<1||Number(p.qty)>5))throw fail(400,'Select a valid day pass date and quantity');
 if(['meeting_room','day_pass'].includes(kind)&&date<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}))throw fail(400,'The selected date is in the past');
 const row={user_id:a.user.id,member_email:a.user.email,kind,centre:text(b.centre||p.centre,80)||null,room_id:kind==='meeting_room'?text(p.roomId,80):null,booking_date:date||null,start_hour:kind==='meeting_room'?start:null,end_hour:kind==='meeting_room'?end:null,quantity:kind==='day_pass'?Number(p.qty):null,business:text(b.business,180)||null,requested_total_paise:Math.max(0,Math.min(1000000000,Math.round(Number(b.total)||0))),parameters:p,billing:typeof b.billing==='object'&&b.billing?b.billing:{},status:'requested'};
 const {data,error}=await a.client.from('livance_booking_requests').insert(row).select('id,status,created_at').single();if(error)throw fail(503,error.message);
 if(configuredMail()&&process.env.NOTIFY_EMAIL){deliver(process.env.NOTIFY_EMAIL,'New Livance booking request',`A new ${kind} booking request was submitted.\nReference: ${data.id}\nMember: ${a.user.email}\nCentre: ${row.centre||'—'}\nDate: ${date||'—'}\nRequested amount: ₹${(row.requested_total_paise/100).toFixed(2)}\nStatus: Awaiting manual confirmation. No payment was taken.`,'booking').catch(e=>console.error('Booking email failed:',e.message))}
 res.status(201).json({ok:true,...data});
}));
router.get('/my/booking-requests',run(async(req,res)=>{const a=await identity(req);const {data,error}=await a.client.from('livance_booking_requests').select('*').eq('user_id',a.user.id).order('created_at',{ascending:false}).limit(100);if(error)throw fail(503,error.message);res.json(data)}));
router.get('/admin/booking-requests',run(async(req,res)=>{const a=await asAdmin(req);const {data,error}=await a.client.from('livance_booking_requests').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw fail(503,error.message);res.json(data)}));
router.patch('/admin/booking-requests/:id',run(async(req,res)=>{const a=await asAdmin(req);const status=text(req.body?.status,30);if(!['requested','confirmed','rejected','cancelled'].includes(status))throw fail(400,'Invalid status');const {data,error}=await a.client.from('livance_booking_requests').update({status,updated_at:new Date().toISOString()}).eq('id',req.params.id).select('id,status,member_email,kind,booking_date').single();if(error){if(error.code==='23P01')throw fail(409,'Another confirmed booking already occupies that room and time');throw fail(503,error.message)}
 if(configuredMail()&&data.member_email&&['confirmed','rejected','cancelled'].includes(status)){
   deliver(data.member_email,'Livance booking '+status,`Your ${data.kind.replaceAll('_',' ')} booking request ${data.id} is now ${status}.\nDate: ${data.booking_date||'See your dashboard'}\n\nThis is a booking status update, not a payment receipt.`,'booking').catch(e=>console.error('Booking status email failed:',e.message));
 }
 res.json({id:data.id,status:data.status})}));
router.post('/admin/email',run(async(req,res)=>{
 basicLimit(req,100,3600000);const a=await asAdmin(req),b=req.body||{};const to=email(b.to),subject=text(b.subject,240),body=text(b.body,9000);
 if(!subject||!body)throw fail(400,'Subject and body required');
 const {data:log,error:le}=await a.client.from('livance_email_logs').insert({event_key:randomUUID(),recipient:to,subject,kind:text(b.kind,50)||'crm',status:'pending'}).select('id').single();if(le)throw fail(503,le.message);
 try{const id=await deliver(to,subject,body,b.kind);await a.client.from('livance_email_logs').update({status:'sent',provider_id:id}).eq('id',log.id);res.json({ok:true,id})}
 catch(e){await a.client.from('livance_email_logs').update({status:'failed',error:e.message}).eq('id',log.id);throw e}
}));
router.post('/admin/bulk-email',run(async(req,res)=>{
 basicLimit(req,10,3600000);const a=await asAdmin(req),jobs=req.body?.jobs;
 if(!Array.isArray(jobs)||jobs.length<1||jobs.length>20)throw fail(400,'Send between 1 and 20 emails at a time');
 if(!configuredMail())throw fail(503,'Configure RESEND_API_KEY and EMAIL_FROM');
 const {data:consented,error:e}=await a.client.from('livance_enquiries').select('email').eq('marketing_opt_in',true).in('email',jobs.map(x=>email(x.to)));
 if(e)throw fail(503,e.message);
 const allow=new Set(consented.map(x=>x.email.toLowerCase()));const {data:blocked,error:be}=await a.client.from('livance_suppressions').select('email');if(be)throw fail(503,be.message);
 const suppressed=new Set(blocked.map(x=>x.email.toLowerCase()));const results=[];
 for(const item of jobs){const to=email(item.to);if(!allow.has(to)||suppressed.has(to)){results.push({to,status:'skipped',error:'No marketing opt-in or unsubscribed'});continue;}
  try{const baseUrl=process.env.PUBLIC_SITE_URL||'';const newToken=randomUUID();const {error:te}=await a.client.from('livance_unsubscribe_tokens').insert({token:newToken,email:to});if(te)throw fail(503,te.message);const unsubscribe=baseUrl?`${baseUrl.replace(/\/$/,'')}/api/v2/unsubscribe?token=${newToken}`:null;const id=await deliver(to,item.subject,item.body,'marketing',{unsubscribe});const {error:le}=await a.client.from('livance_email_logs').insert({event_key:randomUUID(),recipient:to,subject:text(item.subject,240),kind:'marketing',status:'sent',provider_id:id});if(le)console.error('Email log:',le.message);results.push({to,status:'sent',id})}catch(e){results.push({to,status:'failed',error:e.message})}
 }
 res.json({results});
}));
router.get('/unsubscribe',run(async(req,res)=>{const uuid=text(req.query.token,80);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid))throw fail(403,'Invalid unsubscribe link');const {data,error}=await base().rpc('livance_unsubscribe',{p_token:uuid});if(error)throw fail(503,error.message);if(!data)throw fail(403,'The unsubscribe link has expired');res.type('html').send('<!doctype html><title>Unsubscribed — Livance</title><main style="font:18px Arial;max-width:500px;margin:12vh auto"><h1>You are unsubscribed.</h1><p>You will not receive further Livance marketing emails.</p></main>')}));
// Error handler local to the live API (never expose secrets/stacktraces).
router.use((err,_req,res,_next)=>{console.error('[live]',err.message);res.status(err.status||500).json({error:err.status?err.message:'An unexpected server error occurred'})});
export default router;
