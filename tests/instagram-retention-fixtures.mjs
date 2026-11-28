// Execute the real uploader across >100 source-verified, signed fixture admissions.
// Blob/Git network, quotas and process-death failures are simulated; no live I/O.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';

const fixture=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const sourceUrl=new URL('../scripts/instagram_growth/autonomy/storage.mjs',import.meta.url);
const source=await fs.readFile(sourceUrl,'utf8');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'abp-retention-fixture-'));
const key=crypto.createPrivateKey(await fs.readFile(fixture.private_key_path));
const pub=crypto.createPublicKey(key).export({type:'spki',format:'pem'});
const HOST='kveensoemz2j3t8d.public.blob.vercel-storage.com',base=`https://${HOST}/instagram/reels/auto/`;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const objects=new Map(),deleted=[];let writes=0,fault=null;
const config=path.join(root,'config.json'),input=path.join(root,'input.json'),video=path.join(root,'video.mp4');
await fs.writeFile(config,JSON.stringify({root,signing_key:fixture.private_key_path,vercel_cli:'fixture-only'}));
function response(data){return {status:data?200:404,ok:!!data,body:{async *[Symbol.asyncIterator](){if(data)yield data;}},arrayBuffer:async()=>data};}
async function execute(n,options={}){
 const a=fixture.admissions[options.admissionIndex??n],m=JSON.parse(a.manifest_json);const at=new Date(fixture.start).getTime()+n*3*86400000;
 class Clock extends Date {constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}}
 await fs.writeFile(video,Buffer.from(a.media_base64,'base64'));
 await fs.writeFile(input,JSON.stringify({manifest:m,manifest_json:a.manifest_json,signing_payload:a.signing_payload,local_video:video,factory:{status:'synthetic_fixture'}}));
 const lines=[];
 const context=vm.createContext({Buffer,URL,Date:Clock,console:{log:v=>lines.push(v)},
  process:{argv:['node','storage','upload',input],env:{ABP_AUTO_CONFIG:config}},
  fetch:async(url,opts)=>{
   assert.equal(opts.redirect,'error');const u=new URL(url);
   if(u.hostname==='api.github.com'){
    assert.equal(opts.headers.Accept,'application/vnd.github.raw+json');
    return response(Buffer.from(JSON.stringify(options.state??fixture.states[n])));
   }
   if(u.hostname==='raw.githubusercontent.com'){
    const name=u.pathname.split('/abp-instagram-state/')[1];const saved=fixture.archives[name];
    if(options.outage)return response(null);
    let bytes=saved?Buffer.from(saved,'base64'):null;
    if(options.corrupt&&bytes)bytes=Buffer.concat([bytes,Buffer.from('corrupted')]);
    return response(bytes);
   }
   assert.equal(u.hostname,HOST);u.search='';return response(objects.get(u.href)?.data);
  }});
 const modules={
  'node:fs/promises':{default:{...fs,
   readFile:async(p,...args)=>String(p).endsWith('/public-key.pem')?pub:fs.readFile(p,...args),
   rename:async(from,to)=>{
    if(fault==='checkpoint'&&JSON.parse(await fs.readFile(from,'utf8')).feed_snapshot){fault=null;throw Error('fixture death after feed CAS');}
    return fs.rename(from,to);
   }}},
  'node:path':{default:path},'node:crypto':{default:crypto},'node:zlib':{gunzipSync},
  'node:child_process':{execFileSync:(_cmd,args)=>Buffer.from(JSON.stringify(args[1].startsWith('/v2/teams/')
   ?{id:'team_cilwkczruho74HBIaE1IlQIt',billing:{plan:'hobby',status:'active'}}
   :{id:'store_kvEENsOeMZ2J3t8D',ownerId:'team_cilwkczruho74HBIaE1IlQIt',access:'public',status:'available',usageQuotaExceeded:false,
     size:[...objects.values()].reduce((n,row)=>n+row.data.length,0),count:objects.size}))},
  '@vercel/oidc':{getVercelOidcToken:async()=>'disposable-test-token'},
  '@vercel/blob':{
   head:async url=>{const row=objects.get(url);if(!row){const error=new Error();error.constructor={name:'BlobNotFoundError'};throw error;}return {etag:row.etag};},
   get:async(url,opts)=>{
    assert.equal(opts.useCache,false);const row=objects.get(url);
    return row?{statusCode:200,blob:{etag:row.etag,size:row.data.length},stream:{async *[Symbol.asyncIterator](){yield row.data;}}}:null;
   },
   list:async opts=>{
    assert.equal(opts.limit,65);
    const matches=[...objects].filter(([url])=>new URL(url).pathname.startsWith('/'+opts.prefix));
    return {hasMore:matches.length>65,blobs:matches.slice(0,65).map(([url,row])=>({url,pathname:new URL(url).pathname.slice(1),size:row.data.length}))};
   },
   put:async(name,bytes,opts)=>{
    const url=`https://${HOST}/${name}`,old=objects.get(url);
    if(fault==='cas'&&url===base+'feed.json'){fault=null;throw Error('fixture concurrent CAS');}
    if(opts.ifMatch)assert.equal(opts.ifMatch,old?.etag);
    if(old&&opts.allowOverwrite===false)throw Error('immutable overwrite');
    writes++;const etag='etag-'+writes;objects.set(url,{data:Buffer.from(bytes),etag});return {url,etag};
   },
   del:async url=>{
    assert.ok(url.startsWith(base+'pending/'),'Only disposable pending copies may be deleted');
    const hash=url.split('/').at(-1).replace('.json','');
    assert.ok(objects.has(base+'manifests/'+hash+'.json'),'Original signed envelope must survive collection');
    assert.ok(fixture.states[n].archive_head,'No collection before durable cold archive acknowledgment');
    deleted.push(url);objects.delete(url);
   },
  },
 };
 const module=new vm.SourceTextModule(source,{context,identifier:sourceUrl.href,initializeImportMeta:meta=>{meta.url=sourceUrl.href;}});
 await module.link(spec=>{
  const exports=modules[spec];assert.ok(exports,`unexpected import ${spec}`);
  return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context});
 });
 await module.evaluate();assert.equal(JSON.parse(lines[0]).status,'AUTO_HOSTED');
 const feed=JSON.parse(objects.get(base+'feed.json').data),{auto_signature,...body}=feed;
 const stable=v=>JSON.stringify(v,(_key,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 assert.ok(crypto.verify(null,Buffer.from(stable(body)),pub,Buffer.from(auto_signature,'base64')));
 assert.ok(feed.items.length<=64);assert.ok([...objects.keys()].filter(u=>u.includes('/pending/')).length<=64);
 assert.ok(feed.retention&&feed.retention.media_retirement==='DISABLED');
 return feed;
}

try{
 assert.ok(fixture.admissions.length>100);
 let maxFeed=0;
 for(let n=0;n<fixture.admissions.length;n++){
  if(n===40||n===55){fault=n===40?'cas':'checkpoint';await assert.rejects(execute(n));}
  if(n===80)objects.delete(base+'feed.json'); // fixture origin loss; recover from bounded pending + frozen legacy.
  const feed=await execute(n);maxFeed=Math.max(maxFeed,feed.items.length);
  if(n===60){
   const before=writes,count=deleted.length;
   await assert.rejects(execute(n,{corrupt:true}),/hash|archive/i);
   assert.equal(writes,before);assert.equal(deleted.length,count);
   await assert.rejects(execute(n,{outage:true}),/unavailable/i);
   assert.equal(writes,before);
   // A newer hot reconciliation hold overrides an older terminal archive.
   const prior=JSON.parse(fixture.admissions[10].manifest_json),bytes=Buffer.from(fixture.admissions[10].manifest_json),digest=sha(bytes);
   objects.set(base+'pending/'+digest+'.json',{data:bytes,etag:'held-pending'});
   const held=structuredClone(fixture.states[n]);held.receipts[prior.concept_id]={...fixture.states[10].receipts[prior.concept_id],status:'reconciliation_required'};
   const signedFeed=JSON.parse(objects.get(base+'feed.json').data);delete signedFeed.auto_signature;
   signedFeed.items.push({concept_id:prior.concept_id,url:base+'manifests/'+digest+'.json',sha256:digest});
   const stable=v=>JSON.stringify(v,(_key,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
   objects.set(base+'feed.json',{data:Buffer.from(stable({...signedFeed,auto_signature:crypto.sign(null,Buffer.from(stable(signedFeed)),key).toString('base64')})),etag:'held-feed'});
   const heldFeed=await execute(n,{state:held});
   maxFeed=Math.max(maxFeed,heldFeed.items.length);
   assert.ok(heldFeed.items.some(x=>x.concept_id===prior.concept_id));assert.ok(objects.has(base+'pending/'+digest+'.json'));
  }
  if(n===81){
   // Recover the exact original public bytes from the retained local artifact;
   // restored history still prevents re-enqueueing an already-published asset.
   const old=JSON.parse(fixture.admissions[10].manifest_json);objects.delete(old.video_url);
   const recovered=await execute(n,{admissionIndex:10});
   assert.equal(sha(objects.get(old.video_url).data),old.video_sha256);
   assert.ok(!recovered.items.some(x=>x.concept_id===old.concept_id));
  }
  if(n%20===0){const before=writes;await execute(n);assert.ok(writes-before<=1,'A double upload rewrites only the feed heartbeat');}
 }
 assert.ok(deleted.length>80,'Archived pending indices must actually rotate');
 assert.ok(maxFeed<64);
 assert.equal([...objects.keys()].filter(u=>u.includes('/manifests/')).length,fixture.admissions.length);
 assert.equal([...objects.keys()].filter(u=>u.endsWith('.mp4')).length,fixture.admissions.length);
 for(const a of fixture.admissions){
  const m=JSON.parse(a.manifest_json),encoded=Buffer.from(a.manifest_json);
  assert.equal(sha(objects.get(m.video_url).data),m.video_sha256);
  assert.ok(objects.get(base+'manifests/'+sha(encoded)+'.json').data.equals(encoded));
 }
 // A stalled publisher cannot be "solved" by eviction or by increasing 64.
 const collected=deleted.length;objects.clear();deleted.length=0;
 for(let n=0;n<64;n++)await execute(n,{state:{account:'avoidboringpeople',receipts:{}}});
 const retained=Buffer.from(objects.get(base+'feed.json').data);
 await assert.rejects(execute(64,{state:{account:'avoidboringpeople',receipts:{}}}),/Active feed circuit/);
 assert.ok(objects.get(base+'feed.json').data.equals(retained));assert.equal(deleted.length,0);
 console.log(`PASS: ${fixture.admissions.length} signed admissions; max active feed ${maxFeed}; ${collected} archive-proven pending copies rotated; all original media and envelopes retained; stalled publisher refused admission 65`);
}finally{await fs.rm(root,{recursive:true,force:true});}
