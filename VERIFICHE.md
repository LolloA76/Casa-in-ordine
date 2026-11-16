# Verifica aggiornamento 3 — 16 novembre 2026

Eseguiti su Chromium headless, viewport smartphone, con profili isolati e dati fittizi. Nessun dato del telefono letto o trasferito.

Risultato: 33/33 gruppi di test riusciti, inclusi 22 controlli crittografici e di validazione.

- Crittografia, credenziali, recupero e validazione
- Configurazione, conferma chiave e isolamento localStorage
- Creazione e salvataggio cifrato di movimento, scadenza e voce fiscale
- Backup cifrato scaricabile e versione precedente disponibile
- Importazione malformata non cambia archivio
- Blocco manuale rimuove dati dal DOM e password errata non apre
- Blocco immediato su visibilitychange e nessuno sblocco tardivo
- Blocco dopo 5 minuti con orologio simulato
- Errore scrittura non modifica archivio o conferma un salvataggio
- Conflitto tra scritture e transazione abortita conservano la copia valida
- Recupero dalla schermata con nuova password
- Migrazione conserva integralmente originale e dati fiscali
- Classificazione locale, date, CHF e importi separati dai pagamenti
- PDF riconosciuto localmente e archiviato solo dopo conferma
- File identico rilevato senza duplicazione
- Cartelle rinominabili, ricerca e collegamento esplicito
- Backup include file, metadati e collegamenti cifrati
- Cambio password autenticato mantiene documenti e recupero
- OCR reale su immagine fittizia e nessun invio esterno
- Importazione backup verificato con credenziale e conservazione precedente
- Sblocco interrotto dal background non espone dati al termine
- CSV esportato cifrato, leggibile con password e rimosso al blocco
- Offline: ricaricamento, accesso e salvataggio senza rete
- OCR e PDF disponibili offline dopo preparazione esplicita
- Selezione di un documento durante il blocco attende lo sblocco
- Migrazione rifiuta anomalie senza alterare la sorgente
- Ripristino da schermata bloccata include documenti e collegamenti
- Backup con file incoerente rifiutato senza sostituire archivio
- Migrazione concorrente si arresta senza scrivere o cancellare dati
- Recupero da vecchio JSON su browser nuovo senza alterare localStorage
- Aggiornamento reale da vecchio service worker, stessa origine e archivio
- Nessuna richiesta a servizi esterni
- Nessun errore JavaScript non gestito

Controllati anche sintassi JavaScript, diff senza errori di spaziatura e identità dei file manifest e icone rispetto alla revisione originale. npm audit delle dipendenze di riconoscimento non ha segnalato vulnerabilità note al momento della verifica; non equivale a un audit indipendente.

Il test del tempo usa orologio simulato; il passaggio in background e il selettore dei file sono simulati. La transizione dalla versione pubblicata è riprodotta su un server locale con il vecchio service worker, poi con i nuovi file sulla stessa origine e con lo stesso localStorage. Non è una pubblicazione reale.

Restano da confermare su Android: prestazioni e memoria, selettori/download reali, sospensione e riavvio, blocco in background, aggiornamento della PWA installata e anteprime delle app recenti. Limiti implementati: 8 MB/file, 20 MB di originali complessivi, OCR prime 20 pagine e anteprima prime 30. Nessun servizio AI esterno.

Il vecchio localStorage è intenzionalmente intatto e non cifrato: la nuova UI richiede password, ma la rimozione futura della copia originale richiederà un consenso separato dopo verifica dei backup. Nessuna pubblicazione o push eseguiti.
