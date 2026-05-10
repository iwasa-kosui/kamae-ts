import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOGO_SVG = resolve(REPO_ROOT, 'docs/assets/logo.svg')
const FONT_REGULAR = resolve(REPO_ROOT, 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff')
const FONT_BOLD = resolve(REPO_ROOT, 'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff')
const OUT_PNG = resolve(REPO_ROOT, 'docs/assets/og-image.png')

const WIDTH = 1200
const HEIGHT = 630
const TAGLINE = 'Kamae — robust server-side TypeScript design harness'

const logoSvg = readFileSync(LOGO_SVG, 'utf8')
const logoPng = new Resvg(logoSvg, { fitTo: { mode: 'width', value: 800 } }).render().asPng()
const logoDataUrl = `data:image/png;base64,${Buffer.from(logoPng).toString('base64')}`

const fontRegular = readFileSync(FONT_REGULAR)
const fontBold = readFileSync(FONT_BOLD)

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        fontFamily: 'Inter',
        padding: '80px',
      },
      children: [
        {
          type: 'img',
          props: {
            src: logoDataUrl,
            width: 800,
            style: { marginBottom: 56 },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontSize: 36,
              color: '#475569',
              textAlign: 'center',
              fontWeight: 400,
              maxWidth: 1000,
              lineHeight: 1.4,
            },
            children: TAGLINE,
          },
        },
      ],
    },
  },
  {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
    ],
  },
)

const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng()
writeFileSync(OUT_PNG, png)
console.log(`Wrote ${OUT_PNG} (${png.length} bytes, ${WIDTH}x${HEIGHT})`)
