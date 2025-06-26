(() => {
  const PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,litecoin,solana&vs_currencies=usd';
  const CURRENCY_BLOCK = 'div.CurrencyInput_labelBlock__zLnW_';
  const prices = {}, seenTexts = new Map();

  const fetchPrices = async () => {
    try {
      const res = await fetch(PRICE_API);
      const data = await res.json();
      Object.assign(prices, {
        eth: data.ethereum?.usd || 0,
        btc: data.bitcoin?.usd || 0,
        ltc: data.litecoin?.usd || 0,
        sol: data.solana?.usd || 0
      });
    } catch {}
  };

  const extractSymbol = t => (t.match(/([A-Z]{2,5})$/)?.[1] || '').toLowerCase();
  const getInputValue = input => {
    const val = parseFloat(input?.value);
    return isNaN(val) ? null : val;
  };

  const convertAll = () => {
    document.querySelectorAll(CURRENCY_BLOCK).forEach(block => {
      const output = block.querySelector('p.CurrencyInput_labelRight__f1nA6');
      const currency = extractSymbol(output?.textContent || '');
      if (!output || !prices[currency]) return;
      const input = block.closest('div')?.parentElement?.querySelector('input[type="number"]');
      const val = getInputValue(input);
      if (val == null) return;
      output.textContent = (val / prices[currency]).toFixed(8) + ' ' + currency.toUpperCase();
    });
  };

  const hookInput = input => {
    if (!input || input.dataset.hooked) return;
    input.dataset.hooked = 1;

    const update = () => convertAll();
    new MutationObserver(update).observe(input, { attributes: true, attributeFilter: ['value'] });
    ['input', 'change'].forEach(evt => input.addEventListener(evt, update));

    const original = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (original) {
      Object.defineProperty(input, 'value', {
        set(v) {
          original.call(this, v);
          update();
        }
      });
    }
  };

  const hookAllInputs = () => {
    document.querySelectorAll('input[type="number"]:not([data-hooked])').forEach(hookInput);
  };

  const updateCurrencyText = (root = document.body) => {
    root.querySelectorAll('img[src*="ARS.svg"]:not([data-processed])').forEach(img => {
      if (img.closest('ul[role="listbox"]')) return;
      img.src = img.src.replace('ARS.svg', 'USD.svg');
      img.alt = "USD";
      img.dataset.processed = "1";
      setTimeout(() => delete img.dataset.processed, 50);
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue;
      if (!/(ARS|USD)/.test(txt)) continue;
      if (node.parentElement.closest('ul[role="listbox"]')) continue;
      const key = node.parentElement?.outerHTML + txt;
      if (seenTexts.get(key) === txt) continue;

      const parent = node.parentElement;
      const inBalance = parent.closest('#balance-button');
      const inTooltip = parent.closest('.fiat-with-tool-tip-text');
      const inCashoutOverlay = parent.closest('.cashoutOverlay_textContainer__JbjkH');
      
      const newText = (inBalance || inTooltip || inCashoutOverlay)
        ? txt.replace(/(ARS|USD)[\s\u00A0]?/g, "$")
        : txt.replace(/ARS/g, "USD");

      if (newText !== txt) {
        node.nodeValue = newText;
        seenTexts.set(key, newText);
        setTimeout(() => seenTexts.delete(key), 100);
      }
    }

    root.querySelectorAll('ul[role="listbox"] .fiat-with-tool-tip-text').forEach(element => {
      const txt = element.textContent;
      if (txt && txt.includes('ARS')) {
        element.textContent = txt.replace(/ARS[\s\u00A0]?/g, "$");
      }
    });
  };

  const swapCurrencySelection = () => {
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

  let running = false;
  const process = () => {
    if (running) return;
    running = true;
    updateCurrencyText();
    swapCurrencySelection();
    convertAll();
    hookAllInputs();
    running = false;
  };

  (async () => {
    await fetchPrices();
    process();
    setInterval(fetchPrices, 60000);
    setInterval(process, 500);
    new MutationObserver(mutations => {
      for (const m of mutations) {
        if (
          (m.type === 'childList' && [...m.addedNodes].some(n => n.nodeType === 1)) ||
          (m.type === 'characterData' && /ARS|USD/.test(m.target.nodeValue)) ||
          (m.type === 'attributes' && m.attributeName === 'src' && m.target.src?.includes('ARS'))
        ) {
          process();
          break;
        }
      }
    }).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'alt', 'value', 'aria-selected']
    });
  })();
})();
