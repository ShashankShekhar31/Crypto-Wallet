import * as LocalAuthentication from "expo-local-authentication";

export interface BiometricAvailability {
  supported: boolean;
  enrolled: boolean;
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const [supported, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);

  return {
    supported,
    enrolled,
  };
}

export async function authenticateWithBiometrics(
  promptMessage = "Unlock your wallet",
): Promise<boolean> {
  const availability = await getBiometricAvailability();

  if (!availability.supported || !availability.enrolled) {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
    biometricsSecurityLevel: "strong",
  });

  return result.success;
}
