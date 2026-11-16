import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import bridge from './live-bridge.js';
import './pixel-match.css';
// The original two HTML applications remain visually untouched. Only business actions
// are replaced with a secure Supabase/Auth/API adapter. They run in a same-origin iframe.
window.LIVANCE_BRIDGE=bridge;
const admin=window.location.pathname.startsWith('/admin');
const source=admin?'/reference/livance-admin.html':'/reference/livance-public.html';
function App(){const[error,setError]=useState('');const[notice,setNotice]=useState('');
 useEffect(()=>{document.title=admin?'Livance Admin Portal':'Livance — Flexible Workspaces';
 const fn=e=>{setNotice(e.detail);setTimeout(()=>setNotice(''),12000)};
 window.addEventListener('livance-live-error',fn);return()=>window.removeEventListener('livance-live-error',fn);
 },[]);
 return <main className="livance-preview">
  {!bridge.enabled&&<div className="live-banner" role="status">UI preview only — Add Supabase settings and run SQL 001 + 002 + 003 to enable real login, data and emails.</div>}
  {notice&&<div className="live-alert" role="alert">{notice}</div>}
  {error?<div className="livance-error">Unable to load the original Livance interface. {error}</div>:
  <iframe className="livance-frame" title={admin?'Livance admin':'Livance website'} src={source} onError={()=>setError('The reference HTML did not load.')} allow="clipboard-write"/>}
 </main>}
createRoot(document.getElementById('root')).render(<App/>);
