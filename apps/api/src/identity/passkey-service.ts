import { randomUUID } from "node:crypto";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

import {
  IdentityRepository,
} from "./repository.js";

import {
  PasskeyRepository,
} from "./passkey-repository.js";

import {
  PasskeyChallengeStore,
} from "./passkey-challenge-store.js";

const REGISTRATION_CHALLENGE_TYPE =
  "registration" as const;

const AUTHENTICATION_CHALLENGE_TYPE =
  "authentication" as const;

export interface PasskeyServiceOptions {
  identityRepository: IdentityRepository;
  passkeyRepository: PasskeyRepository;
  challengeStore: PasskeyChallengeStore;
  rpId: string;
  rpName: string;
  origin: string;
}

export interface StartPasskeyRegistrationInput {
  identityAccountId: string;
}

export interface StartPasskeyRegistrationResult {
  ceremonyId: string;
  options: Awaited<
    ReturnType<typeof generateRegistrationOptions>
  >;
}

export interface FinishPasskeyRegistrationInput {
  ceremonyId: string;
  response: RegistrationResponseJSON;
}

export interface StartPasskeyAuthenticationInput {
  identityAccountId: string;
}

export interface StartPasskeyAuthenticationResult {
  ceremonyId: string;
  options: Awaited<
    ReturnType<typeof generateAuthenticationOptions>
  >;
}

export interface FinishPasskeyAuthenticationInput {
  ceremonyId: string;
  response: AuthenticationResponseJSON;
}

export interface FinishedPasskeyAuthentication {
  identityAccountId: string;
  passkey: Awaited<
    ReturnType<
      PasskeyRepository["findByCredentialId"]
    >
  >;
}

export class PasskeyService {
  private readonly identityRepository: IdentityRepository;
  private readonly passkeyRepository: PasskeyRepository;
  private readonly challengeStore: PasskeyChallengeStore;
  private readonly rpId: string;
  private readonly rpName: string;
  private readonly origin: string;

  constructor(options: PasskeyServiceOptions) {
    this.identityRepository =
      options.identityRepository;

    this.passkeyRepository =
      options.passkeyRepository;

    this.challengeStore =
      options.challengeStore;

    this.rpId = options.rpId;
    this.rpName = options.rpName;
    this.origin = options.origin;
  }

  async startRegistration(
    input: StartPasskeyRegistrationInput,
  ): Promise<StartPasskeyRegistrationResult> {
    validateIdentityAccountId(
      input.identityAccountId,
    );

    const identity =
      await this.identityRepository.findById(
        input.identityAccountId,
      );

    if (!identity) {
      throw new Error(
        "Identity account not found",
      );
    }

    if (identity.status !== "active") {
      throw new Error(
        "Identity account is not active",
      );
    }

    const existingPasskeys =
      await this.passkeyRepository
        .findActiveByIdentityAccountId(
          identity.id,
        );

    const options =
      await generateRegistrationOptions({
        rpName: this.rpName,
        rpID: this.rpId,

        userName: identity.normalizedEmail,

        userID: uuidToBytes(identity.id),

        attestationType: "none",

        excludeCredentials:
          existingPasskeys.map(
            (passkey) => ({
              id: bufferToBase64Url(
                passkey.credentialId,
              ),
            }),
          ),

        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      });

    const ceremonyId = randomUUID();

    await this.challengeStore.save(
      ceremonyId,
      {
        type: REGISTRATION_CHALLENGE_TYPE,
        identityAccountId: identity.id,
        deviceId: null,
        challenge: options.challenge,
      },
    );

    return {
      ceremonyId,
      options,
    };
  }

