import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertManagedPaths } from './managed-paths.mjs';
import { normalizeRuleset, stableId } from './rules.mjs';

// Original exact-host policy additions are kept separate from licensed upstream
// selections. They are never interpreted as permission to widen source suffixes.
export async function loadRuleSupplement(root, descriptor, id) {
  if (!descriptor || !stableId.test(id) || descriptor.path !== `src/supplements/${id}.json` || descriptor.license !== 'MIT' || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) throw new Error('Invalid local rule supplement descriptor');
  await assertManagedPaths(root, [descriptor.path]);
  const bytes = await readFile(resolve(root, descriptor.path));
  if (bytes.length > 32768 || createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) throw new Error('Local rule supplement checksum mismatch');
  const object = JSON.parse(bytes);
  if (object.version !== 1 || object.id !== id || object.license !== descriptor.license || typeof object.author !== 'string' || !object.author.trim() || typeof object.updatedAt !== 'string' || !Number.isFinite(Date.parse(object.updatedAt)) || !Array.isArray(object.references) || !object.references.length || object.references.some(url => typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url))) throw new Error('Invalid local rule supplement provenance');
  if (!Array.isArray(object.entries) || !object.entries.length || object.entries.length > 32 || object.entries.some(entry => entry.type !== 'domain')) throw new Error('Local rule supplements require bounded exact host conditions');
  const normalized = normalizeRuleset({ version: 1, id, category: 'supplement', entries: object.entries }).entries;
  if (JSON.stringify(normalized) !== JSON.stringify(object.entries)) throw new Error('Local rule supplement entries must be unique and canonical');
  return { ...object, path: descriptor.path, sha256: descriptor.sha256 };
}
