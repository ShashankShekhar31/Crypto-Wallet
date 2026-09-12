import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    metricsStartTime?: bigint;
  }
}
