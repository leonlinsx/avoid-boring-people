/** Existing Hobby store only. No Instagram token or repository-write credential. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {getVercelOidcToken} from '@vercel/oidc';
import {put,head} from '@vercel/blob';

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
async function reserve(bytes){
 let usage={bytes_reserved:0,operations_reserved:0};try{usage=JSON.parse(await fs.readFile(usageFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!Number.isSafeInteger(usage.bytes_reserved)||usage.bytes_reserved<0||!Number.isSafeInteger(usage.operations_reserved)||usage.operations_reserved<0)throw Error('Invalid durable usage ledger');
 // Conservative allowance for HEAD, immutable writes and public verification;
 // not a claim of measured provider billing or transfer usage.
 if(usage.bytes_reserved+bytes>256*1024*1024||usage.operations_reserved+12>900)throw Error('Monthly autonomous allowance circuit breaker');
 usage.bytes_reserved+=bytes;usage.operations_reserved+=12;await fs.mkdir(config.root,{recursive:true,mode:0o700});
 const pending=usageFile+'.tmp';await fs.writeFile(pending,JSON.stringify(usage),{mode:0o600});await fs.rename(pending,usageFile);return usage;
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
if(quotaEvidence.size_bytes+data.length>750*1024*1024)throw Error('Insufficient reserved storage');
const oidcToken=await getVercelOidcToken({project:PROJECT,team:TEAM});const auth={storeId:STORE,oidcToken};
let existing;try{existing=await head(m.video_url,auth);}catch(error){if(error.constructor?.name!=='BlobNotFoundError')throw error;}
const usage=await reserve(existing?0:data.length);
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
const feedUrl=`https://${HOST}/instagram/reels/auto/feed.json`;let old,etag;
try{const info=await head(feedUrl,auth);etag=info.etag;const response=await fetch(feedUrl+'?v='+Date.now(),{redirect:'error',cache:'no-store'});if(!response.ok)throw Error('Existing feed unavailable');old=authenticated(await response.json());}catch(error){if(error.constructor?.name!=='BlobNotFoundError')throw error;}
const entries=(old?.items??[]).filter(x=>x.concept_id!==m.concept_id);
if(old&&(old.artifact_type!=='abp_auto_feed_v1'||old.account!=='avoidboringpeople'))throw Error('Wrong existing feed identity');
const previous=old?.items?.find(x=>x.concept_id===m.concept_id);
if(previous&&previous.sha256!==manifestHash)throw Error('Cannot replace an immutable concept envelope');
entries.push({concept_id:m.concept_id,url:manifestUrl,sha256:manifestHash});
if(entries.length>64)throw Error('Feed retention circuit breaker; no silent evidence eviction');
const body={artifact_type:'abp_auto_feed_v1',account:'avoidboringpeople',generated_at:new Date().toISOString(),items:entries,factory:input.factory,storage:quotaEvidence,usage};
const keyPath=process.env.CREDENTIALS_DIRECTORY?path.join(process.env.CREDENTIALS_DIRECTORY,'auto-admission-key'):config.signing_key;
const key=crypto.createPrivateKey(await fs.readFile(keyPath));const feed={...body,auto_signature:crypto.sign(null,Buffer.from(stable(body)),key).toString('base64')};
await put('instagram/reels/auto/feed.json',stable(feed),{...auth,access:'public',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:60,...(etag?{ifMatch:etag}:{allowOverwrite:false})});
console.log(JSON.stringify({status:'AUTO_HOSTED',concept_id:m.concept_id,video_url:m.video_url,manifest_url:manifestUrl,manifest_sha256:manifestHash,feed_url:feedUrl,reused:!!existing,storage:quotaEvidence,usage}));
