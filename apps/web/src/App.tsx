import { useEffect, useRef, useState } from "react";

import { createWallet, type WalletSession } from "@crypto-wallet/wallet-core";
import { LocalStorageSecureStorageAdapter } from "@crypto-wallet/secure-storage";

type Screen = "checking" | "create" | "backup" | "unlock" | "dashboard";

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

  function clearError() {
    setError(null);
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

  if (screen === "dashboard") {
    return (
      <main className="app-shell">
        <section className="card">
          <div className="dashboard-header">
            <div>
              <p className="eyebrow">Wallet</p>
              <h1>Dashboard</h1>
            </div>

            <span className="status-badge">Unlocked</span>
          </div>

          <div className="dashboard-section">
            <h2>Self-custody wallet</h2>

            <p className="description">
              Your wallet is currently unlocked. Secure wallet data is available through the
              wallet-core session.
            </p>
          </div>

          <div className="dashboard-section">
            <h2>Security</h2>

            <p className="description">
              The wallet automatically locks after 15 minutes of inactivity.
            </p>
          </div>

          <button type="button" onClick={handleLockWallet}>
            Lock Wallet
          </button>
        </section>
      </main>
    );
  }

  return null;
}
