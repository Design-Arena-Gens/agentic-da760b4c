'use client';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

export const nanoid = (size = 10): string => {
  let id = '';
  const cryptoObj = typeof crypto !== 'undefined' && 'getRandomValues' in crypto ? crypto : null;
  if (cryptoObj) {
    const buffer = new Uint8Array(size);
    cryptoObj.getRandomValues(buffer);
    for (let i = 0; i < size; i += 1) {
      id += alphabet[buffer[i] % alphabet.length];
    }
    return id;
  }

  for (let i = 0; i < size; i += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
};
