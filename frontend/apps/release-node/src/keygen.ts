// Tạo khoá cho một nút: node src/keygen.ts keys/node-1.json
import { generateKeys } from './keys.ts';

const file = process.argv[2];
if (!file) throw new Error('Cách dùng: node src/keygen.ts <file>');
console.log(await generateKeys(file));
