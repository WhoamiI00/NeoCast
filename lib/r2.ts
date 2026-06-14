import { S3Client } from "@aws-sdk/client-s3";
import { getEnv } from "@/lib/utils";

let _r2: S3Client | null = null;
let _bucket: string | null = null;
let _publicBase: string | null = null;

function getR2(): S3Client {
  if (_r2) return _r2;
  const accountId = getEnv("R2_ACCOUNT_ID");
  _r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return _r2;
}

export const r2 = new Proxy({} as S3Client, {
  get(_, prop) {
    const target = getR2() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === "function"
      ? (value as Function).bind(getR2())
      : value;
  },
});

export function getR2Bucket(): string {
  if (!_bucket) _bucket = getEnv("R2_BUCKET");
  return _bucket;
}

export function getR2PublicBase(): string {
  if (!_publicBase)
    _publicBase = getEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  return _publicBase;
}

export const publicUrlFor = (key: string) => `${getR2PublicBase()}/${key}`;
