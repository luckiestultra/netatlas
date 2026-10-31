import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { assertManagedPaths } from './managed-paths.mjs';

// All public sync operations share this lock, including dry runs and recovery.
// Never infer that a lock is stale from a PID or age: interruption needs review.
export async function withSyncLock(root, operation) {
  const relative = '.cache/sync.lock';
  await assertManagedPaths(root, [relative]);
  await mkdir(path.join(root, '.cache'), { recursive: true });
  await assertManagedPaths(root, [relative]);
  const target = path.join(root, relative);
  let handle;
  try { handle = await open(target, 'wx+', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Sync lock already exists; another operation may be active. Inspect the lock before removing it: ' + target);
    throw error;
  }
  const owner = Buffer.from(JSON.stringify({ pid: process.pid, token: randomUUID() }) + '\n');
  let identity, markerWritten = false, failure;
  async function assertOwned() {
    await assertManagedPaths(root, [relative]);
    const current = await lstat(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    const changed = () => new Error('Sync lock ownership changed; preserving the current lock: ' + target);
    if (!identity || !current?.isFile() || current.dev !== identity.dev || current.ino !== identity.ino
      || current.size > owner.length || (markerWritten && current.size !== owner.length)) throw changed();
    // Read through our original descriptor, bounded to the marker size. Never
    // follow a replacement path or read arbitrary manual contents during cleanup.
    const contents = Buffer.alloc(owner.length + 1);
    const { bytesRead } = await handle.read(contents, 0, contents.length, 0);
    if ((markerWritten && bytesRead !== owner.length) || !owner.subarray(0, bytesRead).equals(contents.subarray(0, bytesRead))) throw changed();
  }
  try {
    identity = await handle.stat();
    await handle.writeFile(owner);
    markerWritten = true;
    return await operation(assertOwned);
  } catch (error) { failure = error; throw error; }
  finally {
    try {
      await assertOwned();
      await unlink(target);
    } catch (error) {
      if (failure) throw new AggregateError([failure, error], failure.message + '; ' + error.message);
      throw error;
    } finally { await handle.close(); }
  }
}
