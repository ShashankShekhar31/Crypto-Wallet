import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";

import { EsploraBitcoinProvider } from "@crypto-wallet/chain-core";
import type { WalletSession } from "@crypto-wallet/wallet-core";
import QRCode from "react-native-qrcode-svg";
import { authenticateWithBiometrics, getBiometricAvailability } from "../platform/biometric-auth";
import { getBiometricMasterKey, setBiometricMasterKey } from "../platform/secure-storage";

import * as ScreenCapture from "expo-screen-capture";

type MobileScreen =
  | "loading"
  | "onboarding"
  | "create-password"
  | "restore"
  | "backup"
  | "unlock"
  | "dashboard"
  | "receive"
  | "send"
  | "activity";

interface MobileAppProps {
  session: WalletSession;
}

function parseBitcoinAmountToSatoshis(value: string): bigint {
  const normalized = value.trim();

  if (!/^(?:\d+)(?:\.\d{1,8})?$/.test(normalized)) {
    throw new Error("Enter a valid BTC amount with up to 8 decimal places.");
  }

  const parts = normalized.split(".");
  const wholePart = parts[0] ?? "0";
  const fractionalPart = parts[1] ?? "";

  const satoshis = BigInt(wholePart) * 100_000_000n;
  const fractionalSatoshis = BigInt(fractionalPart.padEnd(8, "0") || "0");

  const total = satoshis + fractionalSatoshis;

  if (total <= 0n) {
    throw new Error("Amount must be greater than 0 BTC.");
  }

  return total;
}

