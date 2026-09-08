const root = document.querySelector("main");

if (root === null) {
  throw new Error("Renderer root element was not found");
}

root.dataset.walletApiVersion = window.walletApi.version;
