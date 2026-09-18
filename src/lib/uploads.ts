/**
 * Image uploads.
 *
 * Files are written to the local filesystem under the public directory, because
 * an object storage account is a credential the examiner does not have. The
 * stored path is what `ItemImage.url` holds, the same shape the seed uses, so
 * nothing in the rendering layer knows the difference.
 *
 * Three rules, each with a test:
 *
 * 1. **The application names the file, never the client.** A supplied filename
 *    is used for nothing but its extension, and not even that is trusted: the
 *    extension comes from the detected type. A crafted name cannot escape the
 *    uploads directory or overwrite an existing file.
 * 2. **The bytes decide the type, not the declared content type.** A shell
 *    script announcing itself as `image/png` is refused.
 * 3. **All or nothing.** If any file in a submission is rejected, the ones
 *    already written are removed, so a refused submission leaves nothing.
 */

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Per file. Generous for a phone photograph, small enough to bound the disk. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Per submission. More than this is a gallery, not a listing. */
export const MAX_FILES = 8;

/** Where files land. Overridden in tests so a run cannot litter public/uploads. */
function uploadsDir(): string {
  return process.env.UPLOADS_DIR ?? join(process.cwd(), "public", "uploads");
}

/** The public path prefix matching that directory. */
const PUBLIC_PREFIX = "/uploads";

type Signature = { extension: string; matches: (bytes: Uint8Array) => boolean };

const startsWith = (bytes: Uint8Array, expected: readonly number[]) =>
  expected.every((byte, index) => bytes[index] === byte);

/**
 * The formats a browser will render without help.
 *
 * Checked by leading bytes. This is not a security boundary on its own, but it
 * keeps the uploads directory to what it should hold and refuses the obvious
 * case of something executable wearing an image's content type.
 */
const SIGNATURES: readonly Signature[] = [
  { extension: "png", matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  { extension: "jpg", matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { extension: "gif", matches: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) },
  {
    extension: "webp",
    matches: (b) =>
      startsWith(b, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(b.subarray(8), [0x57, 0x45, 0x42, 0x50]),
  },
];

function detectExtension(bytes: Uint8Array): string | null {
  return SIGNATURES.find((signature) => signature.matches(bytes))?.extension ?? null;
}

export type UploadResult =
  | { ok: true; urls: string[] }
  | { ok: false; reason: string };

/**
 * Write a submission's images.
 *
 * Returns public paths in the order given, which is the order that becomes
 * `sortOrder`: the first file is the card thumbnail.
 */
export async function saveItemImages(files: readonly File[]): Promise<UploadResult> {
  if (files.length === 0) {
    return { ok: false, reason: "Add at least one photograph." };
  }

  if (files.length > MAX_FILES) {
    return { ok: false, reason: `Up to ${MAX_FILES} photographs.` };
  }

  const directory = uploadsDir();
  await mkdir(directory, { recursive: true });

  const written: string[] = [];
  const urls: string[] = [];

  /** Undo, so a refusal halfway through leaves nothing behind. */
  const discard = async () => {
    await Promise.all(written.map((path) => unlink(path).catch(() => undefined)));
  };

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      await discard();
      return {
        ok: false,
        reason: `Each photograph must be under ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB.`,
      };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = detectExtension(bytes);

    if (!extension) {
      await discard();
      return { ok: false, reason: "Photographs must be PNG, JPEG, GIF or WebP." };
    }

    // The name is ours. Nothing from the client reaches the path.
    const name = `${randomUUID()}.${extension}`;
    const path = join(directory, name);

    await writeFile(path, bytes);
    written.push(path);
    urls.push(`${PUBLIC_PREFIX}/${name}`);
  }

  return { ok: true, urls };
}

/** Remove files already written, used when the database write fails after them. */
export async function discardUploads(urls: readonly string[]): Promise<void> {
  const directory = uploadsDir();

  await Promise.all(
    urls.map((url) =>
      unlink(join(directory, url.slice(PUBLIC_PREFIX.length + 1))).catch(() => undefined),
    ),
  );
}
