const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const server=spawn('python',[root+'/tests/upgrade-server.py'],{env:{...process.env,BASE_REVISION:'4557a57075426218862d72174ad07c50d45c2b0f'},stdio:'ignore'});
let browser;
(async()=>{
 for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:8777/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const c=await browser.newContext();const p=await c.newPage();
 await p.goto('http://127.0.0.1:8777/');await p.waitForSelector('#setup');await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await p.reload();
 const before=await p.evaluate(async()=>{const v=await import('./vault.js');const s=await new v.Store().init();const created=await v.createVault(v.fakeData(),'Password fittizia aggiornamento');await s.commit(created.envelope,null);localStorage.setItem('casa_in_ordine_v1','SENTINELLA FITTIZIA');return JSON.stringify(await s.read());});
 await p.reload();await p.waitForSelector('#unlock');
 assert.ok(!(await p.evaluate(async()=>await(await fetch('./documents.js')).text())).includes('forcePdfOCR'));
 const oldCaches=await p.evaluate(()=>caches.keys());
 await fetch('http://127.0.0.1:8777/__upgrade',{method:'POST'});
 const update=await c.newPage();await update.goto('http://127.0.0.1:8777/aggiorna.html');await update.click('#update');await update.waitForFunction(()=>document.querySelector('#updateStatus').textContent.includes('Aggiornamento completato'),null,{timeout:90000});
 const result=await update.evaluate(async()=>{const {Store}=await import('./vault.js?verification=302');const s=await new Store().init();return {snapshot:JSON.stringify(await s.read()),legacy:localStorage.getItem('casa_in_ordine_v1'),cached:await caches.keys()};});
 assert.equal(result.snapshot,before);assert.equal(result.legacy,'SENTINELLA FITTIZIA');assert.ok(oldCaches.every(k=>result.cached.includes(k)));assert.equal(p.isClosed(),false);
 await update.click('#update');await update.waitForSelector('#unlock');assert.ok((await update.textContent('.trial-banner')).includes('v3.0.2'));
 await update.fill('#password','Password fittizia aggiornamento');await update.click('#unlock button');await update.waitForSelector('#lockNow');assert.ok((await update.evaluate(async()=>await(await fetch('./documents.js')).text())).includes('forcePdfOCR'));
 console.log('PASS aggiornamento esplicito con vecchia scheda aperta; archivio cifrato, originale e cache precedenti conservati; accesso con password esistente e nuova versione caricata.');
 await c.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});
