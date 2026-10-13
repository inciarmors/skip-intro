# Skip Intro

**La storia, senza attesa.** Un’estensione per Chrome e Firefox che mostra un pulsante **Skip intro** durante la sigla e porta il video alla sua fine, solo quando lo premi.

> **Stato: prototipo 0.1.0.** Il riconoscimento audiovisivo universale è l’obiettivo del progetto, non una funzione già disponibile. Questa versione usa capitoli, metadati espliciti e intervalli manuali. Non promette compatibilità con ogni servizio di streaming.

## Cosa funziona oggi

- Rilevamento di capitoli chiamati `Intro`, `Opening`, `Opening credits`, `Sigla`, `Générique` e altri nomi precisi.
- Lettura di metadati con intervalli espliciti della sigla.
- Pulsante sopra il video durante l’intervallo riconosciuto; nessun salto automatico.
- Impostazione manuale di inizio/fine, con i pulsanti **Segna inizio / Segna fine** o inserendo i secondi.
- Salvataggio locale per video, senza server, account, analytics o invio di audio/video.
- Player HTML5 aggiunti dinamicamente, navigazione SPA e iframe HTTP/HTTPS autorizzati.
- Scelta del player visibile principale quando la pagina contiene più video; fullscreen del contenitore del player.
- Popup per disattivare l’estensione e cancellare gli intervalli salvati.

## Installazione per sviluppo

Occorrono Node.js 22+ e npm. L’estensione distribuita non usa dipendenze runtime né codice remoto.

```sh
git clone https://github.com/inciarmors/skip-intro.git
cd skip-intro
npm ci
npm run build
```

**Chrome 120+**

1. Apri `chrome://extensions` e attiva **Modalità sviluppatore**.
2. Scegli **Carica estensione non pacchettizzata**.
3. Seleziona la cartella `dist/chrome`.
4. Ricarica le pagine video già aperte.

**Firefox 142+ desktop**

1. Apri `about:debugging#/runtime/this-firefox`.
2. Scegli **Carica componente aggiuntivo temporaneo**.
3. Seleziona `dist/firefox/manifest.json` e concedi l’accesso ai siti richiesti.
4. Ricarica le pagine video già aperte. Il caricamento temporaneo termina alla chiusura di Firefox.

Non è ancora pubblicata negli store. Per installare stabilmente su Firefox servirà la firma Mozilla.

## Provala

```sh
npm run demo
```

Apri `http://127.0.0.1:4173` con l’estensione caricata. **Genera video di prova** crea localmente una clip di 16 secondi, con una sigla tra i secondi 3 e 9. Premi **Vai alla sigla**, poi **Skip intro**: il video deve passare a 9 secondi.

Il laboratorio include pulsanti per togliere i capitoli, provare il salvataggio manuale e aprire il fullscreen del contenitore. Non scarica video da servizi esterni e non testa il riconoscimento audio.

Su una pagina senza capitoli, passa il mouse sul video e apri **Skip Intro · regola sigla**. Imposta inizio e fine (intervallo di 2–300 secondi). L’intervallo viene riutilizzato per quel video; non viene applicato automaticamente ad altri episodi della serie.

## Limiti da conoscere

- Senza capitoli o metadati, occorre indicare manualmente l’intervallo. Non c’è ancora un modello che ascolta o guarda la sigla.
- Il video deve esporre un elemento HTML5 `<video>`, una durata finita e un intervallo raggiungibile tramite `currentTime`. Dirette, player opachi, shadow DOM e pagine interne del browser non sono supportati.
- DRM e player personalizzati possono impedire l’accesso o il salto. Non vengono aggirate protezioni, accessi o abbonamenti. Netflix, Prime Video, Disney+ e altri servizi non sono stati certificati.
- Il fullscreen nativo dell’elemento `<video>` e Picture-in-Picture non consentono questo overlay DOM. Il fullscreen del contenitore è gestito.
- Gli intervalli manuali sono identificati dall’URL della pagina, sorgente, durata e indice del player. URL firmati che cambiano possono richiedere una nuova impostazione. Stream diversi sullo stesso URL, con stessa durata e stesso indice, non sono distinguibili: usa **Dimentica** se il sito riutilizza questi dati.
- Su pagine HTTP senza Web Crypto il salvataggio resta nella sessione. Gli iframe richiedono il permesso per il relativo dominio.
- La scansione dei player avviene ogni 500 ms nelle schede visibili. Il rilevamento dai capitoli dipende dalla loro disponibilità effettiva nel player.

## Sviluppo e verifiche

```sh
npx playwright install chromium firefox
npm run check
npm run package
```

`check` esegue test della logica, build, validazione del manifest Firefox e test del comportamento nei motori Chromium e Firefox. I test del comportamento controllano il tempo del video e simulano lo storage; un test aggiuntivo carica davvero l’estensione in Chromium e salta una clip generata nel browser. Il caricamento del componente Firefox e i player commerciali richiedono anche verifica manuale.

`package` genera `artifacts/skip-intro-chrome.zip` e `artifacts/skip-intro-firefox.zip` (usa il comando `zip`). Gli archivi Firefox non sono firmati. Le build e gli artefatti sono esclusi da Git e vengono allegati alle esecuzioni CI riuscite.

```text
extension/       Content script, motore di rilevamento, popup e manifest base
scripts/         Build per browser, packaging e server del laboratorio
demo/            Clip sintetica locale con capitoli
tests/           Test della logica e test browser
docs/            Architettura, roadmap e privacy
```

## Verso il riconoscimento automatico

La [roadmap](docs/ROADMAP.md) descrive i prossimi passi: adapter per player, identificazione di serie/episodio e confronto di impronte audio tra episodi. Sarà necessario misurare precisione, falsi positivi, costo e limiti di accesso ai flussi prima di proporlo come riconoscimento universale.

Consulta [architettura](docs/ARCHITECTURE.md), [privacy](docs/PRIVACY.md) e [come contribuire](CONTRIBUTING.md).

Licenza [MIT](LICENSE).
