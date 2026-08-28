---
description: Imposta i parametri AnyTXT (porta, cartella default, limit, estensioni) nel .env di OpenCode
---

Imposta o modifica i parametri di configurazione AnyTXT su richiesta dell'utente. Chiedi all'utente quali valori cambiare se non li ha specificati, poi modifica il file .env DEL PROGETTO (cwd della sessione) con il tool edit: aggiungi o aggiorna SOLO le chiavi AnyTXT elencate, senza toccare le altre righe esistenti (es. chiavi API). Se il progetto non ha un .env, crealo lì; il .env globale ~/.config/opencode/.env si usa solo quando quello del progetto non esiste. Se il file non esiste, crealo.

Chiavi disponibili:
- ANYTXT_PORT=9920 — porta ATGUI; vuoto = prova sia 9920 che 9921.
- ANYTXT_URL= — URL completo alternativo (vince su ANYTXT_PORT).
- ANYTXT_DIR= — cartella di ricerca default; vuoto = tutte le cartelle indicizzate.
- ANYTXT_LIMIT=5 — risultati per richiesta.
- ANYTXT_FILTER_EXT=* — filtro estensioni, es. "pdf;docx".
- ANYTXT_ORDER=0 — ordinamento: 0 default, 1 ultima modifica ASC, 2 DESC.

Il plugin rilegge il .env a ogni chiamata: nessun riavvio necessario. Dopo la modifica, conferma all'utente i valori attivi.
