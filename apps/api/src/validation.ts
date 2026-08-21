import { z } from "zod";

export const healthQuerySchema = z.object({});

export type HealthQuery = z.infer<typeof healthQuerySchema>;
