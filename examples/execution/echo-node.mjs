import { readFileSync } from 'node:fs';
const args = JSON.parse(readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify({ message: args.message, count: args.count }));
