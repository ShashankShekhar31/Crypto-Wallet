/* global __ENV */

import http from "k6/http";
import { check, sleep } from "k6";

const API_A = __ENV.K6_API_A || "http://localhost:3000";
const API_B = __ENV.K6_API_B || "http://localhost:3002";

export const options = {
  scenarios: {
    api_a: {
      executor: "constant-vus",
      vus: 5,
      duration: "20s",
      exec: "apiA",
    },

    api_b: {
      executor: "constant-vus",
      vus: 5,
      duration: "20s",
      exec: "apiB",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export function apiA() {
  const response = http.get(`${API_A}/health`, {
    tags: {
      instance: "api-a",
    },
  });

  check(response, {
    "api-a health returns 200": (res) => res.status === 200,
  });

  sleep(1);
}

export function apiB() {
  const response = http.get(`${API_B}/health`, {
    tags: {
      instance: "api-b",
    },
  });

  check(response, {
    "api-b health returns 200": (res) => res.status === 200,
  });

  sleep(1);
}
