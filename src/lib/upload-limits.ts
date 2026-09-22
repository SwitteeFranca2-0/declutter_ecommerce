/**
 * Upload limits, shared by the server and the browser.
 *
 * Separate from `uploads.ts` because that module reaches for `node:fs`, and the
 * submission form is a client component: importing the limits from there would
 * drag the filesystem into the browser bundle.
 */

/** Per file. Generous for a phone photograph, small enough to bound the disk. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Per submission. More than this is a gallery, not a listing. */
export const MAX_FILES = 8;
