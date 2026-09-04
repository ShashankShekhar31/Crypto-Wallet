import { useEffect, useRef, useState } from "react";

import { QRCodeSVG } from "qrcode.react";

import {
  EsploraBitcoinProvider,
  getBitcoinTransactionExplorerUrl,
} from "@crypto-wallet/chain-core";

import {
  createWallet,
  type BitcoinSendPreview,
  type BitcoinSignedTransaction,
  type WalletSession,
} from "@crypto-wallet/wallet-core";

import { LocalStorageSecureStorageAdapter } from "@crypto-wallet/secure-storage";

type Screen =
  "checking" | "create" | "backup" | "unlock" | "dashboard" | "receive" | "send" | "send-confirm";

type DashboardAsset = {
  symbol: string;
  name: string;
  chain: string;
  balance: string;
  value: string;
};

type DashboardActivity = {
  title: string;
  description: string;
  status: string;
  time: string;
};

const dashboardAssets: DashboardAsset[] = [];

const dashboardActivity: DashboardActivity[] = [];

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

function createSession(): WalletSession {
  return createWallet(new LocalStorageSecureStorageAdapter(), {
    inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS,
  });
}

export default function App() {
  const sessionRef = useRef<WalletSession | null>(null);

  const [screen, setScreen] = useState<Screen>("checking");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [mnemonic, setMnemonic] = useState<string | null>(null);

  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [isBusy, setIsBusy] = useState(false);

  const [receiveNetwork, setReceiveNetwork] = useState<"bitcoin-mainnet" | "bitcoin-testnet">(
    "bitcoin-mainnet",
  );

  const [receiveAddress, setReceiveAddress] = useState<string | null>(null);

  const [isLoadingReceiveAddress, setIsLoadingReceiveAddress] = useState(false);

  const [copiedAddress, setCopiedAddress] = useState(false);

  const [sendNetwork, setSendNetwork] = useState<"bitcoin-mainnet" | "bitcoin-testnet">(
    "bitcoin-mainnet",
  );

  const [sendRecipient, setSendRecipient] = useState("");

  const [sendAmount, setSendAmount] = useState("");

  const [sendPreview, setSendPreview] = useState<BitcoinSendPreview | null>(null);

  const [signedTransaction, setSignedTransaction] = useState<BitcoinSignedTransaction | null>(null);

  const [isLoadingSendPreview, setIsLoadingSendPreview] = useState(false);

  const [isSigningTransaction, setIsSigningTransaction] = useState(false);

  function clearError() {
    setError(null);
  }

  async function openReceiveScreen(
    network: "bitcoin-mainnet" | "bitcoin-testnet" = receiveNetwork,
  ) {
    clearError();
    setCopiedAddress(false);
    setReceiveNetwork(network);
    setReceiveAddress(null);
    setIsLoadingReceiveAddress(true);
    setScreen("receive");

    try {
      const session = sessionRef.current;

      if (session === null) {
        throw new Error("Wallet session is unavailable");
      }

      const address = await session.getBitcoinReceiveAddress({
        network,
        addressType: "native-segwit",
        account: 0,
        change: 0,
        addressIndex: 0,
      });

      setReceiveAddress(address);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to derive receive address.");
    } finally {
      setIsLoadingReceiveAddress(false);
    }
  }

  async function handleCopyReceiveAddress() {
    if (receiveAddress === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(receiveAddress);
      setCopiedAddress(true);

      window.setTimeout(() => {
        setCopiedAddress(false);
      }, 2000);
    } catch {
      setError("Unable to copy address.");
    }
  }

  async function handleCreateWallet() {
    clearError();

    if (password.length === 0) {
      setError("Enter a password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsBusy(true);

    try {
      const session = sessionRef.current ?? createSession();

      const result = await session.lifecycle.create(password);

      sessionRef.current = session;

      setMnemonic(result.mnemonic);
      setPassword("");
      setConfirmPassword("");
      setScreen("backup");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create wallet.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUnlockWallet() {
    clearError();

    if (password.length === 0) {
      setError("Enter your wallet password.");
      return;
    }

    setIsBusy(true);

    try {
      const session = sessionRef.current ?? createSession();

      await session.unlock(password);

      sessionRef.current = session;

      setPassword("");
      setScreen("dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to unlock wallet.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateSendPreview() {
    clearError();
    setSendPreview(null);

    if (sendRecipient.trim().length === 0) {
      setError("Enter a Bitcoin recipient address.");
      return;
    }

    let amount: bigint;

    try {
      amount = bitcoinAmountToSatoshis(sendAmount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enter a valid Bitcoin amount.");
      return;
    }

    const session = sessionRef.current;

    if (session === null) {
      setError("Wallet session is unavailable.");
      return;
    }

    setIsLoadingSendPreview(true);

    try {
      const provider = new EsploraBitcoinProvider(sendNetwork);

      const preview = await session.createBitcoinSendPreview({
        provider,
        network: sendNetwork,
        recipient: sendRecipient.trim(),
        amount,
        addressType: "native-segwit",
        account: 0,
        change: 0,
        addressIndex: 0,
      });

      setSendPreview(preview);
      setScreen("send-confirm");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create Bitcoin send preview.");
    } finally {
      setIsLoadingSendPreview(false);
    }
  }

  async function handleConfirmSend() {
    clearError();

    const session = sessionRef.current;

    if (session === null) {
      setError("Wallet session is unavailable.");
      return;
    }

    if (sendPreview === null) {
      setError("Transaction preview is unavailable.");
      return;
    }

    setIsSigningTransaction(true);
    setSignedTransaction(null);

    try {
      const result = await session.signBitcoinTransaction({
        network: sendPreview.network,
        transaction: sendPreview.transaction,
        addressType: "native-segwit",
        account: 0,
        change: 0,
        addressIndex: 0,
      });

      setSignedTransaction(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign Bitcoin transaction.");
    } finally {
      setIsSigningTransaction(false);
    }
  }

  function handleBackupConfirmed() {
    if (!backupConfirmed) {
      return;
    }

    setMnemonic(null);
    setBackupConfirmed(false);
    setScreen("dashboard");
  }

  function handleLockWallet() {
    sessionRef.current?.lock();
    sessionRef.current = null;

    setPassword("");
    setMnemonic(null);
    setSendPreview(null);
    setSignedTransaction(null);
    setError(null);
    setScreen("unlock");
  }

  useEffect(() => {
    let cancelled = false;

    async function checkWallet() {
      try {
        const session = createSession();
        const exists = await session.lifecycle.exists();

        if (cancelled) {
          return;
        }

        sessionRef.current = session;
        setScreen(exists ? "unlock" : "create");
      } catch (cause) {
        if (cancelled) {
          return;
        }

        setError(cause instanceof Error ? cause.message : "Unable to check wallet.");
        setScreen("create");
      }
    }

    void checkWallet();

    return () => {
      cancelled = true;
    };
  }, []);

  function bitcoinAmountToSatoshis(value: string): bigint {
    const normalized = value.trim();

    if (!/^\d+(\.\d{1,8})?$/.test(normalized)) {
      throw new Error("Enter a valid Bitcoin amount.");
    }

    const parts = normalized.split(".");
    const wholePart = parts[0];

    if (wholePart === undefined) {
      throw new Error("Enter a valid Bitcoin amount.");
    }

    const fractionalPart = parts[1] ?? "";

    const whole = BigInt(wholePart);
    const fraction = BigInt(fractionalPart.padEnd(8, "0") || "0");

    const satoshis = whole * 100_000_000n + fraction;

    if (satoshis <= 0n) {
      throw new Error("Bitcoin amount must be greater than zero.");
    }

    return satoshis;
  }

  function formatBitcoinAmount(satoshis: bigint): string {
    const negative = satoshis < 0n;
    const absolute = negative ? -satoshis : satoshis;

    const whole = absolute / 100_000_000n;
    const fractional = (absolute % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");

    const value = fractional.length > 0 ? `${whole.toString()}.${fractional}` : whole.toString();

    return negative ? `-${value}` : value;
  }

  if (screen === "checking") {
    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">Crypto Wallet</p>

          <h1>Checking wallet</h1>

          <p className="description">Checking whether a wallet already exists on this device.</p>
        </section>
      </main>
    );
  }

  if (screen === "create") {
    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">New wallet</p>

          <h1>Create your wallet</h1>

          <p className="description">
            Create a self-custody wallet. Your wallet data is protected by the secure storage layer.
          </p>

          <div className="field">
            <label htmlFor="create-password">Password</label>

            <input
              id="create-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter a password"
            />
          </div>

          <div className="field">
            <label htmlFor="confirm-password">Confirm password</label>

            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm your password"
            />
          </div>

          {error !== null && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          <button type="button" disabled={isBusy} onClick={handleCreateWallet}>
            {isBusy ? "Creating wallet..." : "Create Wallet"}
          </button>
        </section>
      </main>
    );
  }

  if (screen === "backup" && mnemonic !== null) {
    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">Wallet backup</p>

          <h1>Secure your recovery phrase</h1>

          <p className="description">
            Write down these words and store them somewhere safe. Anyone with this phrase can
            control the wallet.
          </p>

          <div className="warning">Never share your recovery phrase with anyone.</div>

          <div className="mnemonic">
            {mnemonic.split(/\s+/).map((word, index) => (
              <span className="mnemonic-word" key={`${word}-${index}`}>
                <span className="word-number">{index + 1}</span>
                {word}
              </span>
            ))}
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={backupConfirmed}
              onChange={(event) => setBackupConfirmed(event.target.checked)}
            />

            <span>I have written down my recovery phrase and stored it securely.</span>
          </label>

          <button type="button" disabled={!backupConfirmed} onClick={handleBackupConfirmed}>
            Continue to Wallet
          </button>
        </section>
      </main>
    );
  }

  if (screen === "unlock") {
    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">Existing wallet</p>

          <h1>Unlock your wallet</h1>

          <p className="description">
            Enter your wallet password to decrypt and unlock your locally stored wallet.
          </p>

          <div className="field">
            <label htmlFor="unlock-password">Password</label>

            <input
              id="unlock-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your wallet password"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleUnlockWallet();
                }
              }}
            />
          </div>

          {error !== null && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          <button type="button" disabled={isBusy} onClick={() => void handleUnlockWallet()}>
            {isBusy ? "Unlocking wallet..." : "Unlock Wallet"}
          </button>
        </section>
      </main>
    );
  }

  if (screen === "send") {
    const isTestnet = sendNetwork === "bitcoin-testnet";

    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">Send</p>

          <h1>Send Bitcoin</h1>

          <p className="description">
            Enter the recipient and amount. Your wallet will validate the recipient, discover
            available UTXOs, estimate the fee, and build an unsigned transaction preview.
          </p>

          <div className="field">
            <label htmlFor="send-network">Network</label>

            <select
              id="send-network"
              value={sendNetwork}
              disabled={isLoadingSendPreview}
              onChange={(event) => {
                setSendNetwork(event.target.value as "bitcoin-mainnet" | "bitcoin-testnet");
                setSendPreview(null);
                clearError();
              }}
            >
              <option value="bitcoin-mainnet">Bitcoin Mainnet</option>
              <option value="bitcoin-testnet">Bitcoin Testnet</option>
            </select>
          </div>

          <div className="warning">
            {isTestnet
              ? "You are sending on Bitcoin Testnet. Testnet Bitcoin has no mainnet value."
              : "Only send Bitcoin to a recipient address intended for the Bitcoin mainnet."}
          </div>

          <div className="field">
            <label htmlFor="send-recipient">Recipient address</label>

            <input
              id="send-recipient"
              type="text"
              inputMode="text"
              autoComplete="off"
              value={sendRecipient}
              onChange={(event) => {
                setSendRecipient(event.target.value);
                clearError();
              }}
              placeholder={isTestnet ? "tb1..." : "bc1..."}
            />
          </div>

          <div className="field">
            <label htmlFor="send-amount">Amount (BTC)</label>

            <input
              id="send-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={sendAmount}
              onChange={(event) => {
                setSendAmount(event.target.value);
                clearError();
              }}
              placeholder="0.001"
            />
          </div>

          {error !== null && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={
              isLoadingSendPreview ||
              sendRecipient.trim().length === 0 ||
              sendAmount.trim().length === 0
            }
            onClick={() => void handleCreateSendPreview()}
          >
            {isLoadingSendPreview ? "Preparing transaction..." : "Review Transaction"}
          </button>

          <button
            type="button"
            className="text-button"
            disabled={isLoadingSendPreview}
            onClick={() => {
              clearError();
              setScreen("dashboard");
            }}
          >
            Back to Dashboard
          </button>
        </section>
      </main>
    );
  }

  if (screen === "send-confirm" && sendPreview !== null) {
    const isTestnet = sendPreview.network === "bitcoin-testnet";

    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">Confirm Send</p>

          <h1>Review Bitcoin transaction</h1>

          <p className="description">
            Review every transaction detail before signing. Signing authorizes this exact
            transaction, but this MVP does not broadcast it yet.
          </p>

          <div className="warning">
            {isTestnet
              ? "Testnet transaction: this has no mainnet value."
              : "Verify the recipient address and amount carefully. Bitcoin transactions cannot be reversed after broadcast."}
          </div>

          <div className="send-summary">
            <div className="send-summary-row">
              <span>Network</span>
              <strong>{isTestnet ? "Bitcoin Testnet" : "Bitcoin Mainnet"}</strong>
            </div>

            <div className="send-summary-row">
              <span>From</span>
              <code>{sendPreview.sourceAddress}</code>
            </div>

            <div className="send-summary-row">
              <span>Recipient</span>
              <code>{sendPreview.recipientAddress}</code>
            </div>

            <div className="send-summary-row">
              <span>Amount</span>
              <strong>{formatBitcoinAmount(sendPreview.amount)} BTC</strong>
            </div>

            <div className="send-summary-row">
              <span>Estimated fee</span>
              <strong>{formatBitcoinAmount(sendPreview.fee)} BTC</strong>
            </div>

            <div className="send-summary-row">
              <span>Change</span>
              <strong>{formatBitcoinAmount(sendPreview.change)} BTC</strong>
            </div>

            <div className="send-summary-row">
              <span>Virtual size</span>
              <strong>{sendPreview.virtualSize} vbytes</strong>
            </div>
          </div>

          {signedTransaction === null ? (
            <div className="success">
              Unsigned transaction prepared successfully. Review the details before signing.
            </div>
          ) : (
            <div className="success">
              Transaction signed successfully. The signed transaction has not been broadcast.
            </div>
          )}

          {signedTransaction !== null && (
            <div className="transaction-result">
              <div className="success-message">Transaction signed successfully.</div>

              <div className="transaction-details">
                <div className="detail-row">
                  <span>Transaction ID</span>
                  <code>{signedTransaction.txid}</code>
                </div>

                <div className="detail-row">
                  <span>Raw transaction</span>
                  <span>{signedTransaction.rawTransaction.length} bytes</span>
                </div>
              </div>

              <a
                href={getBitcoinTransactionExplorerUrl(
                  signedTransaction.network,
                  signedTransaction.txid,
                )}
                target="_blank"
                rel="noreferrer"
              >
                View transaction on Mempool.space ↗
              </a>

              <div className="warning-message">
                This transaction has been signed locally but has not been broadcast to the Bitcoin
                network.
              </div>
            </div>
          )}

          <div className="button-stack">
            <button
              type="button"
              disabled={isSigningTransaction || signedTransaction !== null}
              onClick={() => void handleConfirmSend()}
            >
              {isSigningTransaction
                ? "Signing transaction..."
                : signedTransaction !== null
                  ? "Transaction Signed"
                  : "Confirm & Sign Transaction"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                clearError();
                setSignedTransaction(null);
                setSendPreview(null);
                setScreen("send");
              }}
            >
              Edit Transaction
            </button>

            <button
              type="button"
              className="text-button"
              onClick={() => {
                clearError();
                setSignedTransaction(null);
                setSendPreview(null);
                setScreen("dashboard");
              }}
            >
              Cancel
            </button>
          </div>

          {error !== null && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (screen === "receive") {
    const isTestnet = receiveNetwork === "bitcoin-testnet";

    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">Receive</p>

          <h1>Receive Bitcoin</h1>

          <p className="description">
            Share this address to receive Bitcoin. Only send Bitcoin on the selected network.
          </p>

          <div className="field">
            <label htmlFor="receive-network">Network</label>

            <select
              id="receive-network"
              value={receiveNetwork}
              disabled={isLoadingReceiveAddress}
              onChange={(event) => {
                void openReceiveScreen(event.target.value as "bitcoin-mainnet" | "bitcoin-testnet");
              }}
            >
              <option value="bitcoin-mainnet">Bitcoin Mainnet</option>
              <option value="bitcoin-testnet">Bitcoin Testnet</option>
            </select>
          </div>

          <div className="warning">
            {isTestnet
              ? "Testnet Bitcoin has no mainnet value. Do not send mainnet Bitcoin to this testnet address."
              : "Only send Bitcoin on the Bitcoin mainnet network to this address."}
          </div>

          {isLoadingReceiveAddress ? (
            <div className="dashboard-empty-state">
              <h3>Generating receive address...</h3>

              <p>Deriving your public Bitcoin address from the secure wallet session.</p>
            </div>
          ) : receiveAddress !== null ? (
            <>
              <div className="receive-qr">
                <QRCodeSVG
                  value={receiveAddress}
                  size={220}
                  includeMargin
                  aria-label={`Bitcoin ${isTestnet ? "testnet" : "mainnet"} receive address QR code`}
                />
              </div>

              <div className="receive-address-card">
                <p className="dashboard-label">Your Bitcoin address</p>

                <code className="receive-address">{receiveAddress}</code>
              </div>

              <button type="button" onClick={() => void handleCopyReceiveAddress()}>
                {copiedAddress ? "Address Copied" : "Copy Address"}
              </button>
            </>
          ) : null}

          {error !== null && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            className="text-button"
            onClick={() => {
              clearError();
              setReceiveAddress(null);
              setCopiedAddress(false);
              setScreen("dashboard");
            }}
          >
            Back to Dashboard
          </button>
        </section>
      </main>
    );
  }

  if (screen === "dashboard") {
    return (
      <main className="app-shell">
        <section className="dashboard-shell">
          <header className="dashboard-topbar">
            <div>
              <p className="eyebrow">Crypto Wallet</p>
              <h1>Dashboard</h1>
            </div>

            <div className="dashboard-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void openReceiveScreen()}
              >
                Receive
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  clearError();
                  setSendRecipient("");
                  setSendAmount("");
                  setSendPreview(null);
                  setSignedTransaction(null);
                  setSendNetwork("bitcoin-mainnet");
                  setScreen("send");
                }}
              >
                Send
              </button>

              <span className="status-badge">Unlocked</span>
            </div>
          </header>

          <section className="portfolio-card">
            <div>
              <p className="dashboard-label">Total portfolio value</p>

              <p className="portfolio-value">$0.00</p>

              <p className="dashboard-muted">
                Portfolio value will appear when wallet assets are connected.
              </p>
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="dashboard-card">
              <div className="section-header">
                <div>
                  <p className="dashboard-label">Accounts</p>
                  <h2>Wallet accounts</h2>
                </div>

                <span className="section-count">0</span>
              </div>

              <div className="dashboard-empty-state">
                <h3>No accounts yet</h3>

                <p>
                  Wallet accounts will appear here when account and chain derivation is connected.
                </p>
              </div>
            </section>

            <section className="dashboard-card">
              <div className="section-header">
                <div>
                  <p className="dashboard-label">Assets</p>
                  <h2>Portfolio assets</h2>
                </div>

                <span className="section-count">{dashboardAssets.length}</span>
              </div>

              {dashboardAssets.length === 0 ? (
                <div className="dashboard-empty-state">
                  <h3>No assets yet</h3>

                  <p>
                    Supported-chain balances will appear here once balance providers are connected.
                  </p>
                </div>
              ) : (
                <div className="asset-list">
                  {dashboardAssets.map((asset) => (
                    <div className="asset-row" key={`${asset.chain}-${asset.symbol}`}>
                      <div>
                        <strong>{asset.symbol}</strong>
                        <span>{asset.name}</span>
                      </div>

                      <div className="asset-balance">
                        <strong>{asset.balance}</strong>
                        <span>{asset.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="dashboard-card">
            <div className="section-header">
              <div>
                <p className="dashboard-label">Activity</p>
                <h2>Recent activity</h2>
              </div>

              <span className="section-count">{dashboardActivity.length}</span>
            </div>

            {dashboardActivity.length === 0 ? (
              <div className="dashboard-empty-state">
                <h3>No recent activity</h3>

                <p>Transactions will appear here after wallet activity is connected.</p>
              </div>
            ) : (
              <div className="activity-list">
                {dashboardActivity.map((activity) => (
                  <div className="activity-row" key={`${activity.title}-${activity.time}`}>
                    <div>
                      <strong>{activity.title}</strong>
                      <span>{activity.description}</span>
                    </div>

                    <div className="activity-meta">
                      <strong>{activity.status}</strong>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-card security-card">
            <div>
              <p className="dashboard-label">Security</p>

              <h2>Wallet protection</h2>

              <p className="dashboard-muted">
                Your wallet automatically locks after 15 minutes of inactivity. Secret material
                remains managed by the secure wallet session.
              </p>
            </div>

            <button type="button" onClick={handleLockWallet}>
              Lock Wallet
            </button>
          </section>
        </section>
      </main>
    );
  }
  return null;
}
