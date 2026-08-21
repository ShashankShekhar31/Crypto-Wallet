import Fastify from "fastify";

import { config } from "./index.js";
import { healthRoutes } from "./routes/health.js";
import { ApiError } from "./errors.js";

const app = Fastify({
  logger: true,
});

app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof ApiError) {
        return reply.status(error.statusCode).send({
            error: {
            code: error.code,
            message: error.message,
            },
        });
    }

    return reply.status(500).send({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error",
          },
      });
  });

await app.register(healthRoutes);

const start = async () => {
  try {
    await app.listen({
      host: "127.0.0.1",
      port: config.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();