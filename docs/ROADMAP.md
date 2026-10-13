# Roadmap

## 0.1 — Prototipo verificabile

- [x] Manifest V3 per Chrome e Firefox.
- [x] Player HTML5, capitoli e intervalli espliciti.
- [x] Pulsante Skip intro al click e impostazione manuale locale.
- [x] Laboratorio riproducibile, test e CI.
- [ ] Verifica manuale su una matrice di siti reali e versioni browser.

## 0.2 — Copertura dei player

- [ ] Adapter isolati per player che espongono già marker intro; selezionarli dopo una verifica sui siti obiettivo.
- [ ] Identità stabile di serie, stagione ed episodio, evitando confusione con trailer e pubblicità.
- [ ] Supporto a player in shadow root aperte e miglioramento accessibilità dei controlli manuali.
- [ ] Miglioramento fullscreen/Picture-in-Picture dove le API del browser lo consentono.
- [ ] Icone definitive, verifica privacy e pubblicazione negli store.

## Ricerca — Sigle senza metadati

- [ ] Costruire un corpus di clip utilizzabili per i test, con confini annotati e casi difficili: recap, cold open, sigle variabili, versioni brevi, doppiaggi e montaggi diversi.
- [ ] Valutare impronte audio locali per trovare sequenze ripetute tra episodi, misurando errore sui confini e falsi positivi prima di mostrare il pulsante.
- [ ] Valutare segnali visivi come supporto al riconoscimento, con un budget CPU/memoria misurato.
- [ ] Verificare separatamente accesso ai flussi, CORS, DRM e necessità di consenso/permessi di acquisizione: l’analisi non è sempre tecnicamente disponibile.
- [ ] Definire fallback e soglie conservative. Una sequenza musicale, da sola, non prova che sia una sigla.

Il primo episodio visto, una nuova sigla o un flusso non analizzabile richiederanno comunque una fonte affidabile o una conferma manuale. Non promettiamo copertura del 100% dei siti.

Un eventuale catalogo condiviso sarebbe un progetto separato, con consenso, moderazione e una nuova valutazione privacy. Il prototipo attuale non contatta alcun catalogo.
