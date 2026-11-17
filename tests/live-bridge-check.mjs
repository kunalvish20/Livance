import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('client/src/live-bridge.js', 'utf8')
  .replace("import {supabase,configured} from './supabase.js';", 'const {supabase,configured} = globalThis.bridgeTest;')
  .replace('export default bridge;', 'globalThis.bridge = bridge;');

async function bootstrapWith(role, failures = []) {
  const events = [];
  const user = role && {id:'00000000-0000-0000-0000-000000000001',email:'test@example.com',name:'Test User',role};
  const context = {
    bridgeTest:{configured:true,supabase:{auth:{getSession:async()=>({data:{session:user?{access_token:'test-token'}:null}})}}},
    fetch:async(url)=>{
      const path = url.replace('/api/v2','');
      if (failures.includes(path)) return {ok:false,status:503,json:async()=>({error:'Temporarily unavailable'})};
      if (path==='/session') return {ok:true,json:async()=>user};
      if (path==='/public-state' || path==='/admin/state') return {ok:true,json:async()=>({version:1,data:{users:[],leads:[],bookings:[]}})};
      return {ok:true,json:async()=>[]};
    },
    window:{dispatchEvent:event=>events.push(event.detail)},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail}},
    AbortController,setTimeout,clearTimeout,structuredClone,Set,Number,Date,Error
  };
  vm.runInNewContext(source,context,{filename:'live-bridge.js'});
  const result = await context.bridge.bootstrap({users:[],leads:[],bookings:[]});
  return {result,events};
}

const member = await bootstrapWith('member',['/my/booking-requests']);
assert.equal(member.result.identity.role,'member');
assert.equal(member.result.data.bookings.length,0);
assert.equal(member.events.length,1);

const admin = await bootstrapWith('admin',['/admin/enquiries','/admin/booking-requests']);
assert.equal(admin.result.identity.role,'admin');
assert.equal(admin.result.data.leads.length,0);
assert.equal(admin.events.length,2);

console.log('✓ Dashboard opens when optional live requests fail');
