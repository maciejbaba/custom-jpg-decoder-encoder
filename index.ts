import { readFileSync } from 'fs';

const JPG_SIGNATURE = [0xff, 0xd8, 0xff];
const SOF_MARKERS = [0xc0, 0xc2]; // baseline and progressive dct

const input = readFileSync('test.jpg');
const buffer = Buffer.from(input);
const data = new Uint8Array(buffer);
console.log('🚀 ~ data:', data);

const signature = data.slice(0, 3);
console.log('🚀 ~ signature:', signature);

if (signature.every((value, index) => value === JPG_SIGNATURE[index])) {
  console.log('Valid JPG signature');
}

const bytes = data.slice(3);
console.log('🚀 ~ bytes:', bytes);

