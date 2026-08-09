export type AdultModeCredential = {
  algorithm: "PBKDF2-SHA-256";
  hash: string;
  iterations: number;
  salt: string;
};

const iterations = 310_000;

export async function createAdultModeCredential(password: string): Promise<AdultModeCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    algorithm: "PBKDF2-SHA-256",
    hash: await derive(password, salt, iterations),
    iterations,
    salt: encode(salt),
  };
}

export async function verifyAdultModeCredential(password: string, credential: AdultModeCredential) {
  const actual = await derive(password, decode(credential.salt), credential.iterations);
  return constantTimeEqual(actual, credential.hash);
}

async function derive(password: string, salt: Uint8Array, rounds: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { hash: "SHA-256", iterations: rounds, name: "PBKDF2", salt },
    key,
    256,
  );
  return encode(new Uint8Array(bits));
}

function encode(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
