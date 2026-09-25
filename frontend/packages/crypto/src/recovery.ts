/**
 * Bộ khôi phục 12 từ (chuẩn BIP-39, như ví tiền mã hoá): 128 bit ngẫu nhiên, owner in ra giấy.
 * Mất cả thiết bị lẫn 12 từ này thì KHÔNG AI khôi phục được dữ liệu — kể cả PICO (cái giá của zero-knowledge).
 */
import { entropyToMnemonic, generateMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export function generateRecoveryPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(' ');
}

export function isValidRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(normalizePhrase(phrase), wordlist);
}

export function recoveryPhraseToEntropy(phrase: string): Uint8Array {
  return mnemonicToEntropy(normalizePhrase(phrase), wordlist);
}

export function entropyToRecoveryPhrase(entropy: Uint8Array): string {
  return entropyToMnemonic(entropy, wordlist);
}
