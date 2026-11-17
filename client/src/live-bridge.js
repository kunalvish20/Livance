import {supabase,configured} from './supabase.js';
let version=0;
let lastError='';
const errString=e=>e?.message||'Unknown error';
async function request(path,{method='GET',body,authenticated=false}={}){
 const {data:{session}}=await supabase.auth.getSession();
 if(authenticated&&!session?.access_token)throw Error('Please sign in first.');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 let response;
 try{response=await fetch('/api/v2'+path,{method,signal:controller.signal,headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})}
 catch(error){if(error.name==='AbortError')throw Error('The server took too long. Please try again.');throw error}
 finally{clearTimeout(timer)}
 const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data?.error||`Request failed (${response.status})`);return data;
}
async function currentIdentity(){const {data:{session}}=await supabase.auth.getSession();return session?.access_token?await request('/session',{authenticated:true}):null;}
function numericId(uuid){return 10000000000+Number.parseInt(String(uuid).replace(/-/g,'').slice(0,12),16)}
function convertLead(x){return {id:numericId(x.id),external_id:x.id,name:x.name,email:x.email,phone:x.phone,company:x.company,solution:x.solution,voPlan:x.vo_plan,seats:x.seats,centre:x.centre,message:x.message,source:x.source,kind:'new',stage:'new',ownerId:null,createdAt:Date.parse(x.created_at),updatedAt:Date.parse(x.created_at),lastActivityAt:Date.parse(x.created_at),tags:[],unsub:!x.marketing_opt_in,marketingOptIn:x.marketing_opt_in,utm:{}}}
function convertBooking(b){const params=b.parameters||{};return {id:numericId(b.id),external_id:b.id,orderId:null,userId:numericId(b.user_id),kind:b.kind,centre:b.centre,roomId:b.room_id&&/^\d+$/.test(b.room_id)?Number(b.room_id):b.room_id,date:b.booking_date,start:b.start_hour,end:b.end_hour,qty:b.quantity,status:b.status==='requested'?'pending':b.status,params,total:b.requested_total_paise,requested:true,createdAt:Date.parse(b.created_at)}}
function withoutDemoRecords(seed){const clean=structuredClone(seed);
 // Original source contains SAMPLE people, invoices, payments and staff. Never migrate them to production as real records.
 for(const t of ['coupons','users','bookings','orders','invoices','vos','leads','reservations','deskClients','acts','rems','props','camps','outbox','mails','tickets','tmsgs','ledger'])if(Array.isArray(clean[t]))clean[t]=[];
 clean.session=null; clean.zoho={orgId:'',taxIntra:'',taxInter:'',account:'',mode:'Bank Transfer'};
 // Seeding catalogue, articles, document templates and display settings is intentional.
 return clean;
}
const reportError=(error)=>{lastError=errString(error);window.dispatchEvent(new CustomEvent('livance-live-error',{detail:lastError}));return lastError};
const bridge={
 enabled:configured,
 get lastError(){return lastError},
 numericId,
 async bootstrap(seed){
  if(!configured)return {data:seed,identity:null,version:0};
  let identity=null;try{identity=await currentIdentity()}catch(e){reportError(e);throw e}
  const admin=identity?.role==='admin';
  const [snap,leadsResult,bookingsResult]=await Promise.all([
   request(admin?'/admin/state':'/public-state',{authenticated:admin}),
   admin?request('/admin/enquiries',{authenticated:true}).then(data=>({data})).catch(error=>({data:[],error})):Promise.resolve({data:[]}),
   identity?request(admin?'/admin/booking-requests':'/my/booking-requests',{authenticated:true}).then(data=>({data})).catch(error=>({data:[],error})):Promise.resolve({data:[]})
  ]);
  if(leadsResult.error)reportError(leadsResult.error);
  if(bookingsResult.error)reportError(bookingsResult.error);
  const leads=leadsResult.data,bookings=bookingsResult.data;
  version=Number(snap.version)||0;
  let data=admin?(snap.data||withoutDemoRecords(seed)):{...withoutDemoRecords(seed),...(snap.data||{})};
  // Admin records are merged by server UUID, so page reloads do not duplicate them.
  if(admin){let seen=new Set((data.leads||[]).map(x=>x.external_id));for(const row of leads){if(!seen.has(row.id))data.leads.push(convertLead(row))}seen=new Set((data.bookings||[]).map(x=>x.external_id));for(const row of bookings){if(!seen.has(row.id))data.bookings.push(convertBooking(row))}}
  if(!admin){data.bookings=bookings.map(convertBooking);data.orders=[];data.leads=[];data.users=[];data.invoices=[];data.mails=[];data.tickets=[];data.props=[];data.acts=[];data.rems=[];data.camps=[];data.outbox=[];data.vos=[];data.ledger=[];}
  // Initial setup: only a legitimately authenticated administrator can initialize the state.
  if(admin&&!snap.data){try{const saved=await request('/admin/state',{method:'PUT',authenticated:true,body:{version:0,data}});version=saved.version}catch(error){if(!/another session|already exists/i.test(error.message))throw error;const latest=await request('/admin/state',{authenticated:true});version=latest.version;data=latest.data||data}}
  return {data,identity,version};
 },
 async signIn(email,password){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw Error(error.message);return await currentIdentity()},
 async signUp({name,email,phone,password}){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name,phone}}});if(error)throw Error(error.message);return {needsVerification:!data.session,identity:data.session?await currentIdentity():null}},
 async signOut(){const {error}=await supabase.auth.signOut();if(error)throw Error(error.message);version=0},
 async persist(data){if(!configured)return;const result=await request('/admin/state',{method:'PUT',authenticated:true,body:{version,data}});version=result.version;return version},
 submitLead:d=>request('/enquiries',{method:'POST',body:d}),
 submitBooking:d=>request('/booking-requests',{method:'POST',body:d,authenticated:true}),
 sendEmail:d=>request('/admin/email',{method:'POST',body:d,authenticated:true}),
 bulkEmail:jobs=>request('/admin/bulk-email',{method:'POST',body:{jobs},authenticated:true}),
 async updateBooking(externalId,status){return request(`/admin/booking-requests/${encodeURIComponent(externalId)}`,{method:'PATCH',body:{status:status==='pending'?'requested':status},authenticated:true})}
};
export default bridge;
