# Casa in Ordine — versione 3 e correzioni in revisione

La versione iniziale 3 (commit 4557a57) è pubblicata. Le correzioni successive a sessione e riconoscimento CU sono sviluppate e testate localmente sul ramo `sviluppo-sicurezza-documenti`, in attesa della conferma alla pubblicazione. I test usano soltanto dati fittizi.

## Avvio e test locali

- `python serve.py`, poi http://127.0.0.1:8765. Il server è vincolato al solo computer locale; nessun Cloudflare o secondo sito.
- `node tests/run.cjs` con Node, Playwright e Chromium disponibili. La suite usa un server locale sulla porta 8776 e profili temporanei con dati inventati. Non tocca gli archivi di altri browser.
- Risultati automatici in `tests/results.json` (ignorato da Git). PDF e immagini di test sono generati durante l'esecuzione, senza documenti personali.

## Un'unica applicazione ufficiale

La distribuzione futura manterrà URL, manifest, id, start_url, scope e icone esistenti. Non occorre disinstallare la PWA Android. Il nuovo service worker ha una cache distinta, non elimina quelle precedenti, non cancella dati e non forza l'aggiornamento di una scheda in uso. Per completare l'aggiornamento occorrerà chiudere tutte le vecchie finestre dell'app e riaprirla con Internet disponibile. Non cancellare dati del sito o del browser.

Le correzioni descritte in revisione non sono ancora pubblicate. La migrazione sul telefono resta da confermare esplicitamente dal proprietario; gli originali non vengono cancellati.

## Password e cifratura

Tutto il nuovo archivio, inclusi file, titoli, cartelle, testo OCR, impronte e collegamenti, viene cifrato prima di essere scritto in IndexedDB (`casa-in-ordine-secure-v1`). AES-256-GCM con IV casuale nuovo a ogni cifratura, chiave archivio casuale di 256 bit e dati aggiuntivi autenticati distinti per uso. Password derivata con PBKDF2-HMAC-SHA-256 a 600.000 iterazioni, con sale casuale di 128 bit; nessuna password salvata o inviata in rete. Chiave operativa Web Crypto non esportabile.

La chiave di emergenza casuale di 256 bit protegge una seconda copia cifrata della chiave archivio. Deve essere trascritta e confermata. Consente di reimpostare la password. Dati e backup sono irrecuperabili se si perdono sia password sia chiave; la chiave senza archivio/backup non ricrea i dati. Cambio password con verifica della password corrente; recupero con chiave tramite schermata di accesso. Esportare un nuovo backup dopo il cambio. Vecchi backup restano leggibili con le credenziali della loro creazione; non esiste revoca retroattiva dei file già esportati.

Blocco dopo dieci minuti dall’ultima attività, contando anche il tempo in background. Tornare in primo piano non rinnova il tempo; un’interazione sì. Il blocco manuale è immediato. Ricaricamento, chiusura completa o terminazione dell’app da Android richiedono un nuovo sblocco: la sessione rimane soltanto in memoria. Al blocco vengono rimossi schermate, moduli e anteprime, revocati URL blob e fermato l'OCR; nessun risultato crittografico tardivo può riaprire la sessione. JavaScript non può garantire l'azzeramento fisico di tutte le copie di memoria, né impedire ogni screenshot nell'elenco delle app recenti di Android. Malware, estensioni malevole o codice del sito compromesso mentre si sblocca l'archivio non sono neutralizzati dalla cifratura.

## Prima della pubblicazione: proteggere i dati attuali

1. Sul telefono attuale aprire Dati e backup della versione ufficiale e usare Esporta backup JSON.
2. Controllare che il file esista, non sia vuoto e contenga le raccolte attese; conservarne una copia in una posizione protetta fuori dal telefono. Il vecchio JSON non è cifrato dall'app: non caricarlo su GitHub o in chat.
3. Annotare i conteggi e alcuni totali per confrontarli dopo l'aggiornamento.
4. Non disinstallare l'app, non cancellare dati del browser, non cambiare profilo o indirizzo del sito.
5. Confermare la pubblicazione solo dopo il controllo del backup. Tutti i test qui effettuati usano dati fittizi: il contenuto reale del telefono non è stato letto.

## Migrazione conservativa

Alla prima apertura viene rilevata in sola lettura la chiave `casa_in_ordine_v1`. In alternativa è possibile selezionare un vecchio backup JSON, letto soltanto al momento di preparare l'archivio con la password. Non vengono mostrati dati finanziari prima della configurazione della password.

La procedura:

