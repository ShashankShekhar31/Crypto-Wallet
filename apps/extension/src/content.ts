const WALLET_MESSAGE_TYPE = "CRYPTO_WALLET_REQUEST";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }

  const message = event.data;

  if (message === null || typeof message !== "object" || message.type !== WALLET_MESSAGE_TYPE) {
    return;
  }

  chrome.runtime.sendMessage({
    type: WALLET_MESSAGE_TYPE,
    request: message.request,
  });
});
