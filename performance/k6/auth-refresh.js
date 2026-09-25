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
    auth_refresh_baseline: {
      executor: "constant-vus",
      vus: 1,
      duration: "10s",
    },
  },

  thresholds: {
    "http_req_failed{phase:refresh}": ["rate<0.01"],
    "http_req_duration{phase:refresh}": ["p(95)<500"],
    "checks{phase:refresh}": ["rate>0.99"],
  },
};

export function setup() {
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
      tags: {
        phase: "setup",
      },
    },
  );

  check(response, {
    "setup login returns 200": (res) => res.status === 200,
  });

  if (response.status !== 200) {
    throw new Error(`Setup login failed with status ${response.status}`);
  }

  const body = response.json();

  if (
    !body ||
    !body.data ||
    typeof body.data.refreshToken !== "string" ||
    body.data.refreshToken.length === 0
  ) {
    throw new Error("Setup login did not return a refresh token");
  }

  return {
    refreshToken: body.data.refreshToken,
  };
}

export default function (data) {
  const response = http.post(
    `${BASE_URL}/api/v1/auth/refresh`,
    JSON.stringify({
      refreshToken: data.refreshToken,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
      tags: {
        phase: "refresh",
      },
    },
  );

  const passed = check(
    response,
    {
      "refresh returns 200": (res) => res.status === 200,
      "refresh returns replacement token": (res) => {
        const body = res.json();

        return (
          body &&
          body.data &&
          typeof body.data.refreshToken === "string" &&
          body.data.refreshToken.length > 0
        );
      },
    },
    {
      phase: "refresh",
    },
  );

  if (!passed) {
    throw new Error(`Refresh failed with status ${response.status}`);
  }

  data.refreshToken = response.json().data.refreshToken;

  sleep(1);
}
