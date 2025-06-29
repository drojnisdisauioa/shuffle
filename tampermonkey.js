// ==UserScript==
// @name         Conetic's Shuffle Script
// @version      1.0
// @description  t.me/coneticlarp
// @author       Conetic - https://t.me/coneticlarp
// @match        https://shuffle.com/*
// @grant        none
// ==/UserScript==

(() => {
  const COINS = { BTC: "bitcoin", ETH: "ethereum", LTC: "litecoin", USDT: "tether", SOL: "solana", DOGE: "dogecoin", BCH: "bitcoin-cash", XRP: "ripple", TRX: "tron", EOS: "eos", BNB: "binancecoin", USDC: "usd-coin", APE: "apecoin", BUSD: "binance-usd", CRO: "crypto-com-chain", DAI: "dai", LINK: "chainlink", SAND: "the-sandbox", SHIB: "shiba-inu", UNI: "uniswap", POL: "polygon", TRUMP: "trumpcoin" };

  const coinIds = Object.values(COINS).join(',');
  const API = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`;

  const prices = {}, seen = new Map(), converted = new WeakSet();

  const fetchPrices = async () => {
    try {
      const data = await (await fetch(API)).json();
      Object.entries(COINS).forEach(([symbol, coinId]) => {
        if (data[coinId]?.usd) {
          prices[symbol.toLowerCase()] = data[coinId].usd;
        }
      });
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    }
  };

  const getSymbol = t => (t.match(/([A-Z]{2,5})$/)?.[1] || '').toLowerCase();
  const getVal = input => {
    const v = parseFloat(input?.value);
    return isNaN(v) ? null : v;
  };
  const getUSD = text => {
    const m = text.match(/\$([0-9,]+\.?\d*)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : null;
  };

  const updateText = (el, text) => {
    el.textContent = text;
    converted.add(el);
    el.dataset.userConverted = 'true';
  };

  const convertAll = () => {
    document.querySelectorAll('div.CurrencyInput_labelBlock__zLnW_').forEach(block => {
      const output = block.querySelector('p.CurrencyInput_labelRight__f1nA6');
      const currency = getSymbol(output?.textContent || '');
      if (!output || !prices[currency]) return;

      // If already converted, don't update
      if (converted.has(output)) return;

      const input = block.closest('div')?.parentElement?.querySelector('input[type="number"]');
      const val = getVal(input);
      if (val == null) return;

      updateText(output, (val / prices[currency]).toFixed(8) + ' ' + currency.toUpperCase());
      output.dataset.last = val.toString();
    });

    document.querySelectorAll('div.MultiActionGameStats_multiplierRow__xdy_i').forEach(row => {
      const usdText = row.querySelector('.fiat-with-tool-tip-text')?.textContent;
      const usd = getUSD(usdText);
      if (!usd) return;

      let profitRow = row.nextElementSibling;
      while (profitRow && !profitRow.classList.contains('MultiActionGameStats_row__BkwCE')) {
        profitRow = profitRow.nextElementSibling;
      }
      if (!profitRow) return;

      const profitOutput = profitRow.querySelector('.fiat-with-tool-tip-text');
      if (!profitOutput) return;

      // If already converted, don't update
      if (converted.has(profitOutput)) return;

      const currencyMatch = profitOutput.textContent.match(/([A-Z]{2,5})$/);
      if (!currencyMatch) return;

      const currency = currencyMatch[1].toLowerCase();
      if (!prices[currency]) return;

      updateText(profitOutput, (usd / prices[currency]).toFixed(8) + ' ' + currency.toUpperCase());
      profitOutput.dataset.lastUSD = usd.toString();
    });
  };

  const updateCurrency = () => {
    document.querySelectorAll('img[src*="ARS.svg"]:not([data-processed])').forEach(img => {
      if (img.closest('ul[role="listbox"]')) return;
      img.src = img.src.replace('ARS.svg', 'USD.svg');
      img.alt = "USD";
      img.dataset.processed = "1";
      setTimeout(() => delete img.dataset.processed, 50);
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue;
      if (!/(ARS|USD)/.test(txt) || node.parentElement.closest('ul[role="listbox"]') ||
          node.parentElement?.dataset.userConverted) continue;

      const key = node.parentElement?.outerHTML + txt;
      if (seen.get(key) === txt) continue;

      const parent = node.parentElement;
      const inSpecial = parent.closest('#balance-button, .fiat-with-tool-tip-text, .cashoutOverlay_textContainer__JbjkH, [data-testid="cash-out"]');

      const newText = inSpecial ? txt.replace(/(ARS|USD)[\s\u00A0]?/g, "$") : txt.replace(/ARS/g, "USD");

      if (newText !== txt) {
        node.nodeValue = newText;
        seen.set(key, newText);
        setTimeout(() => seen.delete(key), 100);
      }
    }

    document.querySelectorAll('ul[role="listbox"] .fiat-with-tool-tip-text').forEach(el => {
      if (el.dataset.userConverted) return;
      const txt = el.textContent;
      if (txt?.includes('ARS')) {
        el.textContent = txt.replace(/ARS[\s\u00A0]?/g, "$");
      }
    });
  };

  const swapCurrency = () => {
    const usd = document.querySelector('[data-testid="USD"]');
    const ars = document.querySelector('[data-testid="ARS"]');
    if (!usd || !ars || usd.getAttribute('aria-selected') === 'true') return;
    usd.setAttribute('aria-selected', 'true');
    usd.setAttribute('tabindex', '0');
    usd.classList.add('ListBox_selectedItem__QJCrW');
    ars.setAttribute('aria-selected', 'false');
    ars.setAttribute('tabindex', '-1');
    ars.classList.remove('ListBox_selectedItem__QJCrW');
  };

  const hookInput = input => {
    if (!input || input.dataset.hooked) return;
    input.dataset.hooked = 1;

    const update = () => {
      document.querySelectorAll('[data-user-converted="true"]').forEach(el => {
        converted.delete(el);
        delete el.dataset.userConverted;
        delete el.dataset.last;
        delete el.dataset.lastUSD;
      });
      setTimeout(convertAll, 10);
    };

    ['input', 'change', 'keyup', 'paste'].forEach(evt => input.addEventListener(evt, update));

    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc?.set && !input._hooked) {
      input._hooked = true;
      Object.defineProperty(input, 'value', {
        set(v) { desc.set.call(this, v); update(); },
        get() { return desc.get.call(this); },
        configurable: true
      });
    }
  };

  let running = false;
  const process = () => {
    if (running) return;
    running = true;
    updateCurrency();
    swapCurrency();
    convertAll();
    document.querySelectorAll('input[type="number"]:not([data-hooked])').forEach(hookInput);
    running = false;
  };

  (async () => {
    await fetchPrices();
    updateCurrency();
    swapCurrency();
    setTimeout(process, 10);

    setInterval(fetchPrices, 60000);
    setInterval(() => { updateCurrency(); swapCurrency(); convertAll(); }, 500);

    new MutationObserver(mutations => {
      let arsChange = false, shouldProcess = false;

      for (const m of mutations) {
        if ((m.type === 'characterData' && /ARS/.test(m.target.nodeValue)) ||
            (m.type === 'attributes' && m.attributeName === 'src' && m.target.src?.includes('ARS'))) {
          arsChange = true;
          break;
        }
        if ((m.type === 'childList' && [...m.addedNodes].some(n => n.nodeType === 1)) ||
            (m.type === 'characterData' && /USD|\$|[0-9]/.test(m.target.nodeValue)) ||
            (m.type === 'attributes' && ['value', 'aria-selected'].includes(m.attributeName))) {
          shouldProcess = true;
        }
      }

      if (arsChange) {
        updateCurrency();
        swapCurrency();
        setTimeout(process, 10);
      } else if (shouldProcess) {
        setTimeout(process, 50);
      }
    }).observe(document.body, {
      childList: true, characterData: true, subtree: true, attributes: true,
      attributeFilter: ['src', 'alt', 'value', 'aria-selected']
    });
  })();
})();
