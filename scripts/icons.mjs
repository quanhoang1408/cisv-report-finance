import sharp from 'sharp'
import { readFileSync } from 'node:fs'
const svg = readFileSync(process.argv[2])
for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`${process.argv[3]}/icon-${size}.png`)
}
console.log('ok')
