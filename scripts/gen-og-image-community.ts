import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOGO_SVG = resolve(REPO_ROOT, 'docs/assets/logo.svg')
const FONT_REGULAR = resolve(REPO_ROOT, 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff')
const FONT_SEMIBOLD = resolve(REPO_ROOT, 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff')
const FONT_BOLD = resolve(REPO_ROOT, 'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff')
const OUT_PNG = resolve(REPO_ROOT, 'docs/assets/og-image-community.png')

const WIDTH = 1200
const HEIGHT = 630

// Discord brand colors
const BLURPLE = '#5865F2'
const BLURPLE_DARK = '#4752C4'
const GREEN_ONLINE = '#23A55A'
const BG_OUTER = '#1E1F22'
const BG_CARD = '#2B2D31'
const TEXT_MUTED = '#B5BAC1'
const TEXT_FAINT = '#80848E'
const DOT_OFFLINE = '#80848E'

// Render the kamae-ts square icon (the first 240x240 of logo.svg) as a standalone SVG.
const fullLogoSvg = readFileSync(LOGO_SVG, 'utf8')
const iconSvg = fullLogoSvg
  .replace('viewBox="0 0 720 240"', 'viewBox="0 0 240 240"')
  .replace('width="720" height="240"', 'width="240" height="240"')
const iconPng = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 320 } }).render().asPng()
const iconDataUrl = `data:image/png;base64,${Buffer.from(iconPng).toString('base64')}`

const fontRegular = readFileSync(FONT_REGULAR)
const fontSemibold = readFileSync(FONT_SEMIBOLD)
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
        background: `linear-gradient(135deg, ${BG_OUTER} 0%, ${BG_CARD} 100%)`,
        fontFamily: 'Inter',
        padding: 64,
      },
      children: [
        // Eyebrow
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              color: TEXT_FAINT,
              marginBottom: 24,
            },
            children: 'INVITE TO JOIN A SERVER',
          },
        },

        // Main card body
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              background: BG_CARD,
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16,
              padding: '40px 48px',
              gap: 36,
            },
            children: [
              // Server icon (kamae-ts logo)
              {
                type: 'img',
                props: {
                  src: iconDataUrl,
                  width: 200,
                  height: 200,
                  style: { borderRadius: 32 },
                },
              },

              // Center column: name, subtitle, status
              {
                type: 'div',
                props: {
                  style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 10,
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: 60,
                          fontWeight: 700,
                          color: '#ffffff',
                          letterSpacing: -1.5,
                          lineHeight: 1.1,
                        },
                        children: 'kamae-ts',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: 28,
                          fontWeight: 400,
                          color: TEXT_MUTED,
                          marginBottom: 8,
                        },
                        children: 'Official Discord Server',
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 28,
                          fontSize: 22,
                          color: TEXT_MUTED,
                        },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: { display: 'flex', alignItems: 'center', gap: 10 },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      width: 14,
                                      height: 14,
                                      borderRadius: 7,
                                      background: GREEN_ONLINE,
                                    },
                                  },
                                },
                                'Online',
                              ],
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: { display: 'flex', alignItems: 'center', gap: 10 },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      width: 14,
                                      height: 14,
                                      borderRadius: 7,
                                      background: DOT_OFFLINE,
                                    },
                                  },
                                },
                                'Members',
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },

              // Right: Join Server button
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: BLURPLE,
                    color: '#ffffff',
                    fontSize: 26,
                    fontWeight: 600,
                    padding: '20px 36px',
                    borderRadius: 8,
                    boxShadow: `0 4px 0 ${BLURPLE_DARK}`,
                  },
                  children: 'Join Server',
                },
              },
            ],
          },
        },

        // Footer caption
        {
          type: 'div',
          props: {
            style: {
              marginTop: 24,
              fontSize: 22,
              color: TEXT_FAINT,
              textAlign: 'center',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            },
            children: 'discord.gg/Z9HVbqEWzd  ·  Server-side TypeScript & functional domain modeling',
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
      { name: 'Inter', data: fontSemibold, weight: 600, style: 'normal' },
      { name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
    ],
  },
)

const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng()
writeFileSync(OUT_PNG, png)
console.log(`Wrote ${OUT_PNG} (${png.length} bytes, ${WIDTH}x${HEIGHT})`)
