#!/usr/bin/env node
// Explicit --submit only; run after deployment. The key file is public proof.
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const sitemap=readFileSync(join(root,'sitemap.xml'),'utf8');
const host=new URL(/<loc>([^<]+)<\/loc>/.exec(sitemap)[1]).hostname;
if(!['chatjevs.com','brewreel.com'].includes(host))throw Error('Unexpected host');
const key=readFileSync(join(root,'indexnow-key.txt'),'utf8').trim();
if(!/^[a-zA-Z0-9-]{8,128}$/.test(key))throw Error('Invalid IndexNow proof');
const keyLocation=`https://${host}/indexnow-key.txt`;
const urlList=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
if(!urlList.length||urlList.some(x=>new URL(x).origin!==`https://${host}`))throw Error('Invalid URL list');
if(!process.argv.includes('--submit')){
 console.log(JSON.stringify({mode:'dry-run',host,count:urlList.length,urlList},null,2));
}else{
 const proof=await fetch(keyLocation,{signal:AbortSignal.timeout(30000)});
 if(!proof.ok||(await proof.text()).trim()!==key)throw Error('Published ownership proof does not match');
 for(const url of urlList){const response=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(30000)});if(response.status!==200)throw Error(`URL is not live: ${url}, status ${response.status}`);}
 const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host,key,keyLocation,urlList}),signal:AbortSignal.timeout(30000)});
 const body=await response.text();
 console.log(JSON.stringify({submittedAt:new Date().toISOString(),host,urlList,status:response.status,result:response.status===200?'received (not proof of indexing)':response.status===202?'received; ownership validation pending':'request failed',responseBody:body.replaceAll(key,'[redacted]')},null,2));
 if(![200,202].includes(response.status))process.exit(1);
}
