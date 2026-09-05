import "./src/platform/crypto";

import { SafeAreaView, StyleSheet } from "react-native";

import { MobileApp } from "./src/app/MobileApp";
import { createMobileWalletSession } from "./src/wallet/mobile-wallet";

const session = createMobileWalletSession();

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <MobileApp session={session} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
});