1. Legge una copia, valida movimenti, scadenze, dati fiscali e categorie; rifiuta anomalie senza scartare registrazioni.
2. Mantiene il JSON sorgente integralmente anche nella nuova copia cifrata (`legacyOriginal`) e conserva i campi aggiuntivi. Aggiunge soltanto valori neutri a campi opzionali assenti dei vecchi formati.
3. Cifra, riapre e confronta integralmente la nuova struttura prima di attivarla; mostra i conteggi dopo l'inserimento della password.
4. Richiede download e conferma di conservazione del backup cifrato completo e trascrizione della chiave di emergenza. Il browser può avviare il download, ma non può provare che sia stato conservato fuori dal telefono.
5. Controlla che il localStorage non sia cambiato nel frattempo, poi scrive in una transazione atomica nel nuovo IndexedDB e verifica rileggendo il contenuto salvato.
6. Non usa removeItem, clear, deleteDatabase o scritture sul vecchio localStorage. In caso di errore l'originale resta disponibile.

**Limite essenziale:** per rispettare la richiesta di non cancellare o sovrascrivere l'originale, il vecchio archivio rimane NON cifrato nel localStorage. La nuova interfaccia richiede password, ma strumenti del browser, codice della stessa origine o malware possono ancora leggere quella copia. L'app lo segnala dopo lo sblocco. La completa protezione a riposo richiederà in seguito una decisione esplicita e separata sulla vecchia copia, dopo verifica dei backup. Non tornare a inserire dati nella vecchia versione: gli archivi non si sincronizzano.

## DOCUMENTI

Caricamento dal telefono di PDF, JPEG, PNG, WebP e altri file. PDF e immagini supportati hanno anteprima locale; gli altri formati sono archiviabili e scaricabili dopo sblocco, senza promessa di riconoscimento o anteprima. Il PDF viene disegnato su canvas con PDF.js: non esegue JavaScript incorporato e non apre automaticamente collegamenti. Non è una bonifica antivirus degli allegati.

Il riconoscimento parte automaticamente per i nuovi documenti:

- testo selezionabile dei PDF letto localmente;
- pagine scansite e fotografie elaborate con Tesseract/WASM sul dispositivo;
- italiano predefinito; tedesco, francese e inglese selezionabili;
- regole locali propongono tipo, cartella, anno/mese, data, scadenza, importo, valuta e mittente quando riconoscibili;
- ogni proposta richiede controllo e conferma prima dell'archiviazione; in caso di errore è disponibile la compilazione manuale;
- classificazione correggibile, cartelle/sottocartelle creabili e rinominabili, ricerca su metadati e testo OCR;
- SHA-256 per file identici, avviso su possibili duplicati con stesso mittente/data/importo/valuta; nessuna fusione automatica;
- collegamenti espliciti a movimenti, scadenze e voci fiscali; documenti collegati visibili anche nelle sezioni corrispondenti e riepilogo in Home;
- proposte di scadenza e pagamento aprono i moduli da controllare e salvare; nessun movimento automatico. La data effettiva del pagamento va inserita, non viene ricavata implicitamente dalla data della fattura.

Le regole sono volutamente conservative: non equivalgono a un commercialista o a un modello AI che comprende qualsiasi impaginazione. Mittenti non etichettati, date senza anno, documenti multilingue, più importi, grafia manuale e fotografie scadenti possono richiedere correzioni. In presenza di più tipologie il documento resta da classificare. L'OCR usa una lingua alla volta. Un importo sul documento non dimostra un pagamento e non va sempre contabilizzato (esempio: lordo vs netto di una busta paga).

I documenti distinguono CHF, EUR e valuta da verificare. La contabilità originale resta in EUR: le proposte in CHF o con valuta incerta non diventano automaticamente movimenti EUR. Nessuna conversione implicita.

## Dimensioni e offline

Questa versione usa un archivio cifrato unico comprendente i file codificati in base64; non un sistema illimitato a blocchi. Limite iniziale prudenziale: **8 MB per file e 20 MB di originali complessivi**, massimo 500 documenti. Base64, testo OCR, cifratura, backup e copia precedente richiedono spazio aggiuntivo e possono occupare molta memoria durante una scrittura. Questi limiti devono essere confermati sul telefono; non aumentare i limiti senza prove. I grandi archivi richiederanno un'evoluzione con file cifrati a blocchi e backup progressivi.

Riconoscimento PDF limitato alle prime 20 pagine, anteprima alle prime 30; l'originale completo viene conservato. Limite testo OCR: 150.000 caratteri. Immagini ridimensionate soltanto in memoria per l'OCR; l'originale non viene modificato. Un'immagine di oltre 40 megapixel non viene elaborata automaticamente.

Quota locale stimata prima del caricamento, salvataggi atomici, segnalazione degli errori, richiesta di memoria persistente disponibile nelle impostazioni. Lo spazio concesso dipende dal browser; la persistenza non garantisce protezione da cancellazioni manuali, perdita o guasti.

