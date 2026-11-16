const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const server=spawn('python',['-m','http.server','8776','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const results=[];
let browser;
async function test(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name);}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.stack);}}
(async()=>{
 for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:8776/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:412,height:915}});
 const requests=[];context.on('request',r=>requests.push(r.url()));const page=await context.newPage();await page.clock.install();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8776/');await page.waitForSelector('#setup');
 await page.evaluate(async()=>{const v=await import('./vault.js');const d=v.fakeData();delete d.schemaVersion;delete d.documents;delete d.folders;localStorage.setItem('casa_in_ordine_v1',JSON.stringify(d));});await page.reload();await page.waitForSelector('#setup');
 await test('Crittografia, credenziali, recupero e validazione',async()=>{
 const result=await page.evaluate(async()=>{
 const v=await import('./vault.js');const d=v.fakeData(),p='Password fittizia molto lunga 2026';const a=await v.createVault(d,p),b=await v.createVault(d,p);const checks=[];
 const yes=(name,condition)=>{if(!condition)throw Error(name);checks.push(name);};
 const rejects=async(name,fn)=>{let rejected=false;try{await fn();}catch{rejected=true;}yes(name,rejected);};
 yes('IV e sale diversi',a.envelope.payload.iv!==b.envelope.payload.iv&&a.envelope.password.salt!==b.envelope.password.salt);
 yes('nessun dato in chiaro',!JSON.stringify(a.envelope).includes('Stipendio'));
 yes('chiave non esportabile',a.key.extractable===false);
 yes('password valida',JSON.stringify((await v.unlockVault(a.envelope,p)).data)===JSON.stringify(d));
 await rejects('password errata',()=>v.unlockVault(a.envelope,'sbagliata'));
 await rejects('recupero errato',()=>v.unlockVault(a.envelope,'00'.repeat(32),true));
 yes('recupero valido',JSON.stringify((await v.unlockVault(a.envelope,a.recovery,true)).data)===JSON.stringify(d));
 let corrupted=structuredClone(a.envelope);corrupted.payload.ct=(corrupted.payload.ct[0]==='A'?'B':'A')+corrupted.payload.ct.slice(1);
 await rejects('alterazione rilevata',()=>v.unlockVault(corrupted,p));
 const changed=await v.resetPassword(a.envelope,a.recovery,'Nuova password fittizia lunga');
 await rejects('vecchia password rifiutata',()=>v.unlockVault(changed,p));yes('nuova password',!!await v.unlockVault(changed,'Nuova password fittizia lunga'));
 yes('recupero dopo reset',!!await v.unlockVault(changed,a.recovery,true));yes('backup vecchio ancora leggibile',!!await v.unlockVault(a.envelope,p));
 let bad=structuredClone(d);bad.taxRecords[0].paid=-1;await rejects('importo fiscale negativo',()=>v.validateData(bad));
 bad=structuredClone(d);bad.deadlines[0].date='2026-02-30';await rejects('data impossibile',()=>v.validateData(bad));
 bad=structuredClone(d);bad.movements.push(bad.movements[0]);await rejects('ID duplicato',()=>v.validateData(bad));
 bad=structuredClone(d);bad.taxCategories.Versamenti='non array';await rejects('categorie malformate',()=>v.validateData(bad));
 await rejects('JSON storico in chiaro rifiutato',()=>v.validateEnvelope(d));
 corrupted=structuredClone(a.envelope);corrupted.password.iterations=999999999;await rejects('parametri KDF eccessivi',()=>v.validateEnvelope(corrupted));
 bad=structuredClone(d);bad.movements[0].description='=HYPERLINK("https://example.invalid")';yes('formule CSV neutralizzate',v.safeCsv(bad).includes("'="));
 const csv=await v.encryptedCsv(bad,p);yes('CSV cifrato',!JSON.stringify(csv).includes('HYPERLINK'));yes('lettura CSV cifrato', (await v.decryptCsv(csv,p)).includes("'="));await rejects('CSV password errata',()=>v.decryptCsv(csv,'errata')); 
 return checks;
 });assert.ok(result.length>=20);console.log('  ',result.length,'controlli crittografici/validazione');
 });
 let recovery,fullBackup;
 await test('Configurazione, conferma chiave e isolamento localStorage',async()=>{
 const legacy=await page.evaluate(()=>localStorage.getItem('casa_in_ordine_v1'));
 await page.fill('#password','Password fittizia molto lunga 2026');await page.fill('#repeat','Password fittizia molto lunga 2026');await page.click('#setup button');await page.waitForSelector('#recoveryKey');recovery=await page.textContent('#recoveryKey');
 const before=await page.evaluate(async()=>{const {Store}=await import('./vault.js');return await (await new Store().init()).read();});assert.equal(before,null);
 const firstBackup=page.waitForEvent('download');await page.click('#migrationBackup');await firstBackup;await page.check('#backupConfirmed');
 await page.fill('#keyConfirmation','ERRATA');await page.click('#confirmKey button');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('non coincide'));
 await page.fill('#keyConfirmation',recovery);await page.click('#confirmKey button');await page.waitForSelector('#lockNow');
 assert.equal(await page.evaluate(()=>localStorage.getItem('casa_in_ordine_v1')),legacy);
 });
 await test('Creazione e salvataggio cifrato di movimento, scadenza e voce fiscale',async()=>{
 await page.click('#topAdd');await page.fill('#mDescription','TEST RISERVATO FITTIZIO');await page.fill('#mAmount','12.34');await page.fill('#mDate','2026-11-16');await page.click('#movementForm button[type=submit]');await page.waitForFunction(()=>!document.querySelector('#movementDialog').open);
 await page.click('#desktopnav [data-tab=scadenze]',{force:true}).catch(async()=>page.click('#mobilenav [data-tab=scadenze]'));
 await page.click('#addDeadline');await page.fill('#dTitle','TEST SCADENZA');await page.fill('#dDate','2026-12-01');await page.click('#deadlineForm button[type=submit]');await page.waitForFunction(()=>!document.querySelector('#deadlineDialog').open);
 await page.click('#mobilenav [data-tab=fisco]');await page.click('#addTaxRecord');await page.fill('#tTitle','TEST FISCO');await page.fill('#tDue','123.45');await page.click('#taxForm button[type=submit]');await page.waitForFunction(()=>!document.querySelector('#taxDialog').open);
 const raw=await page.evaluate(async()=>{const {Store}=await import('./vault.js');return JSON.stringify(await (await new Store().init()).read());});assert.ok(!raw.includes('TEST RISERVATO')&&!raw.includes('TEST FISCO'));
 });
 await test('Backup cifrato scaricabile e versione precedente disponibile',async()=>{
 await page.click('#mobilenav [data-tab=impostazioni]');let downloadPromise=page.waitForEvent('download');await page.click('#exportBackup');const download=await downloadPromise;const content=fs.readFileSync(await download.path(),'utf8');assert.ok(!content.includes('TEST RISERVATO'));assert.equal(JSON.parse(content).format,'casa-in-ordine-vault');
 downloadPromise=page.waitForEvent('download');await page.click('#exportPrevious');assert.ok((await downloadPromise).suggestedFilename().includes('precedente'));
 });
 await test('Importazione malformata non cambia archivio',async()=>{
 const before=await page.evaluate(async()=>{const {Store}=await import('./vault.js');return JSON.stringify(await (await new Store().init()).read());});
 await page.setInputFiles('#importFile',{name:'bad.casa',mimeType:'application/json',buffer:Buffer.from('{"taxRecords":[]}')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('non supportati'));
 const after=await page.evaluate(async()=>{const {Store}=await import('./vault.js');return JSON.stringify(await (await new Store().init()).read());});assert.equal(before,after);
 });
 await test('Blocco manuale rimuove dati dal DOM e password errata non apre',async()=>{
 await page.click('#lockNow');await page.waitForSelector('#unlock');assert.equal(await page.locator('#app').textContent(),'');assert.equal(await page.locator('#app input').count(),0);
 await page.fill('#password','errata');await page.click('#unlock button');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Credenziale errata'));assert.equal(await page.locator('#app').textContent(),'');
 await page.fill('#password','Password fittizia molto lunga 2026');await page.click('#unlock button');await page.waitForSelector('#lockNow');
 });
 await test('Blocco immediato su visibilitychange e nessuno sblocco tardivo',async()=>{
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForSelector('#unlock');assert.equal(await page.locator('#app').textContent(),'');await page.evaluate(()=>delete document.hidden);
 await page.fill('#password','Password fittizia molto lunga 2026');await page.click('#unlock button');await page.waitForSelector('#lockNow');
 });
 await test('Blocco dopo 5 minuti con orologio simulato',async()=>{
 await page.clock.fastForward(300001);await page.waitForSelector('#unlock');assert.equal(await page.locator('#app').textContent(),'');await page.clock.resume();
 await page.fill('#password','Password fittizia molto lunga 2026');await page.click('#unlock button');await page.waitForSelector('#lockNow');
 });
 await test('Errore scrittura non modifica archivio o conferma un salvataggio',async()=>{
 await page.click('#mobilenav [data-tab=movimenti]');await page.click('#addMovement');await page.fill('#mDescription','NON DEVE ESSERE SALVATO');await page.fill('#mAmount','9');await page.fill('#mDate','2026-11-16');
 await page.evaluate(()=>{window.originalTx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...a){if(a[1]==='readwrite')throw new DOMException('Simulazione spazio esaurito','QuotaExceededError');return window.originalTx.apply(this,a);};});
 await page.click('#movementForm button[type=submit]');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('spazio esaurito'));assert.equal(await page.locator('#movementDialog').evaluate(e=>e.open),true);
 await page.evaluate(()=>{IDBDatabase.prototype.transaction=window.originalTx;delete window.originalTx;});await page.click('#movementForm [data-close]');assert.ok(!(await page.textContent('#movementsRows')).includes('NON DEVE ESSERE SALVATO'));
 });
 await test('Conflitto tra scritture e transazione abortita conservano la copia valida',async()=>{
 const checks=await page.evaluate(async()=>{const v=await import('./vault.js'),s=await new v.Store().init(),old=await s.read(),opened=await v.unlockVault(old,'Password fittizia molto lunga 2026');const next=await v.updatePayload(old,opened.key,opened.data);await s.commit(next,old);let rejected=false;try{await s.commit(next,old);}catch{rejected=true;}const intact=JSON.stringify(await s.read())===JSON.stringify(next);return {rejected,intact,previous:JSON.stringify(await s.previous())===JSON.stringify(old)};});assert.deepEqual(checks,{rejected:true,intact:true,previous:true});
 });
 await test('Recupero dalla schermata con nuova password',async()=>{
 await page.click('#lockNow');await page.waitForSelector('#switchMode');await page.click('#switchMode');await page.fill('#password',recovery);await page.fill('#newPassword','Password recuperata fittizia 2026');await page.fill('#repeat','Password recuperata fittizia 2026');await page.click('#unlock button');await page.waitForSelector('#lockNow');
 });
 await test('Migrazione conserva integralmente originale e dati fiscali',async()=>{
 const report=await page.evaluate(async()=>{const v=await import('./vault.js'),store=await new v.Store().init(),opened=await v.unlockVault(await store.read(),'Password recuperata fittizia 2026'),raw=localStorage.getItem('casa_in_ordine_v1');return {same:opened.data.legacyOriginal===raw,movements:opened.data.movements.length,documents:opened.data.documents.length};});assert.equal(report.same,true);assert.ok(report.movements>=3);assert.equal(report.documents,0);
 });
 await test('Classificazione locale, date, CHF e importi separati dai pagamenti',async()=>{
 const r=await page.evaluate(async()=>{const {classify}=await import('./recognition.js');return [classify('F24 Data: 16.11.2026 Totale dovuto CHF 1’234.50 Emittente: Esempio'),classify('Bolletta energia elettrica Data: 01/11/2026 Scadenza: 30/11/2026 Totale da pagare EUR 120,00\nEmittente: Fornitore Fittizio'),classify('busta paga lohnabrechnung Data: 01.10.2026 Netto a pagare CHF 3’200.00\nDatore di lavoro: Esempio SA')];});assert.equal(r[0].folder,'Fisco/F24/2026');assert.equal(r[0].amount,1234.5);assert.equal(r[0].currency,'CHF');assert.equal(r[1].dueDate,'2026-11-30');assert.equal(r[1].folder,'Casa/Utenze/Elettricità/2026');assert.equal(r[2].folder,'Lavoro/Buste paga/2026/10');const periods=await page.evaluate(async()=>{const {classify}=await import('./recognition.js');return [classify("Dichiarazione dei redditi Anno di imposta: 2025 Data: 12/06/2026").folder,classify('Busta paga Periodo: 10/2026 Data: 02/11/2026').folder];});assert.deepEqual(periods,['Fisco/Dichiarazioni dei redditi/2025','Lavoro/Buste paga/2026/10']);
 });
 const pdfFixture=()=>{const stream='BT /F1 16 Tf 50 780 Td (F24 - Documento fittizio) Tj 0 -30 Td (Data: 16.11.2026) Tj 0 -30 Td (Totale dovuto EUR 120,00) Tj 0 -30 Td (Emittente: Esempio) Tj ET';const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);};
 await test('PDF riconosciuto localmente e archiviato solo dopo conferma',async()=>{
 await page.click('#mobilenav [data-tab=documenti]');await page.setInputFiles('#globalDocumentPicker',{name:'f24-fittizio.pdf',mimeType:'application/pdf',buffer:pdfFixture()});await page.waitForSelector('#docTitle');await page.waitForFunction(()=>document.querySelector('#recognitionStatus').textContent.includes('Proposta pronta')||document.querySelector('#recognitionStatus').textContent.includes('Riconoscimento incerto'),{timeout:60000});assert.equal(await page.inputValue('#docFolder'),'Fisco/F24/2026');assert.equal(await page.inputValue('#docAmount'),'120');await page.screenshot({path:root+'/tests/documenti-mobile.png',fullPage:true});
 const before=await page.evaluate(async()=>{const v=await import('./vault.js'),s=await new v.Store().init();return (await v.unlockVault(await s.read(),'Password recuperata fittizia 2026')).data;});assert.equal(before.documents.length,0);
 await page.check('#docConfirmed');await page.click('#documentForm button:not([type=button])');await page.waitForSelector('#documentLinks');const after=await page.evaluate(async()=>{const v=await import('./vault.js'),s=await new v.Store().init();return (await v.unlockVault(await s.read(),'Password recuperata fittizia 2026')).data;});assert.equal(after.documents.length,1);assert.equal(after.movements.length,before.movements.length);assert.equal(after.deadlines.length,before.deadlines.length);assert.equal(after.taxRecords.length,before.taxRecords.length);
 await page.click('#viewOriginal');await page.waitForSelector('#documentPreview canvas');await page.click('dialog[open] [data-dismiss]');
 });
 await test('File identico rilevato senza duplicazione',async()=>{
 await page.setInputFiles('#globalDocumentPicker',{name:'copia.pdf',mimeType:'application/pdf',buffer:pdfFixture()});await page.waitForSelector('#documentLinks');assert.ok((await page.textContent('#status')).includes('già presente'));await page.click('dialog[open] [data-dismiss]');
 });
 await test('Cartelle rinominabili, ricerca e collegamento esplicito',async()=>{
 await page.click('#manageFolders');await page.selectOption('#oldFolder','Fisco/F24/2026');await page.fill('#newFolder','Fisco/F24 verificati/2026');await page.click('#folderForm button:not([type=button])');await page.waitForFunction(()=>!document.querySelector('#folderForm'));await page.fill('#documentSearch','Esempio');assert.ok((await page.textContent('#documentList')).includes('f24-fittizio.pdf'));await page.click('[data-document]');
 await page.selectOption('#documentLinks select >> nth=0','demo-income');page.once('dialog',d=>d.accept());await page.click('#documentLinks button >> nth=0');await page.waitForSelector('#documentLinks');await page.click('dialog[open] [data-dismiss]');await page.click('#mobilenav [data-tab=movimenti]');assert.ok(await page.locator('#movementsRows [data-linked-docs]').count()>0);
 });
 await test('Backup include file, metadati e collegamenti cifrati',async()=>{
 await page.click('#mobilenav [data-tab=impostazioni]');const promise=page.waitForEvent('download');await page.click('#exportBackup');const download=await promise,packet=JSON.parse(fs.readFileSync(await download.path(),'utf8'));fullBackup=packet;const r=await page.evaluate(async packet=>{const v=await import('./vault.js');const opened=await v.unlockVault(packet,'Password recuperata fittizia 2026');await v.verifyDocumentHashes(opened.data);return {docs:opened.data.documents.length,links:opened.data.documents[0].movementIds.length};},packet);assert.deepEqual(r,{docs:1,links:1});assert.ok(!JSON.stringify(packet).includes('f24-fittizio'));
 });
 await test('Cambio password autenticato mantiene documenti e recupero',async()=>{
 await page.fill('#oldPassword','ERRATA');await page.fill('#changeNewPassword','Password nuova fittizia 2026');await page.fill('#changeRepeat','Password nuova fittizia 2026');await page.click('#passwordChangeForm button');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Credenziale errata'));
 await page.fill('#oldPassword','Password recuperata fittizia 2026');await page.click('#passwordChangeForm button');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Password cambiata'));const r=await page.evaluate(async recovery=>{const v=await import('./vault.js'),s=await new v.Store().init(),env=await s.read();return {n:(await v.unlockVault(env,'Password nuova fittizia 2026')).data.documents.length,recovery:!!await v.unlockVault(env,recovery,true)};},recovery);assert.deepEqual(r,{n:1,recovery:true});
 });
 await test('OCR reale su immagine fittizia e nessun invio esterno',async()=>{
 await page.click('#mobilenav [data-tab=documenti]');const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1400;c.height=500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='40px Arial';['BOLLETTA ENERGIA ELETTRICA','Data: 01/11/2026','Scadenza: 30/11/2026','Totale da pagare EUR 120,00','Emittente: Fornitore Fittizio'].forEach((s,i)=>x.fillText(s,40,65+i*75));return c.toDataURL('image/png').split(',')[1];});
 await page.setInputFiles('#globalDocumentPicker',{name:'bolletta-fittizia.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.waitForSelector('#docText');await page.waitForFunction(()=>!document.querySelector('#recognizeDocument').disabled,{timeout:120000});const text=await page.inputValue('#docText');assert.ok(/BOLLETTA/i.test(text),await page.textContent('#recognitionStatus'));await page.check('#docConfirmed');await page.click('#documentForm button:not([type=button])');await page.waitForSelector('#documentLinks');await page.click('dialog[open] [data-dismiss]');
 });
 await test('Importazione backup verificato con credenziale e conservazione precedente',async()=>{
 await page.click('#mobilenav [data-tab=impostazioni]');const envelope=await page.evaluate(async()=>{const {Store,unlockVault,createVault}=await import('./vault.js');const store=await new Store().init();const d=(await unlockVault(await store.read(),'Password nuova fittizia 2026')).data;d.movements[0].description='BACKUP FITTIZIO IMPORTATO';return (await createVault(d,'Password backup fittizio 2026')).envelope;});
 await page.setInputFiles('#importFile',{name:'test.casa',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(envelope))});await page.waitForSelector('dialog[open] input[type=password]');await page.fill('dialog[open] input[type=password]','Password backup fittizio 2026');page.once('dialog',d=>d.accept());await page.click('dialog[open] button:not([type=button])');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Backup importato'));assert.ok((await page.textContent('#recentList')).includes('BACKUP FITTIZIO IMPORTATO'));
 });
 await test('Sblocco interrotto dal background non espone dati al termine',async()=>{
 await page.click('#lockNow');await page.waitForSelector('#unlock');await page.fill('#password','Password backup fittizio 2026');
 await page.evaluate(()=>{document.querySelector('#unlock').requestSubmit();Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(700);assert.equal(await page.locator('#app').textContent(),'');await page.evaluate(()=>delete document.hidden);await page.waitForSelector('#unlock');
 await page.fill('#password','Password backup fittizio 2026');await page.click('#unlock button');await page.waitForSelector('#lockNow');
 });
 await test('CSV esportato cifrato, leggibile con password e rimosso al blocco',async()=>{
 await page.click('#mobilenav [data-tab=impostazioni]');await page.fill('#csvPassword','Password CSV fittizia 2026');const promise=page.waitForEvent('download');await page.click('#csvForm button');const download=await promise;const packet=fs.readFileSync(await download.path());assert.ok(!packet.toString().includes('IMPORTATO'));
 await page.setInputFiles('#csvFile',{name:'demo.csv.casa',mimeType:'application/json',buffer:packet});await page.fill('dialog[open] input[type=password]','Password CSV fittizia 2026');await page.click('dialog[open] button:not([type=button])');await page.waitForFunction(()=>document.querySelector('dialog[open] pre').textContent.includes('IMPORTATO'));await page.screenshot({path:root+'/tests/schermata-prova.png',fullPage:true});
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForSelector('#unlock');assert.equal(await page.locator('#app pre').count(),0);await page.evaluate(()=>delete document.hidden);
 await page.fill('#password','Password backup fittizio 2026');await page.click('#unlock button');await page.waitForSelector('#lockNow');
 });
 await test('Offline: ricaricamento, accesso e salvataggio senza rete',async()=>{
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForSelector('#unlock');
 await context.setOffline(true);await page.reload();await page.waitForSelector('#unlock');await page.fill('#password','Password backup fittizio 2026');await page.click('#unlock button');await page.waitForSelector('#lockNow');await page.click('#topAdd');await page.fill('#mDescription','CREATO OFFLINE FITTIZIO');await page.fill('#mAmount','1');await page.fill('#mDate','2026-11-16');await page.click('#movementForm button[type=submit]');await page.waitForFunction(()=>!document.querySelector('#movementDialog').open);await context.setOffline(false);
 });
 await test('OCR e PDF disponibili offline dopo preparazione esplicita',async()=>{
 await page.click('#mobilenav [data-tab=documenti]');await page.click('#prepareOffline');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Riconoscimento offline pronto'),null,{timeout:120000});await context.setOffline(true);
 const result=await page.evaluate(async()=>{const {recognize}=await import('./recognition.js');const c=document.createElement('canvas');c.width=1000;c.height=160;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='44px Arial';x.fillText('DOCUMENTO FITTIZIO F24',25,90);const blob=await new Promise(r=>c.toBlob(r));return await recognize(new Uint8Array(await blob.arrayBuffer()),'image/png');});assert.ok(result.text.includes('F24'));const pdfText=await page.evaluate(async bytes=>{const {recognize}=await import('./recognition.js');return (await recognize(new Uint8Array(bytes),'application/pdf')).text;},Array.from(pdfFixture()));assert.ok(pdfText.includes('F24'));await context.setOffline(false);
 });
 await test('Selezione di un documento durante il blocco attende lo sblocco',async()=>{
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForSelector('#unlock');await page.evaluate(()=>delete document.hidden);
 await page.setInputFiles('#globalDocumentPicker',{name:'file-fittizio.txt',mimeType:'text/plain',buffer:Buffer.from('Documento fittizio senza contenuti personali.')});assert.equal(await page.locator('#docTitle').count(),0);await page.fill('#password','Password backup fittizio 2026');await page.click('#unlock button');await page.waitForSelector('#docTitle');assert.equal(await page.inputValue('#docTitle'),'file-fittizio.txt');await page.click('dialog[open] [data-dismiss]');
 });
 await test('Migrazione rifiuta anomalie senza alterare la sorgente',async()=>{
 const r=await page.evaluate(async()=>{const v=await import('./vault.js'),raw=localStorage.getItem('casa_in_ordine_v1');let rejected=false;const bad=JSON.parse(raw);bad.taxRecords[0].due=-12;try{v.legacyData(JSON.stringify(bad));}catch{rejected=true;}return {rejected,same:localStorage.getItem('casa_in_ordine_v1')===raw};});assert.deepEqual(r,{rejected:true,same:true});
 });
 await test('Ripristino da schermata bloccata include documenti e collegamenti',async()=>{
 await page.click('#lockNow');await page.waitForSelector('#restoreLocked');await page.setInputFiles('#lockedRestorePicker',{name:'ripristino.casa',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fullBackup))});await page.waitForSelector('dialog[open] input[type=password]');await page.fill('dialog[open] input[type=password]','Password recuperata fittizia 2026');page.once('dialog',d=>d.accept());await page.click('dialog[open] button:not([type=button])');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Backup completo ripristinato'));
 const r=await page.evaluate(async()=>{const v=await import('./vault.js'),store=await new v.Store().init(),d=(await v.unlockVault(await store.read(),'Password recuperata fittizia 2026')).data;return {docs:d.documents.length,linked:d.documents[0].movementIds.length,legacy:d.legacyOriginal===localStorage.getItem('casa_in_ordine_v1')};});assert.deepEqual(r,{docs:1,linked:1,legacy:true});
 });
 await test('Backup con file incoerente rifiutato senza sostituire archivio',async()=>{
 const packet=await page.evaluate(async()=>{const v=await import('./vault.js'),store=await new v.Store().init(),env=await store.read(),d=(await v.unlockVault(env,'Password recuperata fittizia 2026')).data;const content=d.documents[0].content;d.documents[0].content=(content[0]==='A'?'B':'A')+content.slice(1);return (await v.createVault(d,'Password danno fittizio 2026')).envelope;});const before=await page.evaluate(async()=>{const {Store}=await import('./vault.js');return JSON.stringify(await(await new Store().init()).read());});
 await page.click('#mobilenav [data-tab=impostazioni]');await page.setInputFiles('#importFile',{name:'incoerente.casa',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});await page.waitForSelector('dialog[open] input[type=password]');await page.fill('dialog[open] input[type=password]','Password danno fittizio 2026');await page.click('dialog[open] button:not([type=button])');await page.waitForFunction(()=>document.querySelector('dialog[open] [role=alert]').textContent.includes('non integro'));const after=await page.evaluate(async()=>{const {Store}=await import('./vault.js');return JSON.stringify(await(await new Store().init()).read());});assert.equal(after,before);await page.click('dialog[open] button[type=button]');
 });
 await test('Migrazione concorrente si arresta senza scrivere o cancellare dati',async()=>{
 const isolated=await browser.newContext({acceptDownloads:true}),p=await isolated.newPage();await p.goto('http://127.0.0.1:8776/');await p.waitForSelector('#setup');await p.evaluate(async()=>{const {fakeData}=await import('./vault.js');const d=fakeData();delete d.schemaVersion;delete d.documents;delete d.folders;localStorage.setItem('casa_in_ordine_v1',JSON.stringify(d));});await p.reload();await p.waitForSelector('#setup');await p.fill('#password','Password migrazione fittizia');await p.fill('#repeat','Password migrazione fittizia');await p.click('#setup button');await p.waitForSelector('#recoveryKey');const key=await p.textContent('#recoveryKey');const promise=p.waitForEvent('download');await p.click('#migrationBackup');await promise;await p.check('#backupConfirmed');await p.fill('#keyConfirmation',key);await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('casa_in_ordine_v1'));d.movements[0].note='MODIFICA CONCORRENTE FITTIZIA';localStorage.setItem('casa_in_ordine_v1',JSON.stringify(d));});await p.click('#confirmKey button');await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('è cambiato'));const r=await p.evaluate(async()=>{const {Store}=await import('./vault.js');return {empty:await(await new Store().init()).read()===null,intact:localStorage.getItem('casa_in_ordine_v1').includes('MODIFICA CONCORRENTE FITTIZIA')};});assert.deepEqual(r,{empty:true,intact:true});await isolated.close();
 });
 await test('Recupero da vecchio JSON su browser nuovo senza alterare localStorage',async()=>{
 const isolated=await browser.newContext({acceptDownloads:true}),p=await isolated.newPage();await p.goto('http://127.0.0.1:8776/');await p.waitForSelector('#setup');const legacy=await p.evaluate(async()=>{const {fakeData}=await import('./vault.js');const d=fakeData();delete d.schemaVersion;delete d.documents;delete d.folders;return JSON.stringify(d);});await p.setInputFiles('#legacySetupFile',{name:'backup-fittizio.json',mimeType:'application/json',buffer:Buffer.from(legacy)});await p.fill('#password','Password vecchio backup fittizio');await p.fill('#repeat','Password vecchio backup fittizio');await p.click('#setup button');await p.waitForSelector('#recoveryKey');const key=await p.textContent('#recoveryKey'),download=p.waitForEvent('download');await p.click('#migrationBackup');await download;await p.check('#backupConfirmed');await p.fill('#keyConfirmation',key);await p.click('#confirmKey button');await p.waitForSelector('#lockNow');const r=await p.evaluate(async()=>{const v=await import('./vault.js'),store=await new v.Store().init(),opened=await v.unlockVault(await store.read(),'Password vecchio backup fittizio');return {raw:opened.data.legacyOriginal,local:localStorage.getItem('casa_in_ordine_v1'),movements:opened.data.movements.length};});assert.equal(r.raw,legacy);assert.equal(r.local,null);assert.equal(r.movements,2);await isolated.close();
 });
 await test('Aggiornamento reale da vecchio service worker, stessa origine e archivio',async()=>{
 const upgrade=spawn('python',[root+'/tests/upgrade-server.py'],{stdio:'ignore'});let isolated;
 try{for(let i=0;i<40;i++){try{await fetch('http://127.0.0.1:8777/');break;}catch{await new Promise(r=>setTimeout(r,100));}}isolated=await browser.newContext({acceptDownloads:true});let p=await isolated.newPage();await p.goto('http://127.0.0.1:8777/');await p.waitForSelector('#topAdd');await p.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
 const legacy=await page.evaluate(()=>localStorage.getItem('casa_in_ordine_v1'));await p.evaluate(raw=>localStorage.setItem('casa_in_ordine_v1',raw),legacy);await p.reload();await p.waitForSelector('#recentList');assert.ok((await p.textContent('#recentList')).includes('Stipendio dimostrativo'));
 await fetch('http://127.0.0.1:8777/__upgrade',{method:'POST'});await p.reload();await p.waitForSelector('#setup');await p.fill('#password','Password aggiornamento fittizio');await p.fill('#repeat','Password aggiornamento fittizio');await p.click('#setup button');await p.waitForSelector('#recoveryKey');const key=await p.textContent('#recoveryKey'),download=p.waitForEvent('download');await p.click('#migrationBackup');await download;await p.check('#backupConfirmed');await p.fill('#keyConfirmation',key);await p.click('#confirmKey button');await p.waitForSelector('#lockNow');assert.equal(await p.evaluate(()=>localStorage.getItem('casa_in_ordine_v1')),legacy);assert.ok((await p.textContent('#recentList')).includes('Stipendio dimostrativo'));
 await p.close();p=await isolated.newPage();await p.goto('http://127.0.0.1:8777/');await p.waitForSelector('#unlock');await p.evaluate(async()=>{await navigator.serviceWorker.ready;});await isolated.setOffline(true);await p.reload();await p.waitForSelector('#unlock');await p.fill('#password','Password aggiornamento fittizio');await p.click('#unlock button');await p.waitForSelector('#lockNow');assert.ok((await p.textContent('#recentList')).includes('Stipendio dimostrativo'));
 }finally{await isolated?.close();upgrade.kill();}
 });
 await test('Nessuna richiesta a servizi esterni',async()=>assert.ok(requests.every(u=>u.startsWith('http://127.0.0.1:8776/')||u.startsWith('blob:http://127.0.0.1:8776/'))));
 await test('Nessun errore JavaScript non gestito',async()=>assert.deepEqual(errors,[]));
 await context.close();
})().catch(e=>{results.push({name:'Suite',ok:false,error:e.stack});console.error(e);}).finally(async()=>{await browser?.close();server.kill();fs.writeFileSync(path.join(root,'tests','results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));if(results.some(r=>!r.ok))process.exitCode=1;});
