function updateCurrencyText(root = document.body) {
  // Replace ARS flag image with USD flag image
  const imgs = root.querySelectorAll('img[src="/icons/fiat/ARS.svg"]');
  imgs.forEach(img => {
    img.src = "/icons/fiat/USD.svg";
    img.alt = "USD";
  });

  // Walk all text nodes
  const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode;
  while (currentNode = treeWalker.nextNode()) {
    let text = currentNode.nodeValue;

    const isInBalanceButton = currentNode.parentElement.closest('#balance-button') !== null;
    const isInFiatTooltip = currentNode.parentElement.closest('.fiat-with-tool-tip-text') !== null;

    if (text.includes("ARS") || text.includes("USD")) {
      if (isInBalanceButton || isInFiatTooltip) {
        // Replace ARS or USD + space/nbsp with $
        currentNode.nodeValue = text.replace(/(ARS|USD)[\s\u00A0]?/g, "$");
      } else {
        // Replace ARS with USD elsewhere
        currentNode.nodeValue = text.replace(/ARS/g, "USD");
      }
    }
  }
}

// Initial run
updateCurrencyText();

// Observe DOM for any changes
const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          updateCurrencyText(node);
        }
      });
    } else if (mutation.type === 'characterData') {
      updateCurrencyText(mutation.target.parentElement || document.body);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  characterData: true,
  subtree: true
});