Il pulsante Prepara riconoscimento offline scarica dal sito circa 27 MB di librerie e modelli, senza inviare documenti. Usare Wi-Fi se necessario. Non c'è alcun servizio OCR/AI a consumo. Le risorse sono vendorizzate, non caricate da CDN durante l'uso; consultare vendor/NOTICE.md per versioni e licenze. Dopo la preparazione il riconoscimento funziona senza rete. Nessun conto corrente, API bancaria, account esterno o abbonamento.

Il selettore dei file di Android può mandare la pagina in background: l'app si blocca e mantiene solo il file selezionato, senza elaborarlo, finché non viene sbloccata nuovamente. Questo comportamento è simulato nella suite ma richiede conferma su Android reale.

## Backup e ripristino

Backup completo `.casa`, cifrato e autenticato, contenente contabilità, fisco, cartelle, originali e testo dei documenti, collegamenti e copia sorgente della migrazione. Formato `casa-in-ordine-vault`, versione 1, struttura dati schema 3; il backup sperimentale della vecchia prova è un formato diverso e non viene importato implicitamente.

Ripristino disponibile anche dalla schermata bloccata o su un browser nuovo, usando password del backup o chiave di emergenza. Verifica dell'intero modello, cifratura e impronte dei file prima della conferma e dell'attivazione. Una versione cifrata precedente viene conservata atomicamente, esportabile anche prima dello sblocco; non è uno storico illimitato e non protegge dalla perdita del dispositivo. Gli errori non vengono presentati come salvataggi riusciti. Confronto atomico dell'archivio atteso e notifiche tra schede impediscono sovrascritture concorrenti.

CSV dei movimenti esportato soltanto cifrato, con password separata e protezione dalle formule; leggibile tramite il lettore locale. Non si apre direttamente in Excel e non sostituisce il backup completo.

Scaricare l'originale di un documento è invece un'azione esplicita con avviso: crea un file NON cifrato in Download. Anche i file già presenti in Foto/Download, le foto sincronizzate nel cloud e i vecchi backup non vengono cifrati o cancellati dall'app.

## Verifiche Android da completare prima di considerare concluso il collaudo

- Tempi di sblocco/PBKDF2 e OCR su telefono reale, consumo memoria con più PDF e batteria.
- Dieci minuti reali di inattività, cambio app, spegnimento schermo, chiusura forzata e riapertura dalla stessa icona.
- Download, selettori file, conferma chiave e ripristino in presenza dei passaggi in background.
- Foto reali ma fittizie per il contenuto, orientamento, grandi immagini, lingue e PDF scansiti.
- Conferma su Android dell’aggiornamento dalla versione 2.1 tramite service worker, senza disinstallare né cancellare dati. La transizione viene anche simulata automaticamente su Chromium con il vecchio service worker e la stessa origine locale.
- Disponibilità offline dopo riavvio, limiti della quota di memoria e archivi vicini ai limiti.
- Controllo delle anteprime Android recenti: il browser non offre le stesse garanzie di un'app nativa.

Non è stato effettuato un audit crittografico indipendente. Il passaggio del sito ufficiale sarà autorizzato separatamente; la suite automatica non sostituisce il collaudo sul dispositivo.

## Correzioni di sessione e riconoscimento CU

La sessione dura dieci minuti dall’ultima interazione, anche in background; ritorno e focus non rinnovano il tempo. Verifica della scadenza al rientro anche se Android ha sospeso i timer. Blocco manuale immediato; sessione soltanto in RAM, senza persistenza della password. Se Android termina il processo, serve nuovo accesso. Anche un salvataggio avviato prima di un breve passaggio in background può completarsi con la sessione ancora valida.

La CU ha una regola dedicata, che non viene confusa da richiami alle istruzioni del 730. Campi distinti per anno documento/modello, anno fiscale/redditi e anno archivio. Esempio: CU 2026, redditi 2025 → Fisco/Certificazioni Uniche/2025. Se manca l’anno dei redditi, quello precedente al modello è solo una stima esplicitamente da confermare. Importi o emittenti non individuati con chiarezza restano da verificare, senza impedire una proposta di cartella.

Il pulsante Riconosci sul dispositivo mostra subito l’avvio, rimane disabilitato durante l’elaborazione e restituisce caratteri letti, tipo individuato e campi mancanti. Opzione Forza OCR sul PDF per ignorare testo selezionabile incompleto; aumenta tempi e consumi. Nessun salvataggio delle nuove proposte senza conferma. Metadati aggiuntivi opzionali e compatibili con i backup esistenti.
