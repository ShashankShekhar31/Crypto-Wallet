import { metrics, type Counter, type Histogram } from "@opentelemetry/api";

const METER_NAME = "@crypto-wallet/api";

let httpRequestCounter: Counter | undefined;
let httpRequestErrorCounter: Counter | undefined;
let httpRequestDuration: Histogram | undefined;

function getHttpRequestCounter(): Counter {
  if (httpRequestCounter === undefined) {
    httpRequestCounter = metrics.getMeter(METER_NAME).createCounter("http.server.request.count", {
      description: "Number of HTTP requests received by the API",
    });
  }

  return httpRequestCounter;
}

function getHttpRequestErrorCounter(): Counter {
  if (httpRequestErrorCounter === undefined) {
    httpRequestErrorCounter = metrics
      .getMeter(METER_NAME)
      .createCounter("http.server.request.error.count", {
        description: "Number of HTTP requests that completed with an error",
      });
  }

  return httpRequestErrorCounter;
}

function getHttpRequestDuration(): Histogram {
  if (httpRequestDuration === undefined) {
    httpRequestDuration = metrics
      .getMeter(METER_NAME)
      .createHistogram("http.server.request.duration", {
        description: "HTTP request duration in milliseconds",
        unit: "ms",
      });
  }

  return httpRequestDuration;
}

export function recordHttpRequest(method: string): void {
  getHttpRequestCounter().add(1, {
    method,
  });
}

export function recordHttpResponse(method: string, statusCode: number, durationMs: number): void {
  const attributes = {
    method,
    status_code: statusCode,
  };

  getHttpRequestDuration().record(durationMs, attributes);

  if (statusCode >= 400) {
    getHttpRequestErrorCounter().add(1, attributes);
  }
}
