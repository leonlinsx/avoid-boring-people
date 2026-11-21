/** Bounded, content-addressed local MP4 upload. No Instagram credentials. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {getVercelOidcToken} from '@vercel/oidc';
import {put, head} from '@vercel/blob';

const [inputDir, outputDir] = process.argv.slice(2);
if (!inputDir || !outputDir) throw new Error('usage: node scripts/instagram_growth/upload_blob.mjs APPROVAL_DIR OUTPUT_DIR');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const storeId = 'store_kvEENsOeMZ2J3t8D';
const host = 'kveensoemz2j3t8d.public.blob.vercel-storage.com';
const files = (await fs.readdir(inputDir)).filter(n=>n.endsWith('.json')).sort();
if (!files.length || files.length>24) throw new Error('bounded batch requires 1–24 manifests');
const items=[];
let bytes=0;
for (const file of files) {
 const item=JSON.parse(await fs.readFile(path.join(inputDir,file),'utf8'));
 if(item.account!=='avoidboringpeople'||item.review_status!=='approved'||!item.approved_by)throw new Error('Unapproved or wrong-account manifest');
 if(!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(item.concept_id))throw new Error('Unsafe concept');
 if(!/^[a-f0-9]{64}$/.test(item.video_sha256))throw new Error('Invalid hash');
 const data=await fs.readFile(item.video_path);bytes+=data.length;
 if(sha(data)!==item.video_sha256)throw new Error('Reviewed bytes changed');
 const source=await fs.readFile(item.source_file);
 if(sha(source)!==item.source_sha256||!source.toString().includes(item.source_anchor))throw new Error('Source provenance changed');
 items.push({file,item,data});
}
if(bytes>25*1024*1024)throw new Error('Batch exceeds fixed 25 MiB upload budget');
const oidcToken=await getVercelOidcToken({project:'prj_Swcosa9UBmQBNDvJXFLIbTkHF7u6',team:'team_cilwkczruho74HBIaE1IlQIt'});
await fs.mkdir(outputDir,{recursive:true});
for(const {file,item,data} of items){
 const pathname=`instagram/reels/${item.concept_id}/${item.video_sha256}.mp4`;
 const expected=`https://${host}/${pathname}`;
 let existing;
 try {existing=await head(expected,{storeId,oidcToken});}
 catch(error){if(error?.constructor?.name!=='BlobNotFoundError')throw error;}
 const uploaded=existing??await put(pathname,data,{access:'public',contentType:'video/mp4',addRandomSuffix:false,allowOverwrite:false,storeId,oidcToken});
 if(uploaded.url!==expected)throw new Error('Unexpected upload destination');
 const response=await fetch(expected,{redirect:'error'});
 if(!response.ok||!response.headers.get('content-type')?.startsWith('video/mp4'))throw new Error('Public MP4 unavailable');
 const remote=Buffer.from(await response.arrayBuffer());
 if(sha(remote)!==item.video_sha256)throw new Error('Public bytes differ');
 const manifest={...item,video_path:`downloads/${item.video_sha256}.mp4`,video_url:expected,release_status:'HOSTED_REVIEWED_NOT_YET_SCHEDULED',release_after:null};
 await fs.writeFile(path.join(outputDir,file),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({concept_id:item.concept_id,url:expected,bytes:remote.length,reused:!!existing,sha256:item.video_sha256}));
}
