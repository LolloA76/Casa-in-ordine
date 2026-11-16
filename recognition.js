// Nessun documento viene inviato fuori origine. PDF/OCR eseguiti localmente.
let activeWorker=null,job=0;
export function stopRecognition(){job++;activeWorker?.terminate();activeWorker=null;}
const base=new URL('./',import.meta.url);
const path=p=>new URL(p,base).href;
export async function pdfLibrary(){const pdf=await import('./vendor/pdfjs/pdf.min.mjs');pdf.GlobalWorkerOptions.workerSrc=path('vendor/pdfjs/pdf.worker.min.mjs');return pdf;}
async function loadPdf(bytes){const pdf=await pdfLibrary();return pdf.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,cMapUrl:path('vendor/pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:path('vendor/pdfjs/standard_fonts/')}).promise;}
async function ocrImage(image,language,onProgress,token){
 const {default:Tesseract}=await import('./vendor/tesseract/tesseract.esm.min.js');
 if(token!==job)throw Error('Riconoscimento annullato.');
 const worker=await Tesseract.createWorker(language,1,{workerPath:path('vendor/tesseract/worker.min.js'),corePath:path('vendor/core/'),langPath:path('vendor/lang/'),gzip:false,workerBlobURL:false,cacheMethod:'none',logger:m=>{if(token===job)onProgress(m.status==='recognizing text'?`OCR locale: ${Math.round(m.progress*100)}%`:'Preparazione OCR sul dispositivo…');}});
 if(token!==job){await worker.terminate();throw Error('Riconoscimento annullato.');}activeWorker=worker;
 try{const {data}=await worker.recognize(image);return data.text;}finally{await worker.terminate();if(activeWorker===worker)activeWorker=null;}
}
export async function recognize(bytes,mime,{language='ita',onProgress=()=>{},maxPages=20,forceOCR=false}={}){
 stopRecognition();const token=job;let text='',warnings=[];onProgress('Avvio riconoscimento locale…');
 if(mime==='application/pdf'){
 onProgress('Apertura PDF sul dispositivo…');const pdf=await loadPdf(bytes.slice());
 try{
 const limit=Math.min(pdf.numPages,maxPages);if(pdf.numPages>limit)warnings.push(`Analizzate solo le prime ${limit} pagine su ${pdf.numPages}. L’originale completo viene conservato.`);
 for(let i=1;i<=limit;i++){
 if(token!==job)throw Error('Riconoscimento annullato.');onProgress(`Lettura locale pagina ${i}/${limit}`);
 const page=await pdf.getPage(i);const content=await page.getTextContent();const pageText=content.items.map(x=>(x.str||'')+(x.hasEOL?'\n':' ')).join('');
 if(!forceOCR&&pageText.replace(/\s/g,'').length>30)text+=pageText+'\n';
 else{const initial=page.getViewport({scale:1}),scale=Math.min(2,1800/Math.max(initial.width,initial.height)),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;text+=await ocrImage(canvas,language,onProgress,token)+'\n';canvas.width=canvas.height=0;}
 page.cleanup();if(text.length>150000){text=text.slice(0,150000);warnings.push('Testo riconosciuto limitato a 150.000 caratteri.');break;}
 }
 }finally{await pdf.destroy();}
 }else if(['image/jpeg','image/png','image/webp'].includes(mime)){
 const blob=new Blob([bytes],{type:mime});const bitmap=await createImageBitmap(blob);if(bitmap.width*bitmap.height>40e6){bitmap.close();throw Error('Immagine troppo grande da elaborare: riduci la risoluzione.');}
 const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.ceil(bitmap.width*scale);canvas.height=Math.ceil(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();try{text=await ocrImage(canvas,language,onProgress,token);}finally{canvas.width=canvas.height=0;}
 }else warnings.push('Formato archiviabile, senza riconoscimento automatico.');
 if(token!==job)throw Error('Riconoscimento annullato.');if(!text.trim())warnings.push('Nessun testo leggibile: prova Forza OCR sul PDF oppure una fotografia più nitida.');return {text:text.slice(0,150000),warnings};
}
const dateISO=s=>{const m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(!m)return '';const iso=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return !isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:'';};
export function classify(text,name=''){
 text=text.normalize('NFKC').replace(/\u00a0/g,' ');const normalizedName=name.replace(/[_-]/g,' ');const t=(text+' '+normalizedName).toLowerCase();let folder='Da classificare',matches=[];
 for(const [pattern,path] of [[/\bf24\b/,'Fisco/F24'],[/730|modello\s+redditi|dichiarazione\s+dei\s+redditi|steuererklärung/,'Fisco/Dichiarazioni dei redditi'],[/busta\s+paga|cedolino|certificato\s+di\s+salario|lohnausweis|lohnabrechnung|fiche\s+de\s+salaire|payslip/,'Lavoro/Buste paga'],[/estratto\s+conto|kontoauszug|relevé\s+de\s+compte/,'Banca/Estratti conto'],[/bolletta|fattura|utenza/,'Casa/Utenze'],[/polizza|assicurazione|versicherung/,'Assicurazioni']])if(pattern.test(t))matches.push(path);
 const isCU=/\bcertificazione\s+unica\b|\bcu\s*20\d{2}\b/i.test(text+' '+normalizedName);
 if(isCU){matches=['Fisco/Certificazioni Uniche'];folder=matches[0];}else if(matches.length===1)folder=matches[0];
 if(folder==='Casa/Utenze'){if(/elettric|energia\s+elettrica|\bluce\b/.test(t))folder+='/Elettricità';else if(/\bgas\b/.test(t))folder+='/Gas';else if(/acqua|idrico/.test(t))folder+='/Acqua';else if(/telefono|telefonia|internet/.test(t))folder+='/Telefonia';}
 const dates=[...text.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g)].map(m=>({value:dateISO(m[0]),index:m.index})).filter(x=>x.value);
 const markedDate=text.match(/(?:data\s*(?:documento|fattura|emissione)?|datum|date)\s*[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
 const date=markedDate?dateISO(markedDate[1]):dates[0]?.value||'';
 const due=text.match(/(?:scadenza|da\s+pagare\s+entro|fällig(?:keit)?|échéance)\s*[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
 const amountMatch=text.match(/(?:totale\s+(?:da\s+pagare|dovuto)|importo\s+(?:da\s+pagare|dovuto)|netto\s+(?:a\s+pagare|pagato)|nettolohn|net\s+à\s+payer|totale)\s*[:\s]*(EUR|CHF|€)?\s*([0-9][0-9.,'’\s]*[.,][0-9]{2})(?:\s*(EUR|CHF|€))?/i);
 let amount=null,currency='';if(amountMatch){let n=amountMatch[2].trim().replace(/[\s'’]/g,'');const decimal=Math.max(n.lastIndexOf(','),n.lastIndexOf('.'));n=n.slice(0,decimal).replace(/[.,]/g,'')+'.'+n.slice(decimal+1);amount=Number(n);currency=(amountMatch[1]||amountMatch[3]||'').replace('€','EUR');if(!Number.isFinite(amount))amount=null;}
 const issuer=text.match(/(?:emittente|fornitore|datore\s+di\s+lavoro|sostituto\s+d[’']?imposta|mittente|arbeitgeber|émetteur)\s*:\s*([^\n]{2,120})/i)?.[1]?.trim()||'';
 const explicitFiscalYear=text.match(/(?:anno\s+(?:di\s+)?(?:imposta|fiscale)|periodo\s+d[’']?imposta|steuerjahr|steuerperiode|période\s+fiscale|redditi\s+(?:relativi\s+all[’']?anno\s+|dell[’']?anno\s+|del\s+)?|anno\s+di\s+riferimento)\s*[:\s]*(20\d{2})/i)?.[1]||'';
 const payPeriod=text.match(/(?:periodo|mese|monat|période)\s*[:\s]*(0?[1-9]|1[0-2])[./-](20\d{2})/i);
 const cuYear=(text+' '+normalizedName).match(/(?:certificazione\s+unica|\bcu)\s*(20\d{2})/i)?.[1]||'';
 const documentYear=cuYear||(date?date.slice(0,4):'');
 const inferredFiscalYear=isCU&&!explicitFiscalYear&&!!cuYear;
 const fiscalYear=explicitFiscalYear||(inferredFiscalYear?String(Number(cuYear)-1):'');
 const year=(folder.startsWith('Fisco/')&&fiscalYear)||(folder==='Lavoro/Buste paga'&&payPeriod?.[2])||documentYear||text.match(/(?:anno|periodo|year|jahr)\s*[:\s]*(20\d{2})/i)?.[1]||'';
 const month=folder==='Lavoro/Buste paga'&&payPeriod?payPeriod[1].padStart(2,'0'):(date?date.slice(5,7):'');
 if(year&&folder!=='Da classificare'){folder+='/'+year;if(folder.startsWith('Lavoro/Buste paga')&&month)folder+='/'+month;}
 const missing=[];if(matches.length!==1)missing.push('tipo non univoco');if(!date)missing.push('data non rilevata');if(amount===null)missing.push('nessun importo totale univoco');if(!issuer)missing.push('emittente non rilevato');if(inferredFiscalYear)missing.push('anno fiscale stimato dal modello CU: verifica sui redditi');
 return {folder,date,documentYear,fiscalYear,inferredFiscalYear,dueDate:due?dateISO(due[1]):'',amount,currency,issuer,year,month,uncertain:missing.length>0,evidence:(matches.length===1?'Tipo riconosciuto: '+matches[0]+'. ':'')+(missing.length?'Da verificare: '+missing.join('; ')+'. ':'')+'Controlla originale, valuta e significato degli importi.'};
}
export async function renderPdf(bytes,container,onProgress=()=>{}){
 const token=job,pdf=await loadPdf(bytes.slice());
 try{for(let i=1;i<=Math.min(pdf.numPages,30);i++){if(token!==job||!container.isConnected)return;onProgress(`Anteprima pagina ${i}/${pdf.numPages}`);const page=await pdf.getPage(i),initial=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1.5,900/initial.width)}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.maxWidth='100%';container.append(canvas);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;page.cleanup();}if(pdf.numPages>30){const p=document.createElement('p');p.textContent='Anteprima limitata a 30 pagine. Scarica l’originale completo per le altre.';container.append(p);}}finally{await pdf.destroy();}
}
