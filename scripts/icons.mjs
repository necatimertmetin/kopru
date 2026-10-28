// Renders the PNG icon and the social preview image from SVG.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

await sharp(readFileSync('public/favicon.svg'), { density: 600 }).resize(192, 192).png().toFile('public/icon-192.png')

const cells = []
const days = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']
// 9-day break: Sat 6 – Sun 14 March 2027
const kinds = ['w', 'w', 'w', 'w', 'w', 'e', 'e', 'h2', 'r', 'r', 'r', 'l', 'e', 'e']
const fill = { w: '#2a2b25', e: '#3a3b33', h2: '#f5a524', r: '#e5484d', l: '#14b8a6' }
kinds.forEach((k, i) => {
  const x = 640 + (i % 7) * 72
  const y = 250 + Math.floor(i / 7) * 72
  cells.push(`<rect x="${x}" y="${y}" width="62" height="62" rx="12" fill="${fill[k]}"/><text x="${x + 31}" y="${y + 40}" font-family="Segoe UI, Arial" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>`)
})
days.forEach((d, i) => cells.push(`<text x="${640 + i * 72 + 31}" y="236" font-family="Segoe UI, Arial" font-size="20" fill="#a19d93" text-anchor="middle">${d}</text>`))
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#12130f"/>
  <rect x="80" y="80" width="80" height="80" rx="20" fill="#0f766e"/>
  <path d="M92 132c13-26 59-26 72 0M92 132h72M108 132v-11M128 132v-16M148 132v-11" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(-6,0)"/>
  <text x="180" y="138" font-family="Segoe UI, Arial" font-size="60" font-weight="800" fill="#eceae4">Köprü</text>
  <text x="80" y="290" font-family="Segoe UI, Arial" font-size="52" font-weight="800" fill="#eceae4">1,5 gün izinle</text>
  <text x="80" y="356" font-family="Segoe UI, Arial" font-size="52" font-weight="800" fill="#2dd4bf">9 gün tatil.</text>
  <text x="80" y="440" font-family="Segoe UI, Arial" font-size="28" fill="#a19d93">Türkiye için izin ve köprü günü planlayıcı</text>
  ${cells.join('')}
</svg>`
await sharp(Buffer.from(og)).png().toFile('public/og.png')
console.log('icons written')
