import {
  authorizeDAppRequest,
  createDAppApproval,
  createDAppPermission,
  createDAppRequest,
  type CreateDAppRequestInput,
  type DAppApproval,
  type DAppPermission,
  type DAppRequest,
} from "@crypto-wallet/dapp-core";

type PendingRequest = {
  request: DAppRequest;
  senderTabId?: number;
};

type WalletResponse =
  | {
      ok: true;
      request: DAppRequest;
    }
  | {
      ok: false;
      error: string;
    };

type ExtensionControlMessage =
  | {
      type: "CRYPTO_WALLET_GET_PENDING_REQUEST";
    }
  | {
      type: "CRYPTO_WALLET_APPROVE";
      requestId: string;
    }
  | {
      type: "CRYPTO_WALLET_REJECT";
      requestId: string;
    };

const pendingRequests = new Map<string, PendingRequest>();
const permissions = new Map<string, DAppPermission>();

function isExtensionControlMessage(message: unknown): message is ExtensionControlMessage {
  if (message === null || typeof message !== "object") {
    return false;
  }

  const type = (message as { type?: unknown }).type;

  return (
    type === "CRYPTO_WALLET_GET_PENDING_REQUEST" ||
    type === "CRYPTO_WALLET_APPROVE" ||
    type === "CRYPTO_WALLET_REJECT"
  );
}

type DAppRequestMessage = {
  readonly type: "CRYPTO_WALLET_REQUEST";
  readonly request: CreateDAppRequestInput;
};

function isDAppRequestMessage(message: unknown): message is DAppRequestMessage {
  if (message === null || typeof message !== "object") {
    return false;
  }

  const candidate = message as {
    type?: unknown;
    request?: unknown;
  };

  return (
    candidate.type === "CRYPTO_WALLET_REQUEST" &&
    candidate.request !== null &&
    typeof candidate.request === "object"
  );
}

function permissionKey(request: DAppRequest): string {
  return `${request.origin}|${request.accountId}|${request.chain}`;
}

function getPermission(request: DAppRequest): DAppPermission | undefined {
  return permissions.get(permissionKey(request));
}

function storePermission(request: DAppRequest): DAppPermission {
  const permission = createDAppPermission({
    origin: request.origin,
    accountId: request.accountId,
    chain: request.chain,
    capabilities: ["connect", "sign", "transact"],
  });

  permissions.set(permissionKey(request), permission);

  return permission;
}

async function openApprovalPopup(): Promise<void> {
  await chrome.action.openPopup();
}

/**
 * dApp → extension request boundary.
 *
 * Only actual dApp request messages are handled here.
 * Popup control messages are deliberately ignored by this listener.
 */
chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse: (response: WalletResponse) => void) => {
    if (!isDAppRequestMessage(message)) {
      return false;
    }

    try {
      const request = createDAppRequest(message.request);

      const existingPermission = getPermission(request);

      if (request.type !== "connect" && existingPermission === undefined) {
        throw new Error("No permission exists for this dApp request");
      }

      if (request.type !== "connect" && existingPermission !== undefined) {
        authorizeDAppRequest(request, existingPermission);
      }

      const pendingRequest: PendingRequest = {
        request,
      };

      if (sender.tab?.id !== undefined) {
        pendingRequest.senderTabId = sender.tab.id;
      }

      pendingRequests.set(request.id, pendingRequest);

      void openApprovalPopup()
        .then(() => {
          sendResponse({
            ok: true,
            request,
          });
        })
        .catch((error: unknown) => {
          pendingRequests.delete(request.id);

          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to open approval popup",
          });
        });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  },
);

/**
 * Popup → extension control boundary.
 *
 * Handles pending-request lookup and approval/rejection decisions.
 */
chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: unknown) => void) => {
    if (!isExtensionControlMessage(message)) {
      return false;
    }

    try {
      if (message.type === "CRYPTO_WALLET_GET_PENDING_REQUEST") {
        const pending = pendingRequests.values().next().value as PendingRequest | undefined;

        sendResponse({
          ok: true,
          request: pending?.request ?? null,
        });

        return true;
      }

      const pending = pendingRequests.get(message.requestId);

      if (pending === undefined) {
        throw new Error("Pending dApp request not found");
      }

      let approval: DAppApproval;

      if (message.type === "CRYPTO_WALLET_APPROVE") {
        if (pending.request.type === "connect") {
          storePermission(pending.request);
        } else {
          const permission = getPermission(pending.request);

          if (permission === undefined) {
            throw new Error("No permission exists for this dApp request");
          }

          authorizeDAppRequest(pending.request, permission);
        }

        approval = createDAppApproval(pending.request, "approve");
      } else {
        approval = createDAppApproval(pending.request, "reject");
      }

      pendingRequests.delete(message.requestId);

      if (pending.senderTabId !== undefined) {
        chrome.tabs.sendMessage(pending.senderTabId, {
          type: "CRYPTO_WALLET_APPROVAL_RESPONSE",
          approval,
        });
      }

      sendResponse({
        ok: true,
        approval,
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return true;
  },
);
