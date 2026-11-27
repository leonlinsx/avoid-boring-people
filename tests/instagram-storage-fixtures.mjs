// Real storage helper with disposable keys and mocked provider I/O only.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const sourceUrl = new URL('../scripts/instagram_growth/autonomy/storage.mjs', import.meta.url);
const source = await fs.readFile(sourceUrl, 'utf8');
const host = 'kveensoemz2j3t8d.public.blob.vercel-storage.com';
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function scenario(name, supplied) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'abp-storage-fixture-'));
  try {
    const privateKey = supplied ? crypto.createPrivateKey(await fs.readFile(supplied.private_key_path)) : crypto.generateKeyPairSync('ed25519').privateKey;
    const publicKey = crypto.createPublicKey(privateKey);
    const keyPath = path.join(root, 'key');
    await fs.writeFile(keyPath, privateKey.export({type:'pkcs8',format:'pem'}), {mode:0o600});
    const sign = body => ({...body,auto_signature:crypto.sign(null,Buffer.from(stable(body)),privateKey).toString('base64')});
    const media = supplied ? Buffer.from(supplied.media_base64,'base64') : Buffer.from('disposable fixture, not a real Reel');
    const m = supplied ? JSON.parse(supplied.manifest_json) : {artifact_type:'abp_auto_manifest_v1',account:'avoidboringpeople',review_status:'AUTO_ADMITTED',trial:false,concept_id:'fixture-only',video_sha256:sha(media),video_url:`https://${host}/instagram/reels/auto/fixture-only/${sha(media)}.mp4`};
    const input = path.join(root,'input.json'), video = path.join(root,'video.mp4'), config = path.join(root,'config.json');
    await fs.writeFile(video,media);
    await fs.writeFile(config,JSON.stringify({root,signing_key:keyPath,vercel_cli:'fixture-vercel'}));
    const signed = supplied ? m : sign(m);
    if(name==='forged')signed.auto_signature=Buffer.alloc(64).toString('base64');
    await fs.writeFile(input,JSON.stringify({manifest:signed,local_video:video,factory:{status:'healthy'},
      signing_payload:supplied?.signing_payload??stable(m),manifest_json:supplied?.manifest_json??stable(signed)}));
    if(['budget','invalid_budget'].includes(name))await fs.writeFile(path.join(root,`usage-${new Date().toISOString().slice(0,7)}.json`),JSON.stringify({bytes_reserved:name==='invalid_budget'?-1:0,operations_reserved:900}));
    const objects = new Map(), puts = [], lines = [];
    const feedUrl = `https://${host}/instagram/reels/auto/feed.json`;
    let requests=0;
    if(name==='bytes')objects.set(m.video_url,{data:Buffer.from('changed'),etag:'video'});
    if(name==='cas')objects.set(feedUrl,{data:Buffer.from(stable(sign({artifact_type:'abp_auto_feed_v1',account:'avoidboringpeople',items:[]}))),etag:'old'});
    class BlobNotFoundError extends Error {}
    const context = vm.createContext({Buffer,URL,Date,console:{log:line=>lines.push(line)},
      process:{argv:['node','storage','upload',input],env:{ABP_AUTO_CONFIG:config}},
      fetch:async(url,options)=>{
        requests++;assert.equal(options.redirect,'error');
        const u=new URL(url);u.search='';assert.equal(u.hostname,host);
        const row=objects.get(u.href);
        return {status:row?200:404,ok:!!row,arrayBuffer:async()=>row.data,json:async()=>JSON.parse(row.data.toString())};
      }});
    const modules={
      'node:fs/promises':{default:{...fs,readFile:async(p,...args)=>String(p).endsWith('/public-key.pem')?publicKey.export({type:'spki',format:'pem'}):fs.readFile(p,...args)}},
      'node:path':{default:path},'node:crypto':{default:crypto},
      'node:child_process':{execFileSync:(_cmd,args)=>{
        requests++;
        return Buffer.from(JSON.stringify(args[1].startsWith('/v2/teams/')
          ?{id:'team_cilwkczruho74HBIaE1IlQIt',billing:{plan:name==='paid'?'pro':'hobby',status:'active'}}
          :{id:'store_kvEENsOeMZ2J3t8D',ownerId:'team_cilwkczruho74HBIaE1IlQIt',access:'public',status:'available',usageQuotaExceeded:name==='quota',size:10,count:1}));
      }},
      '@vercel/oidc':{getVercelOidcToken:async()=>'disposable-fixture-token'},
      '@vercel/blob':{
        head:async url=>{if(!objects.has(url))throw new BlobNotFoundError();return {etag:objects.get(url).etag};},
        put:async(pathname,bytes,options)=>{
          const url=`https://${host}/${pathname}`;puts.push({url,options});
          if(name==='cas'&&url===feedUrl){assert.equal(options.ifMatch,'old');throw Error('fixture CAS conflict');}
          if(objects.has(url))assert.notEqual(options.allowOverwrite,false);
          objects.set(url,{data:Buffer.from(bytes),etag:String(puts.length)});return {url};
        }},
    };
    const module=new vm.SourceTextModule(source,{context,identifier:sourceUrl.href,initializeImportMeta:meta=>{meta.url=sourceUrl.href;}});
    await module.link(specifier=>{
      const exports=modules[specifier];assert.ok(exports,`Unexpected import ${specifier}`);
      return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context});
    });
    if(name==='valid'){
      await module.evaluate();const receipt=JSON.parse(lines[0]);
      assert.equal(receipt.status,'AUTO_HOSTED');assert.equal(receipt.usage.operations_reserved,12);assert.equal(receipt.usage.bytes_reserved,media.length);
      const {auto_signature,...body}=JSON.parse(objects.get(feedUrl).data);
      assert.ok(crypto.verify(null,Buffer.from(stable(body)),publicKey,Buffer.from(auto_signature,'base64')));
      assert.ok(puts.every(row=>row.options.allowOverwrite===false));assert.equal(body.items.length,1);
      if(supplied?.output)await fs.writeFile(supplied.output,JSON.stringify({feed:objects.get(feedUrl).data.toString(),manifest:objects.get(body.items[0].url).data.toString()}));
    }else{
      await assert.rejects(module.evaluate());assert.equal(lines.length,0);
      if(name!=='cas')assert.equal(puts.length,0);
      if(name==='forged')assert.equal(requests,0);
      if(name==='cas')assert.equal(objects.get(feedUrl).etag,'old');
    }
  }finally{await fs.rm(root,{recursive:true,force:true});}
}
for(const name of ['valid','forged','paid','quota','budget','invalid_budget','bytes','cas'])await scenario(name);
if(process.argv[2])await scenario('valid',JSON.parse(await fs.readFile(process.argv[2],'utf8')));
console.log('PASS: signed upload, immutable bytes, no-paid/budget gates and CAS conflict; provider I/O faked');
