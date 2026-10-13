# Architettura

Manifest V3, senza background worker né backend. Il content script viene eseguito negli iframe HTTP/HTTPS autorizzati; ogni frame gestisce il proprio player principale. `core.js` contiene funzioni pure condivise con i test. `content.js` gestisce DOM, storage e interazione.

## Rilevamento

Precedenza: intervallo manuale del video → attributi espliciti → capitoli/metadati. Il primo intervallo valido diventa il candidato. Il pulsante compare solo nell’intervallo `[start, end)`; il click verifica nuovamente durata e `seekable`, quindi assegna `video.currentTime = end`. Lo stato di pausa/riproduzione rimane quello scelto dall’utente.

Vengono accettati intervalli finiti di 2–300 secondi, compresi nella durata del contenuto. Sottotitoli e testi generici sulla pagina non vengono interpretati come sigle. Le tracce capitoli disabilitate vengono rese `hidden` per caricare i cue e ripristinate quando si cambia player o si disattiva l’estensione; i sottotitoli non vengono modificati.

Un player cooperante può esporre:

```html
<video data-skip-intro-start="42" data-skip-intro-end="128"></video>
```

Oppure un cue WebVTT in una traccia `chapters`:

```vtt
WEBVTT

00:00:42.000 --> 00:02:08.000
Sigla
```

Oppure un cue in una traccia `metadata` con testo JSON:

```json
{"type":"intro","start":42,"end":128}
```

Questi sono contratti supportati dal prototipo, non metadati che tutti i servizi espongono. I valori sono sempre validati; nessun testo della pagina viene inserito come HTML.

## Stato e dati

Lo storage locale contiene `enabled` e chiavi `intro:<sha256>`, ciascuna con `{start, end}`. L’hash è calcolato su URL completo della pagina, sorgente media, durata arrotondata al decimo e indice del video. Gli URL `blob:` sono sostituiti con un marcatore stabile; i flussi privi di una sorgente leggibile usano la stessa strategia.

Il cambio di identità azzera l’intervallo, i controlli e l’inizio manuale provvisorio. Un contatore impedisce a letture asincrone di un video precedente di aggiornare il nuovo player. Gli hash non costituiscono anonimizzazione e possono essere confrontati con URL noti; rimangono comunque nel browser.

## Integrazione e UI

L’overlay usa Shadow DOM per isolare gli stili. Viene ancorato al rettangolo del video o spostato nel contenitore fullscreen. Si mostra durante la sigla o quando l’utente passa sul video; resta visibile durante l’impostazione manuale. Un controllo periodico intercetta sostituzioni del player e navigazioni SPA senza modificare il codice del sito.

I permessi su HTTP/HTTPS servono a offrire la funzionalità su domini e iframe diversi. L’unica API privilegiata richiesta è `storage`. Non servono accesso a cookie, cronologia, acquisizione tab, download o intercettazione di rete.

## Riferimenti ufficiali

- [Chrome: content scripts e iframe](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Mozilla: impostazioni specifiche del browser e dichiarazione raccolta dati](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
