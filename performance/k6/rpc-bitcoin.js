import http from "k6/http";
import { check, sleep } from "k6";

const RPC_URL = __ENV.K6_BITCOIN_RPC_URL || "https://blockstream.info/api";

export const options = {
  scenarios: {
    bitcoin_rpc_read: {
      executor: "constant-vus",
      vus: 2,
      duration: "10s",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const response = http.get(`${RPC_URL}/fee-estimates`, {
    tags: {
      phase: "rpc",
      provider: "bitcoin-esplora",
      operation: "fee-estimates",
    },
  });

  check(response, {
    "bitcoin RPC returns 200": (res) => res.status === 200,
    "bitcoin RPC returns JSON": (res) => {
      try {
        const body = res.json();
        return body && typeof body === "object";
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
