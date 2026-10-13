# Contribuire

Apri una issue con browser, versione, URL del sito (senza token o credenziali), tipo di player, comportamento atteso e osservato. Non allegare contenuti protetti, cookie o URL firmati.

Prima di una pull request:

```sh
npm ci
npx playwright install chromium firefox
npm run check
```

Per una nuova strategia di rilevamento aggiungi casi con sigla, senza sigla e falsi positivi plausibili. Mantieni la logica nel motore puro quando possibile. Nessun salto senza click, richiesta di rete, telemetria o ampliamento dei permessi senza una motivazione esplicita nella proposta.

Documenta i siti realmente provati e distingui test simulati da player reali. Le traduzioni e i miglioramenti di accessibilità sono benvenuti.
