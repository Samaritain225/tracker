/**
 * Tests for packing and unpacking backup files.
 */

import { strToU8, zipSync } from 'fflate';

import { buildBackupArchive, isZip, readBackupBytes } from './backup-archive';

describe('backup archive', () => {
  const json = '{"app":"lumi","formatVersion":2}';
  const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  it('round-trips the data and every photo', () => {
    const archive = buildBackupArchive(json, [{ name: 'bump-20.jpg', bytes: photo }]);
    expect(isZip(archive)).toBe(true);
    const result = readBackupBytes(archive);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.json).toBe(json);
    expect(Array.from(result.photos.get('bump-20.jpg')!)).toEqual(Array.from(photo));
  });

  it('reads a version 1 .json file as it is', () => {
    const result = readBackupBytes(strToU8('{"app":"lumi","formatVersion":1}'));
    expect(result).toEqual({ ok: true, json: '{"app":"lumi","formatVersion":1}', photos: new Map() });
  });

  it('refuses a zip without backup.json', () => {
    const other = zipSync({ 'notes.txt': strToU8('hello') });
    expect(readBackupBytes(other)).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuses a damaged zip', () => {
    const archive = buildBackupArchive(json, []);
    const damaged = archive.slice(0, archive.length - 10);
    expect(readBackupBytes(damaged)).toEqual({ ok: false, error: 'invalid' });
  });

  it('ignores photo entries whose names could reach outside the folder', () => {
    const crafted = zipSync({
      'backup.json': strToU8(json),
      'photos/../evil.jpg': photo,
      'photos/ok.jpg': photo,
    });
    const result = readBackupBytes(crafted);
    expect(result.ok && [...result.photos.keys()]).toEqual(['ok.jpg']);
  });
});
