interface WalletApi {
  readonly version: string;
}

interface Window {
  readonly walletApi: WalletApi;
}