export function MobileApp({ session }: MobileAppProps) {
  const [screen, setScreen] = useState<MobileScreen>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restoreMnemonic, setRestoreMnemonic] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [receiveNetwork, setReceiveNetwork] = useState<"bitcoin-mainnet" | "bitcoin-testnet">(
    "bitcoin-mainnet",
  );

  const [receiveAddress, setReceiveAddress] = useState<string | null>(null);
  const [isLoadingReceiveAddress, setIsLoadingReceiveAddress] = useState(false);

  const [sendNetwork, setSendNetwork] = useState<"bitcoin-mainnet" | "bitcoin-testnet">(
    "bitcoin-mainnet",
  );

  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  const [sendPreview, setSendPreview] = useState<{
    network: "bitcoin-mainnet" | "bitcoin-testnet";
    sourceAddress: string;
    recipientAddress: string;
    amount: bigint;
    fee: bigint;
    change: bigint;
    virtualSize: number;
    transaction: Awaited<ReturnType<WalletSession["createBitcoinSendPreview"]>>["transaction"];
  } | null>(null);

  const [isLoadingSendPreview, setIsLoadingSendPreview] = useState(false);

  const [signedTransaction, setSignedTransaction] = useState<{
    txid: string;
    transaction: Awaited<ReturnType<WalletSession["signBitcoinTransaction"]>>["transaction"];
    rawTransaction: Awaited<ReturnType<WalletSession["signBitcoinTransaction"]>>["rawTransaction"];
  } | null>(null);

  const [isSigningTransaction, setIsSigningTransaction] = useState(false);

  const [isBroadcastingTransaction, setIsBroadcastingTransaction] = useState(false);
  const [broadcastedTxid, setBroadcastedTxid] = useState<string | null>(null);

  const [isCheckingTransactionStatus, setIsCheckingTransactionStatus] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<Awaited<
    ReturnType<EsploraBitcoinProvider["getTransactionStatus"]>
  > | null>(null);

  const [activityNetwork, setActivityNetwork] = useState<"bitcoin-mainnet" | "bitcoin-testnet">(
    "bitcoin-testnet",
  );

  const [activityTransactions, setActivityTransactions] = useState<
    Awaited<ReturnType<WalletSession["getBitcoinActivity"]>>
  >([]);

  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const handleEnableBiometrics = async () => {
    setError(null);

    try {
      const availability = await getBiometricAvailability();

      if (!availability.supported) {
        setError("Biometric hardware is not available on this device.");
        return;
      }

      if (!availability.enrolled) {
        setError("No biometric credentials are enrolled on this device.");
        return;
      }

      const masterKey = session.vault.getMasterKey();

      if (masterKey === null) {
        setError("Unlock your wallet before enabling biometric unlock.");
        return;
      }

      try {
        await setBiometricMasterKey(masterKey);
      } finally {
        masterKey.wipe();
      }

      setError(null);
    } catch (error) {
      console.error("Biometric enrollment failed:", error);

      setError(error instanceof Error ? error.message : "Unable to enable biometric unlock.");
    }
  };

  useEffect(() => {
    let mounted = true;

    void session.lifecycle
      .exists()
      .then((exists) => {
        if (!mounted) {
          return;
        }

        setScreen(exists ? "unlock" : "onboarding");
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setError("Unable to inspect wallet state.");
        setScreen("onboarding");
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    let currentState: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasInForeground =
        currentState === "active" || currentState === "unknown" || currentState === "extension";

      currentState = nextState;

      if (wasInForeground && (nextState === "background" || nextState === "inactive")) {
        session.lock();
        clearTransactionState();
        setPassword("");
        setMnemonic("");
        setScreen("unlock");
      }
    });

    return () => {
      subscription.remove();
    };
  }, [session]);

  useEffect(() => {
    if (screen !== "backup" && screen !== "restore") {
      void ScreenCapture.allowScreenCaptureAsync("backup-screen");
      return;
    }

    void ScreenCapture.preventScreenCaptureAsync("backup-screen");

    return () => {
      void ScreenCapture.allowScreenCaptureAsync("backup-screen");
    };
  }, [screen]);

  async function createWallet() {
    if (isCreating) {
      return;
    }

    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsCreating(true);

    try {
      const result = await session.lifecycle.create(password);

      setPassword("");
      setConfirmPassword("");
      setMnemonic(result.mnemonic);
      setScreen("backup");
    } catch (error) {
      console.error("Wallet creation failed:", error);

      setError(error instanceof Error ? error.message : "Unable to create wallet.");
    } finally {
      setIsCreating(false);
    }
  }

  async function restoreWallet() {
    setError(null);

    if (restoreMnemonic.trim().length === 0) {
      setError("Enter your recovery phrase.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsRestoring(true);

    try {
      await session.lifecycle.restore(password, restoreMnemonic.trim());

      setRestoreMnemonic("");
      setPassword("");
      setConfirmPassword("");
      setScreen("dashboard");
    } catch (error) {
      console.error("Wallet restore failed");

      setError(error instanceof Error ? error.message : "Unable to restore wallet.");
    } finally {
      setIsRestoring(false);
    }
  }

  async function openReceiveScreen(
    network: "bitcoin-mainnet" | "bitcoin-testnet" = receiveNetwork,
  ) {
    setError(null);
    setReceiveNetwork(network);
    setReceiveAddress(null);
    setIsLoadingReceiveAddress(true);
    setScreen("receive");

    try {
      const address = await session.getBitcoinReceiveAddress({
        network,
        addressType: "native-segwit",
        account: 0,
        change: 0,
        addressIndex: 0,
      });

      setReceiveAddress(address);
    } catch (error) {
      console.error("Receive address derivation failed:", error);

      setError(error instanceof Error ? error.message : "Unable to derive receive address.");
    } finally {
      setIsLoadingReceiveAddress(false);
    }
  }

  async function unlockWalletWithBiometrics() {
    if (isUnlocking) {
      return;
    }

    setError(null);
    setIsUnlocking(true);

    try {
      const availability = await getBiometricAvailability();

      if (!availability.supported) {
        setError("Biometric hardware is not available on this device.");
        return;
      }

      if (!availability.enrolled) {
        setError("No biometric credentials are enrolled on this device.");
        return;
      }

      const authenticated = await authenticateWithBiometrics("Unlock your wallet");

      if (!authenticated) {
        setError("Biometric authentication was cancelled or failed.");
        return;
      }

      const masterKey = await getBiometricMasterKey();

      if (masterKey === null) {
        setError("Biometric unlock is not enabled. Unlock with your password first.");
        return;
      }

      try {
        await session.vault.unlockWithMasterKey(masterKey);
      } finally {
        masterKey.wipe();
      }

      setScreen("dashboard");
    } catch (error) {
      console.error("Biometric wallet unlock failed");

      setError(error instanceof Error ? error.message : "Unable to unlock wallet with biometrics.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function unlockWallet() {
    if (isUnlocking) {
      return;
    }

    setError(null);

    if (password.length === 0) {
      setError("Enter your wallet password.");
      return;
    }

    setIsUnlocking(true);

    try {
      await session.unlock(password);

      setPassword("");
      setScreen("dashboard");
    } catch (error) {
      console.error("Wallet unlock failed:", error);

      setError(error instanceof Error ? error.message : "Unable to unlock wallet.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function reviewSendTransaction() {
    setError(null);
    setSendPreview(null);

    if (sendRecipient.trim().length === 0) {
      setError("Enter a recipient Bitcoin address.");
      return;
    }

    let amount: bigint;

    try {
      amount = parseBitcoinAmountToSatoshis(sendAmount);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Enter a valid BTC amount.");
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

      setSendPreview({
        network: preview.network,
        sourceAddress: preview.sourceAddress,
        recipientAddress: preview.recipientAddress,
        amount: preview.amount,
        fee: preview.fee,
        change: preview.change,
        virtualSize: preview.virtualSize,
        transaction: preview.transaction,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create Bitcoin send preview.");
    } finally {
      setIsLoadingSendPreview(false);
    }
  }

  async function signSendTransaction() {
    setError(null);
    setSignedTransaction(null);

    if (sendPreview === null) {
      setError("Create a transaction preview first.");
      return;
    }

    setIsSigningTransaction(true);

    try {
      const result = await session.signBitcoinTransaction({
        network: sendPreview.network,
        transaction: sendPreview.transaction,
        addressType: "native-segwit",
        account: 0,
        change: 0,
        addressIndex: 0,
      });

      setSignedTransaction({
        txid: result.txid,
        transaction: result.transaction,
        rawTransaction: result.rawTransaction,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign Bitcoin transaction.");
    } finally {
      setIsSigningTransaction(false);
    }
  }

  async function broadcastSendTransaction() {
    setError(null);
    setBroadcastedTxid(null);

    if (signedTransaction === null) {
      setError("Sign the transaction first.");
      return;
    }

    if (sendNetwork !== "bitcoin-testnet") {
      setError("Broadcast is currently limited to Bitcoin Testnet.");
      return;
    }

    setIsBroadcastingTransaction(true);

    try {
      const provider = new EsploraBitcoinProvider("bitcoin-testnet");

      const txid = await provider.broadcastTransaction(signedTransaction.rawTransaction);

      setBroadcastedTxid(txid);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to broadcast Bitcoin transaction.");
    } finally {
      setIsBroadcastingTransaction(false);
    }
  }

  async function checkSendTransactionStatus() {
    setError(null);
    setTransactionStatus(null);

    if (broadcastedTxid === null) {
      setError("Broadcast the transaction first.");
      return;
    }

    if (sendNetwork !== "bitcoin-testnet") {
      setError("Transaction status tracking is currently limited to Bitcoin Testnet.");
      return;
    }

    setIsCheckingTransactionStatus(true);

    try {
      const provider = new EsploraBitcoinProvider("bitcoin-testnet");

      const status = await provider.getTransactionStatus(broadcastedTxid);

      setTransactionStatus(status);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to check Bitcoin transaction status.",
      );
    } finally {
      setIsCheckingTransactionStatus(false);
    }
  }

  async function loadBitcoinActivity(
    network: "bitcoin-mainnet" | "bitcoin-testnet" = activityNetwork,
  ) {
    setError(null);
    setActivityNetwork(network);
    setActivityTransactions([]);
    setIsLoadingActivity(true);

    try {
      const provider = new EsploraBitcoinProvider(network);

      const transactions = await session.getBitcoinActivity({
        provider,
        network,
        addressType: "native-segwit",
        account: 0,
        change: 0,
        addressIndex: 0,
      });

      setActivityTransactions(transactions);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load Bitcoin activity.");
    } finally {
      setIsLoadingActivity(false);
    }
  }

  function clearTransactionState() {
    if (signedTransaction !== null) {
      signedTransaction.rawTransaction.fill(0);
    }

    setSendPreview(null);
    setSignedTransaction(null);
    setBroadcastedTxid(null);
    setTransactionStatus(null);
    setSendRecipient("");
    setSendAmount("");
  }

  function lockWallet() {
    session.lock();
    clearTransactionState();
    setPassword("");
    setMnemonic("");
    setScreen("unlock");
  }

  function openSendScreen() {
    setError(null);
    setSendRecipient("");
    setSendAmount("");
    setScreen("send");
  }

  if (screen === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.subtitle}>Loading wallet...</Text>
      </View>
    );
  }

  if (screen === "onboarding") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Crypto Wallet</Text>
        <Text style={styles.subtitle}>Create or restore your self-custody wallet.</Text>

        <View style={styles.button}>
          <Button
            title="Create wallet"
            onPress={() => {
              setError(null);
              setScreen("create-password");
            }}
          />
        </View>

        <View style={styles.button}>
          <Button
            title="Restore wallet"
            onPress={() => {
              setError(null);
              setRestoreMnemonic("");
              setPassword("");
              setConfirmPassword("");
              setScreen("restore");
            }}
          />
        </View>

        <Text style={styles.note}>Restore flow will be added next.</Text>
      </View>
    );
  }

  if (screen === "create-password") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Create wallet</Text>
        <Text style={styles.subtitle}>Set the password that protects your wallet vault.</Text>

        <TextInput
          autoCapitalize="none"
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
          }}
        />

        <TextInput
          autoCapitalize="none"
          placeholder="Confirm password"
          secureTextEntry
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <View style={styles.button}>
          <Button
            title={isCreating ? "Creating wallet..." : "Create wallet"}
            disabled={isCreating}
            onPress={() => void createWallet()}
          />
        </View>

        <View style={styles.button}>
          <Button
            title="Back"
            onPress={() => {
              setError(null);
              setPassword("");
              setConfirmPassword("");
              setIsCreating(false);
              setScreen("onboarding");
            }}
          />
        </View>
      </View>
    );
  }

  if (screen === "restore") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Restore wallet</Text>

        <Text style={styles.subtitle}>
          Enter your recovery phrase and create a new wallet password.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          placeholder="Recovery phrase"
          style={styles.mnemonicInput}
          value={restoreMnemonic}
          onChangeText={(text) => {
            setRestoreMnemonic(text);
            setError(null);
          }}
        />

        <TextInput
          autoCapitalize="none"
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
          }}
        />

        <TextInput
          autoCapitalize="none"
          placeholder="Confirm password"
          secureTextEntry
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <View style={styles.button}>
          <Button
            title={isRestoring ? "Restoring wallet..." : "Restore wallet"}
            disabled={isRestoring}
            onPress={() => void restoreWallet()}
          />
        </View>

        <View style={styles.button}>
          <Button
            title="Back"
            onPress={() => {
              setError(null);
              setRestoreMnemonic("");
              setPassword("");
              setConfirmPassword("");
              setScreen("onboarding");
            }}
          />
        </View>
      </View>
    );
  }

  if (screen === "backup") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Back up your wallet</Text>
        <Text style={styles.warning}>
          Write down your recovery phrase and store it securely. Never share it with anyone.
        </Text>

        <View style={styles.mnemonicBox}>
          <Text selectable style={styles.mnemonic}>
            {mnemonic}
          </Text>
        </View>

        <View style={styles.button}>
          <Button
            title="I backed it up"
            onPress={() => {
              setMnemonic("");
              setScreen("dashboard");
            }}
          />
        </View>
      </View>
    );
  }

  if (screen === "unlock") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unlock wallet</Text>
        <Text style={styles.subtitle}>Enter your wallet password.</Text>

        <TextInput
          autoCapitalize="none"
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <View style={styles.button}>
          <Button
            title={isUnlocking ? "Unlocking wallet..." : "Unlock"}
            disabled={isUnlocking}
            onPress={() => void unlockWallet()}
          />
        </View>

        <View style={styles.button}>
          <Button
            title="Unlock with biometrics"
            disabled={isUnlocking}
            onPress={() => void unlockWalletWithBiometrics()}
          />
        </View>
      </View>
    );
  }

  if (screen === "receive") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Receive Bitcoin</Text>

        <Text style={styles.subtitle}>Share this address to receive Bitcoin.</Text>

        <View style={styles.button}>
          <Button
            title={receiveNetwork === "bitcoin-mainnet" ? "Bitcoin Mainnet" : "Bitcoin Testnet"}
            onPress={() => {
              const nextNetwork =
                receiveNetwork === "bitcoin-mainnet" ? "bitcoin-testnet" : "bitcoin-mainnet";

              void openReceiveScreen(nextNetwork);
            }}
            disabled={isLoadingReceiveAddress}
          />
        </View>

        {isLoadingReceiveAddress && (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.subtitle}>Deriving receive address...</Text>
          </View>
        )}

        {receiveAddress !== null && !isLoadingReceiveAddress && (
          <>
            <View style={styles.qrBox}>
              <QRCode value={receiveAddress} size={220} />
            </View>

            <View style={styles.addressBox}>
              <Text selectable style={styles.address}>
                {receiveAddress}
              </Text>
            </View>
          </>
        )}

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <View style={styles.button}>
          <Button
            title="Back to dashboard"
            disabled={isLoadingReceiveAddress}
            onPress={() => {
              setError(null);
              setReceiveAddress(null);
              setScreen("dashboard");
            }}
          />
        </View>
      </View>
    );
  }

  if (screen === "send") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Send Bitcoin</Text>

        <Text style={styles.subtitle}>Enter the recipient address and amount.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Network</Text>

          <Button
            title={sendNetwork === "bitcoin-mainnet" ? "Bitcoin Mainnet" : "Bitcoin Testnet"}
            onPress={() => {
              setSendNetwork((current) =>
                current === "bitcoin-mainnet" ? "bitcoin-testnet" : "bitcoin-mainnet",
              );
            }}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recipient address</Text>

          <TextInput
            style={styles.input}
            value={sendRecipient}
            onChangeText={setSendRecipient}
            placeholder="bc1..."
            autoCapitalize="none"
            autoCorrect={false}
            editable
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount (BTC)</Text>

          <TextInput
            style={styles.input}
            value={sendAmount}
            onChangeText={setSendAmount}
            placeholder="0.001"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.button}>
          <Button
            title={isLoadingSendPreview ? "Creating preview..." : "Review transaction"}
            disabled={isLoadingSendPreview}
            onPress={() => void reviewSendTransaction()}
          />
        </View>

        {error !== null && <Text style={styles.error}>{error}</Text>}

        {sendPreview !== null && (
          <>
            <View style={styles.previewBox}>
              <Text style={styles.label}>Transaction preview</Text>

              <Text style={styles.previewText}>Recipient: {sendPreview.recipientAddress}</Text>

              <Text style={styles.previewText}>
                Amount: {sendPreview.amount.toString()} satoshis
              </Text>

              <Text style={styles.previewText}>Fee: {sendPreview.fee.toString()} satoshis</Text>

              <Text style={styles.previewText}>
                Change: {sendPreview.change.toString()} satoshis
              </Text>

              <Text style={styles.previewText}>Virtual size: {sendPreview.virtualSize} vbytes</Text>
            </View>

            <View style={styles.button}>
              <Button
                title={isSigningTransaction ? "Signing transaction..." : "Sign transaction"}
                disabled={isSigningTransaction}
                onPress={() => void signSendTransaction()}
              />
            </View>
          </>
        )}

        {signedTransaction !== null && (
          <View style={styles.previewBox}>
            <Text style={styles.label}>Signed transaction</Text>

            <Text style={styles.previewText}>TXID: {signedTransaction.txid}</Text>

            <Text style={styles.previewText}>
              Signed transaction: {JSON.stringify(signedTransaction.transaction)}
            </Text>
          </View>
        )}

        <View style={styles.button}>
          <Button
            title={
              isBroadcastingTransaction ? "Broadcasting transaction..." : "Broadcast transaction"
            }
            disabled={isBroadcastingTransaction || broadcastedTxid !== null}
            onPress={() => void broadcastSendTransaction()}
          />
        </View>

        <View style={styles.button}>
          <Button
            title="Back to dashboard"
            onPress={() => {
              setError(null);
              clearTransactionState();
              setScreen("dashboard");
            }}
          />
        </View>

        {broadcastedTxid !== null && (
          <View style={styles.previewBox}>
            <Text style={styles.label}>Transaction broadcast</Text>

            <Text style={styles.previewText}>TXID: {broadcastedTxid}</Text>

            <Text style={styles.previewText}>
              The transaction was submitted to Bitcoin Testnet.
            </Text>
          </View>
        )}

        {broadcastedTxid !== null && (
          <View style={styles.button}>
            <Button
              title={
                isCheckingTransactionStatus ? "Checking transaction..." : "Check transaction status"
              }
              disabled={isCheckingTransactionStatus}
              onPress={() => void checkSendTransactionStatus()}
            />
          </View>
        )}

        {transactionStatus !== null && (
          <View style={styles.previewBox}>
            <Text style={styles.label}>Transaction status</Text>

            <Text style={styles.previewText}>TXID: {transactionStatus.txid}</Text>

            <Text style={styles.previewText}>
              Status: {transactionStatus.confirmed ? "Confirmed" : "Unconfirmed"}
            </Text>

            <Text style={styles.previewText}>Confirmations: {transactionStatus.confirmations}</Text>

            {transactionStatus.blockHeight !== undefined && (
              <Text style={styles.previewText}>Block height: {transactionStatus.blockHeight}</Text>
            )}

            {transactionStatus.blockHash !== undefined && (
              <Text style={styles.previewText}>Block hash: {transactionStatus.blockHash}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  if (screen === "activity") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Activity</Text>

        <Text style={styles.subtitle}>Bitcoin transactions for your current wallet address.</Text>

        <View style={styles.button}>
          <Button
            title={activityNetwork === "bitcoin-mainnet" ? "Bitcoin Mainnet" : "Bitcoin Testnet"}
            disabled={isLoadingActivity}
            onPress={() => {
              const nextNetwork =
                activityNetwork === "bitcoin-mainnet" ? "bitcoin-testnet" : "bitcoin-mainnet";

              void loadBitcoinActivity(nextNetwork);
            }}
          />
        </View>

        <View style={styles.button}>
          <Button
            title={isLoadingActivity ? "Loading activity..." : "Refresh activity"}
            disabled={isLoadingActivity}
            onPress={() => void loadBitcoinActivity()}
          />
        </View>

        {error !== null && <Text style={styles.error}>{error}</Text>}

        {isLoadingActivity && (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.subtitle}>Loading transactions...</Text>
          </View>
        )}

        {!isLoadingActivity && activityTransactions.length === 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>No transactions found.</Text>
          </View>
        )}

        {!isLoadingActivity &&
          activityTransactions.map((transaction) => {
            const direction =
              transaction.netSatoshis > 0n
                ? "Received"
                : transaction.netSatoshis < 0n
                  ? "Sent"
                  : "No net change";

            const amount =
              transaction.netSatoshis < 0n ? -transaction.netSatoshis : transaction.netSatoshis;

            return (
              <View key={transaction.txid} style={styles.previewBox}>
                <Text style={styles.label}>{direction}</Text>

                <Text selectable style={styles.previewText}>
                  Amount: {amount.toString()} satoshis
                </Text>

                <Text style={styles.previewText}>
                  Status: {transaction.confirmed ? "Confirmed" : "Unconfirmed"}
                </Text>

                <Text style={styles.previewText}>Confirmations: {transaction.confirmations}</Text>

                <Text selectable style={styles.previewText}>
                  TXID: {transaction.txid}
                </Text>

                {transaction.blockHeight !== undefined && (
                  <Text style={styles.previewText}>Block height: {transaction.blockHeight}</Text>
                )}
              </View>
            );
          })}

        <View style={styles.button}>
          <Button
            title="Back to dashboard"
            disabled={isLoadingActivity}
            onPress={() => {
              setError(null);
              setActivityTransactions([]);
              setScreen("dashboard");
            }}
          />
        </View>
      </View>
    );
  }

  if (screen === "dashboard") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Wallet unlocked</Text>

        <Text style={styles.status}>Wallet lifecycle is owned by wallet-core.</Text>

        <View style={styles.button}>
          <Button title="Receive" onPress={() => void openReceiveScreen()} />
        </View>

        <View style={styles.button}>
          <Button title="Send" onPress={openSendScreen} />
        </View>

        <View style={styles.button}>
          <Button
            title="Activity"
            onPress={() => {
              setError(null);
              setActivityTransactions([]);
              setScreen("activity");
              void loadBitcoinActivity("bitcoin-testnet");
            }}
          />
        </View>

        <View style={styles.button}>
          <Button title="Enable biometric unlock" onPress={() => void handleEnableBiometrics()} />
        </View>

        <View style={styles.button}>
          <Button title="Lock wallet" onPress={lockWallet} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 17,
    textAlign: "center",
  },
  status: {
    marginTop: 20,
    textAlign: "center",
  },
  note: {
    marginTop: 16,
    textAlign: "center",
  },
  button: {
    marginTop: 16,
  },
  error: {
    marginTop: 12,
    textAlign: "center",
  },
  warning: {
    marginTop: 16,
    textAlign: "center",
  },
  mnemonicBox: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  mnemonic: {
    fontSize: 17,
    lineHeight: 28,
    textAlign: "center",
  },
  loading: {
    marginTop: 20,
    alignItems: "center",
  },

  addressBox: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },

  address: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
  },
  qrBox: {
    marginTop: 20,
    alignItems: "center",
  },
  inputGroup: {
    width: "100%",
    marginTop: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "600",
  },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  previewBox: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  previewText: {
    marginTop: 8,
    fontSize: 14,
  },
  mnemonicInput: {
    marginTop: 20,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
});
