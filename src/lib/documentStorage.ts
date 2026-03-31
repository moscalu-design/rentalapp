import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

const LOCAL_STORAGE_SCHEME = "local://";
const LOCAL_STORAGE_ROOT = path.join(process.cwd(), ".storage");

function canUseLocalFallback() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.LOCAL_FILE_STORAGE_ENABLED === "true"
  );
}

function isLocalStorageUrl(storageUrl: string) {
  return storageUrl.startsWith(LOCAL_STORAGE_SCHEME);
}

function getLocalStoragePath(storageUrl: string) {
  if (!isLocalStorageUrl(storageUrl)) {
    throw new Error("Not a local storage URL.");
  }

  const relativePath = storageUrl.slice(LOCAL_STORAGE_SCHEME.length);
  const absolutePath = path.resolve(LOCAL_STORAGE_ROOT, relativePath);
  const rootWithSep = `${LOCAL_STORAGE_ROOT}${path.sep}`;

  if (absolutePath !== LOCAL_STORAGE_ROOT && !absolutePath.startsWith(rootWithSep)) {
    throw new Error("Invalid local storage path.");
  }

  return absolutePath;
}

async function writeLocalFile(storagePath: string, file: Buffer, contentType: string) {
  const fullPath = path.resolve(LOCAL_STORAGE_ROOT, storagePath);
  const rootWithSep = `${LOCAL_STORAGE_ROOT}${path.sep}`;

  if (fullPath !== LOCAL_STORAGE_ROOT && !fullPath.startsWith(rootWithSep)) {
    throw new Error("Invalid storage path.");
  }

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, file);

  return {
    url: `${LOCAL_STORAGE_SCHEME}${storagePath}`,
    contentType,
  };
}

export async function storeDocument(
  storagePath: string,
  file: Buffer,
  contentType: string
) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(storagePath, file, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      return {
        url: blob.url,
        provider: "blob" as const,
      };
    } catch (error) {
      if (!canUseLocalFallback()) {
        throw error;
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[documentStorage] Blob storage unavailable, using local fallback: ${errMsg}`
      );
    }
  } else if (!canUseLocalFallback()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const localFile = await writeLocalFile(storagePath, file, contentType);
  return {
    url: localFile.url,
    provider: "local" as const,
  };
}

export async function deleteStoredDocument(storageUrl: string) {
  if (isLocalStorageUrl(storageUrl)) {
    const filePath = getLocalStoragePath(storageUrl);
    await rm(filePath, { force: true });
    return;
  }

  await del(storageUrl);
}

export async function readStoredDocument(storageUrl: string) {
  if (isLocalStorageUrl(storageUrl)) {
    const filePath = getLocalStoragePath(storageUrl);
    return readFile(filePath);
  }

  const response = await fetch(storageUrl);
  if (!response.ok) {
    throw new Error(`Storage responded with ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function getStorageModeSummary() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return canUseLocalFallback() ? "blob-with-local-fallback" : "blob-only";
  }

  return canUseLocalFallback() ? "local" : "unconfigured";
}
