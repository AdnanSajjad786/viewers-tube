import ws from "ws";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "../src/generated/prisma-node/client";
import { PrismaNeon } from "@prisma/adapter-neon";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });
