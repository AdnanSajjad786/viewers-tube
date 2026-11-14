import { Agent } from "node:https";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { S3Client } from "@aws-sdk/client-s3";
import { decryptStorageSecret } from "@/lib/storage-crypto";

type B2Connection = {
  region: string;
  endpoint: string;
  keyId: string;
  encryptedApplicationKey: string;
};

export function createB2Client(connection: B2Connection): S3Client {
  return new S3Client({
    region: connection.region,
    endpoint: connection.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: connection.keyId,
      secretAccessKey: decryptStorageSecret(
        connection.encryptedApplicationKey
      ),
    },
    requestHandler: new NodeHttpHandler({
      httpsAgent: new Agent({ keepAlive: true, family: 4 }),
      connectionTimeout: 10000,
      requestTimeout: 20000,
    }),
  });
}


type B2Credentials = {
  region: string;
  endpoint: string;
  keyId: string;
  applicationKey: string;
};

export function createB2ClientFromCredentials(
  credentials: B2Credentials
): S3Client {
  return new S3Client({
    region: credentials.region,
    endpoint: credentials.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: credentials.keyId,
      secretAccessKey: credentials.applicationKey,
    },
    requestHandler: new NodeHttpHandler({
      httpsAgent: new Agent({ keepAlive: true, family: 4 }),
      connectionTimeout: 10000,
      requestTimeout: 20000,
    }),
  });
}
