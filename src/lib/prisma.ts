import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaNeon } from "@prisma/adapter-neon";
import type { PrismaClient as PrismaClientType } from "@/generated/prisma/client";
let neonWebSocketSetup: Promise<void> | undefined;
let nodePrismaClient: PrismaClientType | undefined;
const clients = new WeakMap<object, PrismaClientType>();
async function getPrismaClient(): Promise<PrismaClientType> {
  const adapter = () =>
    new PrismaNeon({
      connectionString: process.env.DATABASE_URL!,
    });
  if (process.env.NODE_ENV === "development") {
    neonWebSocketSetup ??= Promise.all([
      import("@neondatabase/serverless"),
      import("node:dns"),
    ]).then(([, { setDefaultResultOrder }]) => {
      setDefaultResultOrder("ipv4first");
    });
    await neonWebSocketSetup;
    if (!nodePrismaClient) {
      const { PrismaClient: NodePrismaClient } =
        await import("@/generated/prisma-node/client");
      nodePrismaClient = new NodePrismaClient({
        adapter: adapter(),
      }) as unknown as PrismaClientType;
    }
    return nodePrismaClient;
  }
  const { ctx } = await getCloudflareContext({ async: true });
  const key = ctx as object;
  let client = clients.get(key);
  if (!client) {
    const { PrismaClient: WorkerdPrismaClient } =
      await import("@/generated/prisma/client");
    client = new WorkerdPrismaClient({
      adapter: adapter(),
    }) as unknown as PrismaClientType;
    clients.set(key, client);
  }
  return client;
}

async function resolvePath(path: PropertyKey[]): Promise<unknown> {
  let value: unknown = await getPrismaClient();
  for (const key of path) {
    if (
      value === null ||
      (typeof value !== "object" && typeof value !== "function")
    ) {
      throw new Error("Invalid Prisma client path.");
    }
    value = Reflect.get(value, key);
  }
  return value;
}
function createPrismaProxy(path: PropertyKey[] = []): object {
  return new Proxy({}, {
    get(_target, property) {
      if (property === "then") return undefined;
      if (property === Symbol.toStringTag) {
        return path.length ? "PrismaDelegate" : "PrismaClient";
      }
      if (
        path.length === 0 &&
        typeof property === "string" &&
        !property.startsWith("$")
      ) {
        return createPrismaProxy([...path, property]);
      }
      return async (...args: unknown[]) => {
        const owner = await resolvePath(path);
        if (
          owner === null ||
          (typeof owner !== "object" && typeof owner !== "function")
        ) {
          throw new Error("Invalid Prisma client owner.");
        }
        const method = Reflect.get(owner, property, owner);
        if (typeof method !== "function") {
          throw new Error(
            `prisma.${[...path, property].join(".")} is not a function`
          );
        }
        return Reflect.apply(method, owner, args);
      };
    },
  });
}
export const prisma = createPrismaProxy() as PrismaClientType;
