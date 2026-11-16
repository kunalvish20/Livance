// Vercel Node Function: keep the same Express routes in dev and production.
import app from '../server/index.js';
export default function handler(req,res){
  const url=new URL(req.url,'https://livance.invalid');
  const route=url.searchParams.get('__route');
  if(route){url.searchParams.delete('__route');req.url='/api/'+route+(url.search||'');}
  return app(req,res);
}
