import { contextBridge } from "electron";

const walletApi = Object.freeze({
  version: "0.1.0",
});

contextBridge.exposeInMainWorld("walletApi", walletApi);
