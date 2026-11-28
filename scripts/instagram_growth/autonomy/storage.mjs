/** Existing Hobby store only. No Instagram token or repository-write credential. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {getVercelOidcToken} from '@vercel/oidc';
import {put,head,list,get,del} from '@vercel/blob';
import {gunzipSync} from 'node:zlib';

const TEAM='team_cilwkczruho74HBIaE1IlQIt',PROJECT='prj_Swcosa9UBmQBNDvJXFLIbTkHF7u6';
const STORE='store_kvEENsOeMZ2J3t8D',HOST='kveensoemz2j3t8d.public.blob.vercel-storage.com';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stable=x=>JSON.stringify(x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable(x[k]))])):Array.isArray(x)?x.map(v=>JSON.parse(stable(v))):x);
const publicKey=await fs.readFile(new URL('./public-key.pem',import.meta.url));
const config=JSON.parse(await fs.readFile(process.env.ABP_AUTO_CONFIG,'utf8'));
function api(route){return JSON.parse(execFileSync(config.vercel_cli,['api',route,'--method','GET'],{stdio:['ignore','pipe','pipe'],timeout:45000}).toString());}
function authenticated(value,payload){
 const {auto_signature,...body}=value;const bytes=payload===undefined?stable(body):payload;
 if(typeof bytes!=='string'||stable(JSON.parse(bytes))!==stable(body))throw Error('Signed payload differs from manifest');
 if(!crypto.verify(null,Buffer.from(bytes),publicKey,Buffer.from(auto_signature||'','base64')))throw Error('Untrusted admission signature');return value;
}
async function quota(){
 const raw=api(`/v2/teams/${TEAM}`),team=raw.team??raw;
 const data=api(`/storage/stores/${STORE}?teamId=${TEAM}`),store=data.store??data;
 if(team.id!==TEAM||team.billing?.plan!=='hobby'||team.billing?.status!=='active')throw Error('Only verified active Hobby with provider hard no-overage limits is authorized');
 if(store.id!==STORE||store.ownerId!==TEAM||store.access!=='public'||store.status!=='available'||store.usageQuotaExceeded!==false)throw Error('Store identity/status/quota failure');
 if(!Number.isFinite(store.size)||store.size>=750*1024*1024)throw Error('Storage circuit breaker:750MiB shared-store ceiling');
 return {checked_at:new Date().toISOString(),team:TEAM,store:STORE,plan:'hobby',status:'active',size_bytes:store.size,objects:store.count,usage_quota_exceeded:false,
   transfer_usage:'Unavailable from Hobby billing API; not zero. Provider hard free limit applies.',cost_bound:'Hobby has no paid overage; never upgrade automatically.'};
}
const usageFile=path.join(config.root,`usage-${new Date().toISOString().slice(0,7)}.json`);
async function saveUsage(usage){
 const pending=usageFile+'.tmp';await fs.writeFile(pending,JSON.stringify(usage),{mode:0o600});await fs.rename(pending,usageFile);
}
async function reserve(bytes,operations=12){
 let usage={bytes_reserved:0,operations_reserved:0};try{usage=JSON.parse(await fs.readFile(usageFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!Number.isSafeInteger(usage.bytes_reserved)||usage.bytes_reserved<0||!Number.isSafeInteger(usage.operations_reserved)||usage.operations_reserved<0)throw Error('Invalid durable usage ledger');
 // Conservative allowance for HEAD, immutable writes and public verification;
 // not a claim of measured provider billing or transfer usage.
 if(usage.bytes_reserved+bytes>256*1024*1024||usage.operations_reserved+operations>900)throw Error('Monthly autonomous allowance circuit breaker');
 usage.bytes_reserved+=bytes;usage.operations_reserved+=operations;await fs.mkdir(config.root,{recursive:true,mode:0o700});
 await saveUsage(usage);return usage;
}
// These are evidence/index operations only. Original MP4s and envelopes
// never enter del(); retirement of public media remains deliberately disabled.
const RAW='https://raw.githubusercontent.com/leonlinsx/avoid-boring-people/abp-instagram-state/';
async function boundedFetch(url,limit,headers){
 const response=await fetch(url,{redirect:'error',cache:'no-store',headers});
 if(!response.ok)throw Error('Retention evidence unavailable');
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('Retention download budget');chunks.push(chunk);}
 return Buffer.concat(chunks);
}
function archiveRef(ref){
 if(!ref||Object.keys(ref).sort().join(',')!=='path,sha256'||!/^[a-f0-9]{64}$/.test(ref.sha256)||ref.path!==`instagram-archives/${ref.sha256}.json`)throw Error('Invalid archive reference');
}
async function archiveAcknowledgments(){
 const hot=JSON.parse((await boundedFetch('https://api.github.com/repos/leonlinsx/avoid-boring-people/contents/instagram-state.json?ref=abp-instagram-state',900000,
   {Accept:'application/vnd.github.raw+json','Cache-Control':'no-cache'})).toString());
 if(hot.account!=='avoidboringpeople'||!hot.receipts||typeof hot.receipts!=='object')throw Error('Wrong retention ledger');
 let ref=hot.archive_head;const pages=[],seen=new Set();let size=0;const start=Date.now();
 while(ref){
  archiveRef(ref);if(seen.has(ref.sha256)||Date.now()-start>90000)throw Error('Archive recovery circuit');seen.add(ref.sha256);
  const bytes=await boundedFetch(RAW+ref.path,500000);size+=bytes.length;
  if(size>64000000||sha(bytes)!==ref.sha256)throw Error('Archive hash/budget mismatch');
  const wrapper=JSON.parse(bytes);
  if(wrapper.format!=='abp_evidence_archive_v1')throw Error('Wrong archive format');
  const payload=gunzipSync(Buffer.from(wrapper.payload_gzip_base64,'base64'),{maxOutputLength:8000000});
  size+=payload.length;if(size>64000000)throw Error('Archive restored byte budget');
  if(sha(payload)!==wrapper.content_sha256)throw Error('Archive content hash mismatch');
  const page=JSON.parse(payload);
  if(page.format!=='abp_evidence_archive_v1'||page.account!=='avoidboringpeople')throw Error('Wrong archive identity');
  pages.push(page);ref=page.previous;
 }
 const cold={},receipts={},observations={},gaps={};
 for(const page of pages.reverse()){
  for(const [id,row]of Object.entries(page.tables.auto_inventory)){
   const m=JSON.parse(row.manifest_json),payload=row.manifest_json.replace(`"auto_signature":${JSON.stringify(m.auto_signature)},`,'');
   authenticated(m,payload);
   if(m.account!=='avoidboringpeople'||m.review_status!=='AUTO_ADMITTED'||m.concept_id!==id||sha(Buffer.from(row.manifest_json))!==row.envelope_sha256)throw Error('Archived envelope mismatch');
   if(cold[id]&&cold[id].envelope_sha256!==row.envelope_sha256)throw Error('Archived immutable concept changed');
   cold[id]={...row,manifest:m};
  }
  Object.assign(receipts,page.tables.receipts);Object.assign(observations,page.tables.observations);Object.assign(gaps,page.tables.measurement_gaps);
 }
 Object.assign(receipts,hot.receipts);Object.assign(observations,hot.observations);Object.assign(gaps,hot.measurement_gaps);
 const retired=new Map();
 for(const [id,row]of Object.entries(cold)){
  const receipt=receipts[id],m=row.manifest;
  if(hot.auto_inventory?.[id]&&hot.auto_inventory[id].envelope_sha256!==row.envelope_sha256)throw Error('Immutable archived concept changed');
  if(!receipt||receipt.status!=='published'||receipt.sha256!==m.video_sha256||!receipt.media_id||receipt.verified_media?.username!=='avoidboringpeople'||String(receipt.verified_media.id)!==String(receipt.media_id))continue;
  const age=Date.now()-Date.parse(receipt.published_at);
  const terminal=w=>{
   const obs=observations[id+'-'+w],gap=gaps[id+'-'+w];
   return !!(obs&&obs.concept_id===id&&obs.window===w&&obs.metrics&&typeof obs.metrics==='object'
    ||gap&&gap.concept_id===id&&gap.window===w&&gap.reason==='age_window_missed');
  };
  if(!Number.isFinite(age)||age<14*86400000||!['24h','48h','7d'].every(terminal))continue;
  retired.set(row.envelope_sha256,id);
 }
 return {retired,archive_head:hot.archive_head??null};
}
function entry(value){
 if(!value||Object.keys(value).sort().join(',')!=='concept_id,sha256,url'||!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(value.concept_id)||!/^[a-f0-9]{64}$/.test(value.sha256)||value.url!==`https://${HOST}/instagram/reels/auto/manifests/${value.sha256}.json`)throw Error('Invalid immutable entry');
 return value;
}
if(process.argv[2]==='quota'){console.log(JSON.stringify(await quota()));process.exit(0);}
if(process.argv[2]!=='upload')throw Error('Expected quota or upload');
const input=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
if(typeof input.signing_payload!=='string'||typeof input.manifest_json!=='string')throw Error('Exact Python canonical envelope bytes required');
const m=authenticated(input.manifest,input.signing_payload);
const encoded=Buffer.from(input.manifest_json);
if(stable(JSON.parse(encoded))!==stable(m))throw Error('Canonical envelope differs from admitted manifest');
if(m.review_status!=='AUTO_ADMITTED'||m.account!=='avoidboringpeople'||m.trial!==false||m.artifact_type!=='abp_auto_manifest_v1')throw Error('Wrong automatic admission contract');
const data=await fs.readFile(input.local_video);if(data.length>10*1024*1024||sha(data)!==m.video_sha256)throw Error('Media bytes changed');
const pathname=`instagram/reels/auto/${m.concept_id}/${m.video_sha256}.mp4`;
if(m.video_url!==`https://${HOST}/${pathname}`)throw Error('Unexpected public destination');
const quotaEvidence=await quota();
if(quotaEvidence.size_bytes+data.length+2*encoded.length+514000>750*1024*1024)throw Error('Insufficient reserved storage including metadata');
const oidcToken=await getVercelOidcToken({project:PROJECT,team:TEAM});const auth={storeId:STORE,oidcToken};
const acknowledged=await archiveAcknowledgments();
let existing;try{existing=await head(m.video_url,auth);}catch(error){if(error.constructor?.name!=='BlobNotFoundError')throw error;}
let usage=await reserve((existing?0:data.length)+2*encoded.length,16);
if(!existing)await put(pathname,data,{...auth,access:'public',contentType:'video/mp4',addRandomSuffix:false,allowOverwrite:false});
const remote=await fetch(m.video_url,{redirect:'error',cache:'no-store'});if(!remote.ok||sha(Buffer.from(await remote.arrayBuffer()))!==m.video_sha256)throw Error('Public video hash mismatch');
// Keep Python's exact number representation (0.0, not JS's 0) so the
// independent Python consumer can reconstruct the original signed bytes.
const manifestHash=sha(encoded),manifestPath=`instagram/reels/auto/manifests/${manifestHash}.json`;
const manifestUrl=`https://${HOST}/${manifestPath}`;const verified=await fetch(manifestUrl,{redirect:'error',cache:'no-store'});
if(verified.status===404){await put(manifestPath,encoded,{...auth,access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});}
else if(!verified.ok||sha(Buffer.from(await verified.arrayBuffer()))!==manifestHash)throw Error('Existing public manifest hash mismatch');
const confirmation=await fetch(manifestUrl+'?v='+Date.now(),{redirect:'error',cache:'no-store'});
if(!confirmation.ok||sha(Buffer.from(await confirmation.arrayBuffer()))!==manifestHash)throw Error('Public manifest hash mismatch');
const feedUrl=`https://${HOST}/instagram/reels/auto/feed.json`;
async function origin(url,limit){
 const value=await get(url,{...auth,access:'public',useCache:false});
 if(!value)return null;
 if(value.statusCode!==200||!value.blob.etag||value.blob.size>limit)throw Error('Invalid origin evidence');
 const chunks=[];let size=0;
 for await(const chunk of value.stream){size+=chunk.length;if(size>limit)throw Error('Origin byte budget');chunks.push(chunk);}
 return {bytes:Buffer.concat(chunks),etag:value.blob.etag};
}
// Freeze the pre-retention legacy registry exactly once. It remains immutable
// and bounded; future recovery never scans the lifetime envelope namespace.
const bootstrapUrl=`https://${HOST}/instagram/reels/auto/registry-bootstrap-v1.json`;
let bootstrap=await origin(bootstrapUrl,64000);
const keyPath=process.env.CREDENTIALS_DIRECTORY?path.join(process.env.CREDENTIALS_DIRECTORY,'auto-admission-key'):config.signing_key;
const key=crypto.createPrivateKey(await fs.readFile(keyPath));
function signed(body){return {...body,auto_signature:crypto.sign(null,Buffer.from(stable(body)),key).toString('base64')};}
if(!bootstrap){
 usage=await reserve(0,1);
 const registry=await list({...auth,prefix:'instagram/reels/auto/manifests/',limit:65});
 if(registry.hasMore||registry.blobs.length>64)throw Error('Legacy bootstrap registry circuit');
 usage=await reserve(0,registry.blobs.length+1);
 const items=[];
 for(const blob of registry.blobs){
  const match=/^instagram\/reels\/auto\/manifests\/([a-f0-9]{64})\.json$/.exec(blob.pathname);
  if(!match||blob.url!==`https://${HOST}/${blob.pathname}`||blob.size>64000)throw Error('Unexpected legacy registry entry');
  const bytes=await boundedFetch(blob.url,64000);
  if(sha(bytes)!==match[1])throw Error('Legacy envelope hash mismatch');
  const text=bytes.toString(),m=JSON.parse(text);authenticated(m,text.replace(`"auto_signature":${JSON.stringify(m.auto_signature)},`,''));
  if(m.account!=='avoidboringpeople'||m.review_status!=='AUTO_ADMITTED'||m.artifact_type!=='abp_auto_manifest_v1'||m.trial!==false)throw Error('Wrong legacy contract');
  if(items.some(x=>x.concept_id===m.concept_id))throw Error('Duplicate legacy concept');
  items.push(entry({concept_id:m.concept_id,url:blob.url,sha256:match[1]}));
 }
 const value=signed({artifact_type:'abp_registry_bootstrap_v1',account:'avoidboringpeople',items});
 usage=await reserve(Buffer.byteLength(stable(value)),0);
 await put('instagram/reels/auto/registry-bootstrap-v1.json',stable(value),{...auth,access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
 bootstrap=await origin(bootstrapUrl,64000);
 if(!bootstrap||!bootstrap.bytes.equals(Buffer.from(stable(value))))throw Error('Bootstrap readback mismatch');
}
const legacy=authenticated(JSON.parse(bootstrap.bytes));
if(legacy.artifact_type!=='abp_registry_bootstrap_v1'||legacy.account!=='avoidboringpeople'||!Array.isArray(legacy.items)||legacy.items.length>64)throw Error('Wrong immutable registry');
const current=await origin(feedUrl,450000);
const old=current?authenticated(JSON.parse(current.bytes)):null,etag=current?.etag;
if(old&&(old.artifact_type!=='abp_auto_feed_v1'||old.account!=='avoidboringpeople'||!Array.isArray(old.items)||old.items.length>64))throw Error('Wrong feed identity');
const known=new Map();
for(const x of [...legacy.items,...(old?.items??[])]){
 entry(x);const prior=known.get(x.concept_id);
 if(prior&&prior.sha256!==x.sha256)throw Error('Immutable concept changed');known.set(x.concept_id,x);
}
const hashKnown=new Map([...known.values()].map(x=>[x.sha256,x]));
hashKnown.set(manifestHash,{concept_id:m.concept_id,url:manifestUrl,sha256:manifestHash});
// Pending copies protect crashes between immutable upload and feed CAS. Only
// these disposable copies can be removed, after independent cold restoration.
const pending=await list({...auth,prefix:'instagram/reels/auto/pending/',limit:65});
if(pending.hasMore)throw Error('Pending recovery budget');
const cleanup=[];
for(const blob of pending.blobs){
 const match=/^instagram\/reels\/auto\/pending\/([a-f0-9]{64})\.json$/.exec(blob.pathname);
 if(!match||blob.url!==`https://${HOST}/${blob.pathname}`||blob.size>64000)throw Error('Unexpected pending entry');
 const digest=match[1];
 if(acknowledged.retired.has(digest)){cleanup.push(blob.url);continue;}
 let x=hashKnown.get(digest);
 if(!x){
  usage=await reserve(0,1);const bytes=await boundedFetch(blob.url,64000);
  if(sha(bytes)!==digest)throw Error('Pending envelope hash mismatch');
  const text=bytes.toString(),v=JSON.parse(text);authenticated(v,text.replace(`"auto_signature":${JSON.stringify(v.auto_signature)},`,''));
  if(v.account!=='avoidboringpeople'||v.review_status!=='AUTO_ADMITTED'||v.artifact_type!=='abp_auto_manifest_v1'||v.trial!==false)throw Error('Wrong pending contract');
  x=entry({concept_id:v.concept_id,url:`https://${HOST}/instagram/reels/auto/manifests/${digest}.json`,sha256:digest});
 }
 const prior=known.get(x.concept_id);if(prior&&prior.sha256!==x.sha256)throw Error('Immutable pending concept changed');known.set(x.concept_id,x);
}
const prior=known.get(m.concept_id);
if(prior&&prior.sha256!==manifestHash)throw Error('Cannot replace an immutable concept envelope');
known.set(m.concept_id,{concept_id:m.concept_id,url:manifestUrl,sha256:manifestHash});
let entries=[...known.values()].filter(x=>acknowledged.retired.get(x.sha256)!==x.concept_id);
// Preserve one signed heartbeat anchor even when the whole queue is archived.
if(!entries.length)entries=[{concept_id:m.concept_id,url:manifestUrl,sha256:manifestHash}];
if(entries.length>64)throw Error('Active feed circuit; queued/recent/unreconciled evidence cannot be evicted');
const pendingPath=`instagram/reels/auto/pending/${manifestHash}.json`;
if(!acknowledged.retired.has(manifestHash)){
 let saved=await origin(`https://${HOST}/${pendingPath}`,64000);
 if(saved&&!saved.bytes.equals(encoded))throw Error('Immutable pending bytes changed');
 if(!saved)await put(pendingPath,encoded,{...auth,access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
}
if(cleanup.length)usage=await reserve(0,cleanup.length);
const usageEvidence={bytes_reserved:usage.bytes_reserved,operations_reserved:usage.operations_reserved};
const body={artifact_type:'abp_auto_feed_v1',account:'avoidboringpeople',generated_at:new Date().toISOString(),items:entries,factory:input.factory,storage:quotaEvidence,usage:usageEvidence,retention:{format:'abp_active_feed_v1',archive_head:acknowledged.archive_head,retired_envelopes:acknowledged.retired.size,active_envelopes:entries.length,headroom:64-entries.length,media_retirement:'DISABLED'}};
const feed=signed(body);
const committed=await put('instagram/reels/auto/feed.json',stable(feed),{...auth,access:'public',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:60,...(etag?{ifMatch:etag}:{allowOverwrite:false})});
if(!committed.etag)throw Error('Feed write lacks committed ETag');
// Only archived duplicate pending-index copies are collectible. Never delete
// an immutable envelope, an archive, or any original MP4.
for(const url of cleanup)await del(url,auth);
await saveUsage({...usage,feed_snapshot:{etag:committed.etag,feed}});
console.log(JSON.stringify({status:'AUTO_HOSTED',concept_id:m.concept_id,video_url:m.video_url,manifest_url:manifestUrl,manifest_sha256:manifestHash,feed_url:feedUrl,reused:!!existing,storage:quotaEvidence,usage:usageEvidence}));
