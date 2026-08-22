import type { WalletAccount } from "@crypto-wallet/shared-types";

import { loadConfig } from "@crypto-wallet/config";

export { health } from "./health.js";
export type { ApiHealth } from "./health.js";

export const config = loadConfig();

export type { WalletAccount };
