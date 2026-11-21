/**
 * Packing a backup and its photos into one zip, and unpacking it again.
 * Pure: bytes in, bytes out, so it runs under the tests unchanged.
 *
 * Layout of a version 2 backup file:
 *   backup.json        the data, as written by serializeBackup
 *   photos/<name>      every Journey photo, under its stored file name
 *
 * A version 1 backup is a plain .json file; readBackupBytes accepts that
 * too, so files from before pregnancy mode still restore.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Zippable } from 'fflate';

const DATA_ENTRY = 'backup.json';
const PHOTO_PREFIX = 'photos/';

export type BackupPhoto = { name: string; bytes: Uint8Array };

export function buildBackupArchive(json: string, photos: BackupPhoto[]): Uint8Array {
  const entries: Zippable = { [DATA_ENTRY]: strToU8(json) };
  for (const photo of photos) {
    // Photos are already compressed; storing them as-is saves time and
    // battery for no loss in size.
    entries[PHOTO_PREFIX + photo.name] = [photo.bytes, { level: 0 }];
  }
  return zipSync(entries, { level: 6 });
}

export type ReadBackupResult =
  | { ok: true; json: string; photos: Map<string, Uint8Array> }
  /** A zip, but not one of ours, or damaged. */
  | { ok: false; error: 'invalid' };

/** True when the bytes start with a zip file's signature, "PK\u0003\u0004". */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Reads a backup file's bytes: a version 2 zip, or a version 1 .json.
 * Only `backup.json` and plain file names under `photos/` are taken from
 * a zip; anything else in it is ignored.
 */
export function readBackupBytes(bytes: Uint8Array): ReadBackupResult {
  if (!isZip(bytes)) {
    return { ok: true, json: strFromU8(bytes), photos: new Map() };
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return { ok: false, error: 'invalid' };
  }

  const data = entries[DATA_ENTRY];
  if (!data) {
    return { ok: false, error: 'invalid' };
  }

  const photos = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(entries)) {
    if (!path.startsWith(PHOTO_PREFIX)) continue;
    const name = path.slice(PHOTO_PREFIX.length);
    if (/^[A-Za-z0-9._-]+$/.test(name) && !name.startsWith('.')) {
      photos.set(name, content);
    }
  }

  return { ok: true, json: strFromU8(data), photos };
}
