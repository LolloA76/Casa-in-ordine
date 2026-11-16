// Archivio cifrato; la migrazione conserva integralmente la sorgente originale.
const enc = new TextEncoder(), dec = new TextDecoder();
const FORMAT = 'casa-in-ordine-vault', ITERATIONS = 600000;
export const MAX_BYTES = 64 * 1024 * 1024;
const aad = label => enc.encode(`${FORMAT}:1:${label}`);
const random = n => crypto.getRandomValues(new Uint8Array(n));
const b64 = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const un64 = (s, max = MAX_BYTES + 16) => {
  if(typeof s !== 'string' || s.length > Math.ceil(max / 3) * 4 + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw Error('Formato cifrato non valido');
  const bytes=Uint8Array.from(atob(s), c => c.charCodeAt(0));
  check(bytes.length<=max,'File cifrato troppo grande');return bytes;
};
const check = (condition, message = 'Dati non validi: operazione annullata') => { if(!condition) throw Error(message); };
const object = o => o && typeof o === 'object' && !Array.isArray(o);
const text = (v, max, empty = false) => typeof v === 'string' && v.length <= max && (empty || v.trim().length > 0);
const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const money = v => Number.isFinite(v) && v >= 0 && v <= 1e12;
export function validateData(d) {
  check(object(d));
  check(['movements','deadlines','taxRecords'].every(k => Array.isArray(d[k]) && d[k].length <= 10000));
  for(const list of [d.movements,d.deadlines,d.taxRecords]) {
    const ids = new Set();
    for(const r of list) { check(object(r) && text(r.id,100) && !ids.has(r.id)); ids.add(r.id); }
  }
  for(const m of d.movements) check(['income','expense'].includes(m.type) && money(m.amount) && m.amount > 0 && text(m.description,120) && text(m.category,100) && date(m.date) && text(m.note,400,true));
  for(const r of d.deadlines) check(text(r.title,140) && date(r.date) && (r.amount === null || money(r.amount)) && typeof r.done === 'boolean' && text(r.note,400,true));
  for(const r of d.taxRecords) check(Number.isInteger(r.year) && r.year >= 2000 && r.year <= 2100 && ['IT','CH'].includes(r.country) && text(r.category,100) && text(r.subcategory,100,true) && text(r.title,140) && money(r.due) && money(r.paid) && ['da_verificare','da_fare','in_corso','completato'].includes(r.status) && (r.date === '' || date(r.date)) && text(r.note,600,true));
  check(object(d.taxCategories) && Object.keys(d.taxCategories).length <= 100);
  for(const [k,v] of Object.entries(d.taxCategories)) check(text(k,100) && !['__proto__','constructor','prototype'].includes(k) && Array.isArray(v) && v.length <= 100 && v.every(s=>text(s,100)) && new Set(v).size === v.length);
  check(d.schemaVersion===3 && Array.isArray(d.documents) && d.documents.length<=500);
  check(Array.isArray(d.folders) && d.folders.length<=500 && new Set(d.folders).size===d.folders.length && d.folders.every(p=>text(p,300)&&p.split('/').every(s=>s.trim().length>0)));
  let total=0;const hashes=new Set();
  for(const doc of d.documents){
    check(object(doc)&&text(doc.id,100)&&text(doc.name,240)&&text(doc.mime,100)&&Number.isInteger(doc.size)&&doc.size>0&&doc.size<=8*1024*1024);
    check(typeof doc.hash==='string'&&/^[0-9a-f]{64}$/.test(doc.hash)&&!hashes.has(doc.hash));hashes.add(doc.hash);
    check(text(doc.content,12*1024*1024)&&un64(doc.content,8*1024*1024).length===doc.size);
    check(text(doc.folder,300)&&d.folders.includes(doc.folder)&&text(doc.title,240)&&text(doc.text,150000,true));
    check((doc.date===''||date(doc.date))&&(doc.dueDate===''||date(doc.dueDate))&&(doc.amount===null||money(doc.amount))&&['EUR','CHF',''].includes(doc.currency));
    check(text(doc.issuer,240,true)&&typeof doc.year==='string'&&(doc.year===''||/^(19|20|21)\d{2}$/.test(doc.year))&&typeof doc.month==='string'&&(doc.month===''||/^(0[1-9]|1[0-2])$/.test(doc.month))&&['manuale','da_verificare','confermato'].includes(doc.classification));
    for(const [key,list] of [['movementIds',d.movements],['deadlineIds',d.deadlines],['taxIds',d.taxRecords]])check(Array.isArray(doc[key])&&doc[key].every(id=>list.some(r=>r.id===id)));
    total+=doc.size;
  }
  check(new Set(d.documents.map(r=>r.id)).size===d.documents.length&&total<=20*1024*1024,'Limite archivio documenti: 20 MB complessivi. Esporta un backup prima di proseguire.');
  check(enc.encode(JSON.stringify(d)).length <= MAX_BYTES);
  return structuredClone(d);
}
export function fakeData() {
 return {schemaVersion:3,documents:[],folders:defaultFolders(),movements:[{id:'demo-income',type:'income',amount:2000,description:'Stipendio dimostrativo',category:'Stipendio',date:'2026-11-01',note:'DATO FITTIZIO'},{id:'demo-expense',type:'expense',amount:75.5,description:'Spesa dimostrativa',category:'Spesa alimentare',date:'2026-11-02',note:'DATO FITTIZIO'}],deadlines:[{id:'demo-deadline',title:'Pagamento dimostrativo',date:'2026-12-01',amount:50,done:false,note:'DATO FITTIZIO'}],taxRecords:[{id:'demo-tax',year:2026,country:'IT',category:'Versamenti',subcategory:'F24',title:'Voce fiscale dimostrativa',due:100,paid:20,status:'da_verificare',date:'2026-12-16',note:'DATO FITTIZIO'}],taxCategories:{Versamenti:['F24','Acconti'],Dichiarazioni:['730'],Svizzera:['Imposta alla fonte']}};
}
export function checkPassword(p) { check(typeof p === 'string' && p.length >= 12 && p.length <= 256, 'Usa una password da 12 a 256 caratteri, preferibilmente una frase lunga.'); }
async function passwordKey(p,salt,iterations) {
  const base = await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function aesKey(raw) { return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']); }
async function seal(key,bytes,label) {
 const iv=random(12); return {iv:b64(iv),ct:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(label)},key,bytes)))};
}
async function open(key,packet,label) {
 check(object(packet)); const iv=un64(packet.iv,12),ct=un64(packet.ct); check(iv.length===12 && ct.length>=16);
 return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(label)},key,ct));
}
export function validateEnvelope(v) {
 check(object(v) && v.format === FORMAT && v.version === 1 && Number.isSafeInteger(v.revision) && v.revision > 0,'Formato o versione del backup non supportati');
 check(object(v.password) && v.password.iterations === ITERATIONS && un64(v.password.salt,16).length === 16);
 for(const p of [v.password.packet,v.recovery,v.payload]) check(object(p) && un64(p.iv,12).length===12 && un64(p.ct).length>=16);
 check(JSON.stringify(v).length <= MAX_BYTES*1.5); return v;
}
export function recoveryBytes(s) {
 const clean = String(s).replace(/[\s-]/g,'').toUpperCase(); check(/^[0-9A-F]{64}$/.test(clean),'Chiave di emergenza non valida');
 return Uint8Array.from(clean.match(/../g),x=>parseInt(x,16));
}
const recoveryText = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{8}/g).join('-');
export async function createVault(data,password) {
 checkPassword(password); validateData(data);
 const raw=random(32), recovery=random(32),salt=random(16),key=await aesKey(raw);
 try {
 const envelope={format:FORMAT,version:1,revision:1,password:{iterations:ITERATIONS,salt:b64(salt),packet:await seal(await passwordKey(password,salt,ITERATIONS),raw,'password')},recovery:await seal(await aesKey(recovery),raw,'recovery'),payload:await seal(key,enc.encode(JSON.stringify(data)),'data')};
 return {envelope,key,recovery:recoveryText(recovery)};
 } finally { raw.fill(0); recovery.fill(0); }
}
export async function unlockVault(envelope,secret,recovery=false) {
 validateEnvelope(envelope); let raw;
 try {
 if(recovery) {const r=recoveryBytes(secret);try{raw=await open(await aesKey(r),envelope.recovery,'recovery');}finally{r.fill(0);}}
 else raw=await open(await passwordKey(secret,un64(envelope.password.salt,16),envelope.password.iterations),envelope.password.packet,'password');
 const key=await aesKey(raw),bytes=await open(key,envelope.payload,'data');
 try {return {key,data:validateData(JSON.parse(dec.decode(bytes)))};}finally{bytes.fill(0);}
 } catch {throw Error('Credenziale errata oppure archivio danneggiato. Nessun dato modificato.');}
 finally {raw?.fill(0);}
}
export async function updatePayload(envelope,key,data) {
 validateData(data); return {...envelope,revision:envelope.revision+1,payload:await seal(key,enc.encode(JSON.stringify(data)),'data')};
}
export async function resetPassword(envelope,recovery,password) {
 checkPassword(password); await unlockVault(envelope,recovery,true);
 const r=recoveryBytes(recovery);let raw;
 try {raw=await open(await aesKey(r),envelope.recovery,'recovery'); const salt=random(16);return {...envelope,revision:envelope.revision+1,password:{iterations:ITERATIONS,salt:b64(salt),packet:await seal(await passwordKey(password,salt,ITERATIONS),raw,'password')}};}
 finally {r.fill(0);raw?.fill(0);}
}
export class Store {
 async init() {
  this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open('casa-in-ordine-secure-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('vault');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  this.db.onversionchange=()=>this.db.close(); return this;
 }
 async read() {return new Promise((resolve,reject)=>{const tx=this.db.transaction('vault','readonly'),r=tx.objectStore('vault').get('current');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
 async commit(next,expected) {
  validateEnvelope(next);
  return new Promise((resolve,reject)=>{
   const tx=this.db.transaction('vault','readwrite'),s=tx.objectStore('vault');let conflict=false;
   const r=s.get('current');r.onsuccess=()=>{const old=r.result||null;if(JSON.stringify(old)!==JSON.stringify(expected)){conflict=true;tx.abort();return;} if(old)s.put(old,'previous');s.put(next,'current');};
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error(conflict?'Archivio cambiato in un’altra scheda. Blocca e riapri prima di riprovare.':'Salvataggio non riuscito: versione precedente conservata.'));tx.onerror=()=>{};
  });
 }
 async previous() {return new Promise((resolve,reject)=>{const r=this.db.transaction('vault').objectStore('vault').get('previous');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
}
export function safeCsv(data) {
 validateData(data);const cell=v=>'"'+String(v).replace(/^[\s\uFEFF]*[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"';
 return '\uFEFF'+[['Data','Tipo','Descrizione','Categoria','Importo EUR','Nota'],...data.movements.map(m=>[m.date,m.type,m.description,m.category,m.amount,m.note])].map(r=>r.map(cell).join(';')).join('\r\n');
}
export async function encryptedCsv(data,password) {
 checkPassword(password);const bytes=enc.encode(safeCsv(data));check(bytes.length<=MAX_BYTES,'CSV troppo grande');const salt=random(16);try{return {format:'casa-in-ordine-csv',version:1,iterations:ITERATIONS,salt:b64(salt),packet:await seal(await passwordKey(password,salt,ITERATIONS),bytes,'csv')};}finally{bytes.fill(0);}
}
export async function decryptCsv(file,password) {
 check(object(file) && file.format==='casa-in-ordine-csv' && file.version===1 && file.iterations===ITERATIONS && un64(file.salt,16).length===16,'Formato CSV cifrato non valido');
 try {const bytes=await open(await passwordKey(password,un64(file.salt,16),ITERATIONS),file.packet,'csv');try{return dec.decode(bytes);}finally{bytes.fill(0);}}
 catch {throw Error('Password del CSV errata oppure file danneggiato.');}
}

export function defaultFolders(){return ['Da classificare','Fisco/Dichiarazioni dei redditi','Fisco/F24','Lavoro/Buste paga','Casa/Utenze/Elettricità','Casa/Utenze/Gas','Casa/Utenze/Acqua','Casa/Utenze/Telefonia','Banca/Estratti conto','Assicurazioni','Altri documenti'];}
export function emptyData(){return {schemaVersion:3,movements:[],deadlines:[],taxRecords:[],taxCategories:{Dichiarazioni:['730','Modello Redditi PF'],Versamenti:['F24','Acconti'],'Fiscalità svizzera':['Certificato di salario','Imposta alla fonte']},documents:[],folders:defaultFolders()};}
export function legacyData(raw){
 check(typeof raw==='string'&&enc.encode(raw).length<8*1024*1024,'Archivio originale troppo grande o non valido. Nessuna modifica effettuata.');
 let obj;try{obj=JSON.parse(raw);}catch{throw Error('Archivio originale illeggibile. Conserva il backup: nessuna migrazione effettuata.');}
 check(object(obj)&&Array.isArray(obj.movements)&&Array.isArray(obj.deadlines));check(!Object.hasOwn(obj,'documents')||(Array.isArray(obj.documents)&&obj.documents.length===0),'Questo file contiene documenti: usa il ripristino del backup completo cifrato.');
 const d={...emptyData(),...structuredClone(obj),schemaVersion:3,documents:[],folders:defaultFolders(),legacyOriginal:raw};
 d.movements=d.movements.map(m=>({...m,note:m.note??''}));
 d.deadlines=d.deadlines.map(r=>({...r,note:r.note??'',done:r.done??false,amount:r.amount??null}));
 if(!Object.hasOwn(obj,'taxRecords'))d.taxRecords=[];
 if(!Object.hasOwn(obj,'taxCategories'))d.taxCategories=emptyData().taxCategories;
 validateData(d);return d;
}
export async function verifyDocumentHashes(data){
 for(const doc of data.documents){const raw=un64(doc.content,8*1024*1024);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');check(hash===doc.hash,'Contenuto documento non integro: importazione annullata.');}
}
export async function changePassword(envelope,currentPassword,newPassword){
 checkPassword(newPassword);await unlockVault(envelope,currentPassword);const salt=random(16);let raw;
 try{raw=await open(await passwordKey(currentPassword,un64(envelope.password.salt,16),ITERATIONS),envelope.password.packet,'password');return {...envelope,revision:envelope.revision+1,password:{iterations:ITERATIONS,salt:b64(salt),packet:await seal(await passwordKey(newPassword,salt,ITERATIONS),raw,'password')}};}finally{raw?.fill(0);}
}
