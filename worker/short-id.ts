/** Reading ids: 8 symbols from an alphabet without vowels and look-alikes, so an id spells nothing and dictates cleanly. */
const ALPHABET = "23456789bcdfghjkmnpqrstvwxz";
const ID_LENGTH = 8;

export const ID_PATTERN = new RegExp(`^[${ALPHABET}]{${String(ID_LENGTH)}}$`);

export function shortId(): string {
  // Bytes at or above the largest multiple of the alphabet size are skipped, so no symbol is more likely than another.
  const unbiased = ALPHABET.length * Math.floor(256 / ALPHABET.length);
  let id = "";
  while (id.length < ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2))) {
      if (byte < unbiased && id.length < ID_LENGTH) id += ALPHABET.charAt(byte % ALPHABET.length);
    }
  }
  return id;
}