  async finishRegistration(
    input: FinishPasskeyRegistrationInput,
  ) {
    if (
      typeof input.ceremonyId !== "string" ||
      input.ceremonyId.trim().length === 0
    ) {
      throw new Error(
        "Passkey ceremony ID is required",
      );
    }

    const challenge =
      await this.challengeStore.consume(
        input.ceremonyId,
      );

    if (!challenge) {
      throw new Error(
        "Passkey challenge not found or expired",
      );
    }

    if (challenge.type !== REGISTRATION_CHALLENGE_TYPE) {
      throw new Error(
        "Invalid passkey ceremony type",
      );
    }

    if (!challenge.identityAccountId) {
      throw new Error(
        "Passkey identity account is missing",
      );
    }

    const identity =
      await this.identityRepository.findById(
        challenge.identityAccountId,
      );

    if (!identity) {
      throw new Error(
        "Identity account not found",
      );
    }

    if (identity.status !== "active") {
      throw new Error(
        "Identity account is not active",
      );
    }

    const verification =
      await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge:
          challenge.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
        requireUserVerification: true,
      });

    if (!verification.verified) {
      throw new Error(
        "Passkey registration verification failed",
      );
    }

    const registrationInfo =
      verification.registrationInfo;

    if (!registrationInfo) {
      throw new Error(
        "Passkey registration information is missing",
      );
    }

    const credential =
      registrationInfo.credential;

    const existing =
      await this.passkeyRepository
        .findByCredentialId(
          Buffer.from(
            credential.id,
            "base64url",
          ),
        );

    if (existing) {
      throw new Error(
        "Passkey credential already exists",
      );
    }

    const passkey =
      await this.passkeyRepository
        .createCredential({
          identityAccountId: identity.id,
          credentialId:
            Buffer.from(
              credential.id,
              "base64url",
            ),
          publicKey:
            Buffer.from(
              credential.publicKey,
            ),
          signCount:
            credential.counter,
          backedUp:
            registrationInfo.credentialBackedUp,
        });

    return {
      identityAccount: identity,
      passkey,
    };
  }
  async startAuthentication(
  input: StartPasskeyAuthenticationInput,
): Promise<StartPasskeyAuthenticationResult> {
  validateIdentityAccountId(
    input.identityAccountId,
  );

  const identity =
    await this.identityRepository.findById(
      input.identityAccountId,
    );

  if (!identity) {
    throw new Error(
      "Identity account not found",
    );
  }

  if (identity.status !== "active") {
    throw new Error(
      "Identity account is not active",
    );
  }

  const passkeys =
    await this.passkeyRepository
      .findActiveByIdentityAccountId(
        identity.id,
      );

  if (passkeys.length === 0) {
    throw new Error(
      "No active passkey found",
    );
  }

  const options =
    await generateAuthenticationOptions({
      rpID: this.rpId,

      allowCredentials:
        passkeys.map(
          (passkey) => ({
            id: bufferToBase64Url(
              passkey.credentialId,
            ),
          }),
        ),

      userVerification: "required",
    });

  const ceremonyId = randomUUID();

  await this.challengeStore.save(
    ceremonyId,
    {
      type: AUTHENTICATION_CHALLENGE_TYPE,
      identityAccountId: identity.id,
      deviceId: null,
      challenge: options.challenge,
    },
  );

  return {
    ceremonyId,
    options,
  };
}

  async finishAuthentication(
  input: FinishPasskeyAuthenticationInput,
): Promise<FinishedPasskeyAuthentication> {
  if (
    typeof input.ceremonyId !== "string" ||
    input.ceremonyId.trim().length === 0
  ) {
    throw new Error(
      "Passkey ceremony ID is required",
    );
  }

  const challenge =
    await this.challengeStore.consume(
      input.ceremonyId,
    );

  if (!challenge) {
    throw new Error(
      "Passkey challenge not found or expired",
    );
  }

  if (challenge.type !== AUTHENTICATION_CHALLENGE_TYPE) {
    throw new Error(
      "Invalid passkey ceremony type",
    );
  }

  if (!challenge.identityAccountId) {
    throw new Error(
      "Passkey identity account is missing",
    );
  }

  const identity =
    await this.identityRepository.findById(
      challenge.identityAccountId,
    );

  if (!identity) {
    throw new Error(
      "Identity account not found",
    );
  }

  if (identity.status !== "active") {
    throw new Error(
      "Identity account is not active",
    );
  }

  const credentialId =
    Buffer.from(
      input.response.id,
      "base64url",
    );

  const passkey =
    await this.passkeyRepository
      .findByCredentialId(
        credentialId,
      );

  if (!passkey) {
    throw new Error(
      "Passkey credential not found",
    );
  }

  if (passkey.revokedAt !== null) {
    throw new Error(
      "Passkey credential is revoked",
    );
  }

  if (
    passkey.identityAccountId !==
    identity.id
  ) {
    throw new Error(
      "Passkey credential does not belong to identity account",
    );
  }

  const publicKey =
    new Uint8Array(
      passkey.publicKey.length,
    );

  publicKey.set(passkey.publicKey);

  const verification =
    await verifyAuthenticationResponse({
      response: input.response,

      expectedChallenge:
        challenge.challenge,

      expectedOrigin: this.origin,

      expectedRPID: this.rpId,

      requireUserVerification: true,

      credential: {
        id: bufferToBase64Url(
          passkey.credentialId,
        ),

        publicKey,

        counter: passkey.signCount,
      },
    });

  if (!verification.verified) {
    throw new Error(
      "Passkey authentication verification failed",
    );
  }

  const newCounter =
    verification.authenticationInfo
      .newCounter;

  if (
    newCounter < passkey.signCount
  ) {
    throw new Error(
      "Passkey signature counter rollback detected",
    );
  }

  if (
    newCounter > passkey.signCount
  ) {
    const updated =
      await this.passkeyRepository
        .updateSignCount(
          passkey.id,
          newCounter,
        );

    if (!updated) {
      throw new Error(
        "Failed to update passkey signature counter",
      );
    }
  }

  const used =
    await this.passkeyRepository.markUsed(
      passkey.id,
    );

  if (!used) {
    throw new Error(
      "Failed to mark passkey as used",
    );
  }

  return {
    identityAccountId: identity.id,
    passkey: used,
  };
}
}

function validateIdentityAccountId(
  identityAccountId: string,
): void {
  if (
    typeof identityAccountId !== "string" ||
    identityAccountId.trim().length === 0
  ) {
    throw new Error(
      "Identity account ID is required",
    );
  }
}

function uuidToBytes(
  value: string,
): Uint8Array<ArrayBuffer> {
  const normalized =
    value.replace(/-/g, "");

  if (!/^[0-9a-fA-F]{32}$/.test(normalized)) {
    throw new Error(
      "Identity account ID must be a UUID",
    );
  }

  const bytes = Uint8Array.from(
    Buffer.from(normalized, "hex"),
  );

  return bytes as Uint8Array<ArrayBuffer>;
}

function bufferToBase64Url(
  value: Buffer,
): string {
  return value.toString("base64url");
}