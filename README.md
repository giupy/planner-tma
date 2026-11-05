# Planner – Mini App Telegram

Pagina statica di una Telegram Mini App privata. Si apre solo dal bottone del bot;
aperta direttamente mostra soltanto un avviso.

- Nessun dato salvato qui: i valori arrivano nel fragment (`#…`) dell'URL, che il browser non invia al server.
- Content-Security-Policy restrittiva, nessuno script inline, nessun tracker; unico script esterno: `telegram-web-app.js`.
- I dati sono trattati come non fidati (solo `textContent`); l'unico link esterno apribile è `paypal.me`.
