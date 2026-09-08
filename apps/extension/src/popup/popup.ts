import type { DAppRequest } from "@crypto-wallet/dapp-core";

const status = document.querySelector<HTMLParagraphElement>("#status");
const requestSection = document.querySelector<HTMLElement>("#request");
const requestType = document.querySelector<HTMLParagraphElement>("#request-type");
const origin = document.querySelector<HTMLElement>("#origin");
const account = document.querySelector<HTMLElement>("#account");
const chain = document.querySelector<HTMLElement>("#chain");
const details = document.querySelector<HTMLPreElement>("#details");
const approve = document.querySelector<HTMLButtonElement>("#approve");
const reject = document.querySelector<HTMLButtonElement>("#reject");

if (
  !status ||
  !requestSection ||
  !requestType ||
  !origin ||
  !account ||
  !chain ||
  !details ||
  !approve ||
  !reject
) {
  throw new Error("Wallet approval UI is incomplete");
}

const statusElement = status;
const requestSectionElement = requestSection;
const requestTypeElement = requestType;
const originElement = origin;
const accountElement = account;
const chainElement = chain;
const detailsElement = details;
const approveButton = approve;
const rejectButton = reject;

let currentRequest: DAppRequest | null = null;

function renderRequest(request: DAppRequest | null): void {
  currentRequest = request;

  if (request === null) {
    requestSectionElement.hidden = true;
    statusElement.hidden = false;
    statusElement.textContent = "No pending requests.";
    return;
  }

  requestSectionElement.hidden = false;
  statusElement.hidden = true;

  requestTypeElement.textContent = `${request.type.toUpperCase()} REQUEST`;
  originElement.textContent = request.origin;
  accountElement.textContent = request.accountId;
  chainElement.textContent = request.chain;

  if (request.type === "sign") {
    detailsElement.textContent = request.message;
  } else if (request.type === "transaction") {
    detailsElement.textContent = JSON.stringify(request.transaction, null, 2);
  } else {
    detailsElement.textContent = "This dApp wants to connect to your wallet.";
  }
}

function sendDecision(decision: "approve" | "reject"): void {
  if (currentRequest === null) {
    return;
  }

  approveButton.disabled = true;
  rejectButton.disabled = true;

  chrome.runtime.sendMessage(
    {
      type: decision === "approve" ? "CRYPTO_WALLET_APPROVE" : "CRYPTO_WALLET_REJECT",
      requestId: currentRequest.id,
    },
    (response: { ok?: boolean; error?: string } | undefined) => {
      if (chrome.runtime.lastError) {
        statusElement.hidden = false;
        requestSectionElement.hidden = true;
        statusElement.textContent = chrome.runtime.lastError.message ?? "Wallet request failed.";
        return;
      }

      if (!response?.ok) {
        approveButton.disabled = false;
        rejectButton.disabled = false;
        statusElement.hidden = false;
        statusElement.textContent = response?.error ?? "Wallet request failed.";
        return;
      }

      renderRequest(null);

      statusElement.textContent =
        decision === "approve" ? "Request approved." : "Request rejected.";
    },
  );
}

approveButton.addEventListener("click", () => {
  sendDecision("approve");
});

rejectButton.addEventListener("click", () => {
  sendDecision("reject");
});

chrome.runtime.sendMessage(
  {
    type: "CRYPTO_WALLET_GET_PENDING_REQUEST",
  },
  (
    response:
      | {
          ok?: boolean;
          request?: DAppRequest | null;
          error?: string;
        }
      | undefined,
  ) => {
    if (chrome.runtime.lastError) {
      statusElement.textContent =
        chrome.runtime.lastError.message ?? "Unable to load wallet request.";
      return;
    }

    if (!response?.ok) {
      statusElement.textContent = response?.error ?? "Unable to load wallet request.";
      return;
    }

    renderRequest(response.request ?? null);
  },
);
