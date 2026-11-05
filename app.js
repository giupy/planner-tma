(function () {
  'use strict';

  var CHIAVI = ['v', 'n', 'pd', 'tt', 'ip', 'it', 'rm', 'pc', 'nx', 'pp', 'lp', 'cl', 'up', 'h'];
  var RE_NUM = /^\d{1,9}$/;
  var RE_DATA = /^\d{2}\/\d{2}\/\d{4}$/;
  var RE_PAYPAL = /^[A-Za-z0-9]{1,30}$/;

  // ---------- Parsing (nessun accesso al DOM) ----------

  function decodifica(s) {
    try {
      return decodeURIComponent(s.replace(/\+/g, '%2B'));
    } catch (e) {
      return '';
    }
  }

  // Divide su '&' e '?' e tiene solo le chiavi note (le altre, es. tgWebAppData, sono ignorate).
  function leggiCoppie(testo, out) {
    if (!testo) return;
    var parti = testo.split(/[&?]/);
    for (var i = 0; i < parti.length; i++) {
      var p = parti[i];
      var eq = p.indexOf('=');
      if (eq < 1) continue;
      var k = p.slice(0, eq);
      if (CHIAVI.indexOf(k) < 0) continue;
      if (Object.prototype.hasOwnProperty.call(out, k)) continue; // vince la prima occorrenza
      out[k] = decodifica(p.slice(eq + 1));
    }
  }

  function numero(s) {
    return typeof s === 'string' && RE_NUM.test(s) ? parseInt(s, 10) : 0;
  }

  function data(s) {
    return typeof s === 'string' && RE_DATA.test(s) ? s : '';
  }

  function leggiStorico(s) {
    var voci = [];
    if (typeof s !== 'string' || !s) return voci;
    var righe = s.split(',');
    for (var i = 0; i < righe.length && voci.length < 5; i++) {
      var m = /^(\d{2}\/\d{2}\/\d{4})_(\d{1,9})$/.exec(righe[i]);
      if (m) voci.push({ data: m[1], cent: parseInt(m[2], 10) });
    }
    return voci;
  }

  // Restituisce l'oggetto dati validato oppure null se la versione o i dati essenziali non vanno bene.
  function parseParams(hash, search) {
    var grezzo = {};
    var h = typeof hash === 'string' ? hash.replace(/^#/, '') : '';
    var s = typeof search === 'string' ? search.replace(/^\?/, '') : '';
    leggiCoppie(h, grezzo);
    leggiCoppie(s, grezzo); // riserva: stesse chiavi da location.search (non sovrascrive il fragment)

    if (grezzo.v !== '1') return null;
    var essenziali = ['pd', 'tt', 'ip', 'it', 'rm'];
    for (var i = 0; i < essenziali.length; i++) {
      if (typeof grezzo[essenziali[i]] !== 'string' || !RE_NUM.test(grezzo[essenziali[i]])) return null;
    }

    var pc = numero(grezzo.pc);
    if (pc > 100) pc = 100;
    var nome = (grezzo.n || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (nome.length > 80) nome = nome.slice(0, 80);
    var pp = typeof grezzo.pp === 'string' && RE_PAYPAL.test(grezzo.pp) ? grezzo.pp : '';

    return {
      nome: nome,
      pagato: numero(grezzo.pd),
      totale: numero(grezzo.tt),
      ratePagate: numero(grezzo.ip),
      rateTotali: numero(grezzo.it),
      residuo: numero(grezzo.rm),
      perc: pc,
      prossima: numero(grezzo.nx),
      paypal: pp,
      ultimo: data(grezzo.lp),
      inAttesa: numero(grezzo.cl),
      aggiornato: data(grezzo.up),
      storico: leggiStorico(grezzo.h)
    };
  }

  // Uso da Node per i test: nessun accesso al DOM, nessun globale.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseParams: parseParams };
    return;
  }

  // ---------- Presentazione ----------

  function euro(cent) {
    var intero = Math.floor(cent / 100);
    var dec = cent % 100;
    var s = String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return '€ ' + s + ',' + (dec < 10 ? '0' : '') + dec;
  }

  function euroPaypal(cent) {
    var dec = cent % 100;
    return Math.floor(cent / 100) + '.' + (dec < 10 ? '0' : '') + dec;
  }

  function el(tag, classe, testo) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo !== undefined) e.textContent = testo;
    return e;
  }

  function riga(etichetta, valore) {
    var r = el('div', 'riga');
    r.appendChild(el('span', 'etichetta', etichetta));
    r.appendChild(el('span', 'valore', valore));
    return r;
  }

  function messaggio(radice, titolo, testo) {
    var box = el('section', 'scheda centrata');
    box.appendChild(el('h1', '', titolo));
    box.appendChild(el('p', 'tenue', testo));
    radice.appendChild(box);
  }

  function disegna(radice, d, tg) {
    var saldato = d.residuo === 0;

    var testa = el('header', 'testa');
    testa.appendChild(el('h1', '', d.nome ? 'Ciao ' + d.nome : 'I tuoi pagamenti'));
    radice.appendChild(testa);

    var scheda = el('section', 'scheda');
    var barra = el('div', 'barra');
    var riempi = el('div', 'riempi');
    riempi.style.width = d.perc + '%';
    barra.appendChild(riempi);
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', '100');
    barra.setAttribute('aria-valuenow', String(d.perc));
    scheda.appendChild(barra);
    scheda.appendChild(el('p', 'sommario',
      'Pagato ' + euro(d.pagato) + ' su ' + euro(d.totale) + ' (rate ' + d.ratePagate + '/' + d.rateTotali + ')'));
    scheda.appendChild(riga('Residuo', euro(d.residuo)));
    if (d.ultimo) scheda.appendChild(riga('Ultimo pagamento', d.ultimo));
    if (!saldato && d.prossima > 0) scheda.appendChild(riga('Prossima rata', euro(d.prossima)));
    radice.appendChild(scheda);

    if (saldato) {
      var fine = el('section', 'scheda festa');
      fine.appendChild(el('p', '', '🎉 Tutto saldato, grazie!'));
      radice.appendChild(fine);
    } else if (d.inAttesa > 0) {
      radice.appendChild(el('section', 'scheda attesa',
        '⏳ Segnalazione da ' + euro(d.inAttesa) + ' in attesa di conferma'));
    }

    if (d.storico.length) {
      var st = el('section', 'scheda');
      st.appendChild(el('h2', '', 'Ultimi pagamenti'));
      var ul = el('ul', 'storico');
      for (var i = 0; i < d.storico.length; i++) {
        var li = el('li');
        li.appendChild(el('span', '', d.storico[i].data));
        li.appendChild(el('span', 'valore', euro(d.storico[i].cent)));
        ul.appendChild(li);
      }
      st.appendChild(ul);
      radice.appendChild(st);
    }

    var avviso = el('p', 'avviso');
    radice.appendChild(avviso);

    if (!saldato) {
      var azioni = el('div', 'azioni');

      if (d.paypal && d.prossima > 0) {
        var paga = el('button', 'bottone', '💳 Paga ' + euro(d.prossima));
        paga.type = 'button';
        paga.addEventListener('click', function () {
          // L'URL si costruisce solo da utente validato e importo numerico.
          var url = 'https://paypal.me/' + d.paypal + '/' + euroPaypal(d.prossima) + 'EUR';
          if (tg && typeof tg.openLink === 'function') tg.openLink(url);
          else avviso.textContent = 'Apri la pagina dentro Telegram per pagare.';
        });
        azioni.appendChild(paga);
      }

      if (d.inAttesa === 0) {
        var ho = el('button', 'bottone secondario', '✅ Ho pagato');
        ho.type = 'button';
        ho.addEventListener('click', function () {
          if (!tg || typeof tg.sendData !== 'function') {
            avviso.textContent = 'Usa /ho_pagato nella chat.';
            return;
          }
          var invia = function () {
            try {
              tg.sendData('hp');
            } catch (e) {
              avviso.textContent = 'Usa /ho_pagato nella chat.';
            }
          };
          if (typeof tg.showConfirm === 'function') {
            tg.showConfirm('Confermi di aver effettuato il pagamento?', function (ok) {
              if (ok) invia();
            });
          } else {
            invia();
          }
        });
        azioni.appendChild(ho);
      }
      radice.appendChild(azioni);
    }

    radice.appendChild(el('p', 'piede tenue',
      (d.aggiornato ? 'Aggiornato al ' + d.aggiornato + ' — ' : '') + 'scrivi /app al bot per aggiornare'));
  }

  function avvia() {
    // Prima di tutto: leggere l'hash (potrebbe essere modificato dopo).
    var hash = location.hash;
    var search = location.search;

    var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
      try { tg.ready(); } catch (e) { /* ignorato */ }
      try { tg.expand(); } catch (e) { /* ignorato */ }
    }

    var radice = document.getElementById('app');
    while (radice.firstChild) radice.removeChild(radice.firstChild);

    var d = parseParams(hash, search);
    if (!d) {
      messaggio(radice, 'Apri l’app dal bottone nella chat del bot',
        'Questa pagina funziona solo se aperta dal bottone del bot Telegram.');
      return;
    }
    disegna(radice, d, tg);
  }

  avvia();
})();
