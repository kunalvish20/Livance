import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL||'https://placeholder.supabase.co';
const anon=import.meta.env.VITE_SUPABASE_ANON_KEY||'placeholder';
export const supabase=createClient(url,anon);
export const configured=!!(import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY);
export async function api(path,{method='GET',body,token}={}){const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=r.status===204?null:await r.json();if(!r.ok)throw Error(data?.error||'Request failed');return data}
