import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const names=['livance-public.html','livance-admin.html'];
const original={'livance-public.html':'original-public-demo.html','livance-admin.html':'original-admin-demo.html'};
for(const n of names){
 const html=fs.readFileSync('client/public/reference/'+n,'utf8');
 assert.match(html,/<style>/);assert.match(html,/LIVANCE_IMG/);assert.match(html,/LIVANCE_MD/);
 const baseline=fs.readFileSync('reference/'+original[n],'utf8');
 assert.equal(html.match(/<style>([\s\S]*?)<\/style>/)?.[1],baseline.match(/<style>([\s\S]*?)<\/style>/)?.[1], 'Original CSS changed');
 assert.match(html,/BRIDGE\.submitLead/);assert.match(html,/BRIDGE\.sendEmail/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>=3);
 for(const [i,match] of scripts.entries()){new vm.Script(match[1],{filename:n+'#script'+i});}
 console.log('✓ Exact UI and embedded scripts parse:',n);
}
const sql=fs.readFileSync('sql/003_live_bridge.sql','utf8');
assert.match(sql,/enable row level security/gi);
assert.match(sql,/livance_state_admin/);assert.match(sql,/livance_booking_read/);
const backend=fs.readFileSync('server/live.js','utf8');
assert.match(backend,/getUser\(access\)/);assert.match(backend,/RESEND_API_KEY/);assert.match(backend,/eq\('version',expected\)/);
assert.ok(!fs.readFileSync('client/src/live-bridge.js','utf8').includes('SERVICE_ROLE_KEY'));
console.log('✓ Auth, state revision guard, mail provider and RLS contract present');
