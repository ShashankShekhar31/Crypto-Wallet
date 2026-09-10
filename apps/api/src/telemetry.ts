import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { NodeSDK } from "@opentelemetry/sdk-node";

const DEFAULT_METRICS_PORT = 9464;

export function createTelemetrySdk(port = DEFAULT_METRICS_PORT): NodeSDK {
  const prometheusExporter = new PrometheusExporter({
    port,
  });

  return new NodeSDK({
    serviceName: "@crypto-wallet/api",
    metricReader: prometheusExporter,
  });
}
