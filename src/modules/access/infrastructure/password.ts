import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LEN = 64;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

/**
 * scrypt N = 2^cost. 16 measured about 190 ms per hash on the build machine
 * (4 cores): the power of two closest to 250 ms (17 was about 390 ms). Lower it
 * on a slow server with PASSWORD_HASH_COST (14..20). Memory per hash is
 * 128 × N × r bytes: 64 MB at 16.
 */
export const DEFAULT_PASSWORD_HASH_COST = 16;
const MIN_COST = 14;
const MAX_COST = 20;
/** Hashes written before costs were stored: "salt:hex", Node's default N = 2^14. */
const LEGACY_COST = 14;

type HashParams = { cost: number; blockSize: number; parallelism: number };

function currentCost(): number {
  const raw = process.env.PASSWORD_HASH_COST;
  if (raw === undefined) return DEFAULT_PASSWORD_HASH_COST;
  const cost = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(cost) || cost < MIN_COST || cost > MAX_COST) {
    throw new Error(`PASSWORD_HASH_COST must be an integer from ${MIN_COST} to ${MAX_COST}.`);
  }
  return cost;
}

function derive(password: string, salt: string, params: HashParams): Promise<Buffer> {
  const N = 2 ** params.cost;
  const options: ScryptOptions = {
    N,
    r: params.blockSize,
    p: params.parallelism,
    maxmem: 256 * N * params.blockSize,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

type Parsed = HashParams & { salt: string; hash: string };

/** "scrypt:cost:r:p:salt:hex", or the legacy "salt:hex". Null when malformed. */
function parse(stored: string): Parsed | null {
  const parts = stored.split(":");
  if (parts.length === 2) {
    const [salt, hash] = parts as [string, string];
    if (!salt || !hash) return null;
    return { cost: LEGACY_COST, blockSize: BLOCK_SIZE, parallelism: PARALLELISM, salt, hash };
  }
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, cost, blockSize, parallelism, salt, hash] = parts as string[] as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const params = { cost: Number(cost), blockSize: Number(blockSize), parallelism: Number(parallelism) };
  if (
    !Number.isInteger(params.cost) ||
    params.cost < MIN_COST ||
    params.cost > MAX_COST ||
    params.blockSize !== BLOCK_SIZE ||
    params.parallelism !== PARALLELISM ||
    !salt ||
    !hash
  ) {
    return null;
  }
  return { ...params, salt, hash };
}

/**
 * Store the parameters with the hash, never the password. Used by login,
 * the seed and scripts/set-password.ts.
 */
export async function hashPassword(password: string): Promise<string> {
  const params = { cost: currentCost(), blockSize: BLOCK_SIZE, parallelism: PARALLELISM };
  const salt = randomBytes(16).toString("hex");
  const derived = await derive(password, salt, params);
  return `scrypt:${params.cost}:${params.blockSize}:${params.parallelism}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const derived = await derive(password, parsed.salt, parsed);
  const expected = Buffer.from(parsed.hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** True when the stored hash was made with other parameters than the current cost. */
export function passwordNeedsRehash(stored: string): boolean {
  const parsed = parse(stored);
  return !parsed || parsed.cost !== currentCost();
}

let dummyHash: Promise<string> | undefined;

/**
 * Verify against a throwaway hash at the current cost (security audit S-4).
 * Called when the account does not exist, so an unknown identifier costs the
 * same time as a wrong password. Always false.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
  return false;
}
