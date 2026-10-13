# Privacy — versione 0.1.0

Skip Intro non invia dati a server, non usa analytics, non crea account e non registra audio o video. Il laboratorio genera una clip sintetica solo quando si preme il relativo pulsante.

L’estensione legge localmente URL, elementi video, durata, posizione di riproduzione, intervalli raggiungibili e tracce capitoli/metadati per decidere se mostrare il pulsante.

Nel profilo del browser salva l’impostazione di attivazione e gli intervalli inseriti dall’utente. Le chiavi degli intervalli sono hash SHA-256 dell’identità del video, inclusi URL e durata; non vengono salvati URL in chiaro. Un hash non garantisce anonimato rispetto a chi possiede il profilo e conosce possibili URL.

L’accesso ai siti HTTP/HTTPS permette al content script di funzionare sui diversi player e iframe. Puoi limitarlo con i controlli del browser, con conseguente riduzione della copertura. Non sono richiesti permessi per cookie, cronologia o cattura delle schede.

Puoi rimuovere un singolo intervallo con **Dimentica**, tutti gli intervalli dal popup oppure disinstallare l’estensione. I dati non usano `storage.sync`; non vengono sincronizzati dall’estensione tra dispositivi.

Le normali richieste del player e quelle avviate dal browser per caricare tracce del sito restano soggette alle politiche del sito e del browser. Le future funzioni di riconoscimento audiovisivo o catalogo condiviso dovranno aggiornare questa informativa prima di essere distribuite.
