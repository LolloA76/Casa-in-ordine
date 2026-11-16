// Nessuna lettura o scrittura di localStorage/IndexedDB; nessuna cancellazione cache.
const RELEASE='3.0.2';
const button=document.getElementById('update'),status=document.getElementById('updateStatus');
function version(worker){return new Promise(resolve=>{if(!worker){resolve(null);return;}const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.release||null);};try{worker.postMessage({type:'GET_RELEASE'},[channel.port2]);}catch{clearTimeout(timer);channel.port1.close();resolve(null);}});}
button.onclick=async()=>{
 button.disabled=true;
 try{
 if(!isSecureContext||!('serviceWorker' in navigator))throw Error('Apri questa pagina con Chrome aggiornato e connessione HTTPS.');
 status.textContent='Scaricamento della nuova versione… Mantieni aperta questa pagina.';
 const base=new URL('./',location.href);
 const registration=await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});
 await registration.update();
 const deadline=Date.now()+90000;
 let ready=false;
 while(Date.now()<deadline){
 const waiting=registration.waiting;
 if(waiting){status.textContent='Attivazione della nuova versione, senza cancellare dati…';waiting.postMessage({type:'ACTIVATE_UPDATE'});}
 if(registration.active?.state==='activated'&&await version(registration.active)===RELEASE){ready=true;break;}
 await new Promise(resolve=>setTimeout(resolve,300));
 }
 if(!ready)throw Error('L’aggiornamento non è ancora pronto. Controlla Internet e riprova; i dati non sono stati cancellati.');
 status.textContent='Aggiornamento completato: versione '+RELEASE+'. Puoi aprire Casa in Ordine e usare la password esistente.';
 button.textContent='Apri Casa in Ordine';button.disabled=false;button.onclick=()=>location.replace(base.href);
 }catch(error){status.textContent='Aggiornamento non completato: '+error.message;button.disabled=false;}
};
