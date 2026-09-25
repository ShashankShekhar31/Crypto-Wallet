/* global __ENV */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
const EMAIL = __ENV.K6_AUTH_EMAIL;
const PASSWORD = __ENV.K6_AUTH_PASSWORD;
const DEVICE_ID = __ENV.K6_AUTH_DEVICE_ID;

if (!EMAIL || !PASSWORD || !DEVICE_ID) {
  throw new Error("K6_AUTH_EMAIL, K6_AUTH_PASSWORD and K6_AUTH_DEVICE_ID are required");
}

export const options = {
  scenarios: {
    auth_login_smoke: {
      executor: "constant-vus",
      vus: 1,
      duration: "8s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const response = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      deviceId: DEVICE_ID,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  check(response, {
    "login returns 200": (res) => res.status === 200,
  });

  sleep(2);
}
