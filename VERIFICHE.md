# Verifica correzioni sessione e CU — 16 novembre 2026

37/37 gruppi riusciti, inclusi 22 controlli crittografici e di validazione.

- Crittografia, credenziali, recupero e validazione
- Configurazione, conferma chiave e isolamento localStorage
- Creazione e salvataggio cifrato di movimento, scadenza e voce fiscale
- Backup cifrato scaricabile e versione precedente disponibile
- Importazione malformata non cambia archivio
- Blocco manuale rimuove dati dal DOM e password errata non apre
- Ritorno dal background prima di 10 minuti senza nuova password
- Attività utente rinnova il timeout a 10 minuti
- Rientro oltre 10 minuti blocca anche con timer sospeso
- Salvataggio avviato resta valido durante un breve background
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
- CU: modello e anno fiscale distinti, anche con richiami al 730
- PDF scansito CU: OCR automatico e pulsante di riconoscimento ripetuto
- Importazione backup verificato con credenziale e conservazione precedente
- Sblocco non espone dati mentre la pagina è nascosta
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

Test locali su Chromium con dati fittizi. Tempi e background simulati. OCR reale su immagini e PDF scansiti fittizi, anche ripetuto dal pulsante. Nessun documento personale inviato a servizi esterni. Verifica fisica Android ancora necessaria. Le correzioni non sono pubblicate; migrazione utente ancora in attesa di conferma.
