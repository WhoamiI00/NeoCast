import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/utils";

const accountId = getEnv("R2_ACCOUNT_ID");

export const R2_BUCKET = getEnv("R2_BUCKET");
export const R2_PUBLIC_BASE_URL = getEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
  },
});

export const publicUrlFor = (key: string) => `${R2_PUBLIC_BASE_URL}/${key}`;
