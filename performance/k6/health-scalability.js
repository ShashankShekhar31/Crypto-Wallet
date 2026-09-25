/* global __ENV */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    health_scalability: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "10s", target: 5 },
        { duration: "10s", target: 10 },
        { duration: "10s", target: 20 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/health`);

  check(response, {
    "health returns 200": (res) => res.status === 200,
  });

  sleep(1);
}
