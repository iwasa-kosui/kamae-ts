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

// Discord wordmark glyph (white) — official "Discord" logotype as inline SVG.
// Source path: Discord brand guidelines (simplified mark glyph only).
const DISCORD_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36" width="127" height="96"><path fill="#ffffff" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.91-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"/></svg>`
const discordMarkPng = new Resvg(DISCORD_MARK_SVG, { fitTo: { mode: 'width', value: 88 } }).render().asPng()
const discordMarkDataUrl = `data:image/png;base64,${Buffer.from(discordMarkPng).toString('base64')}`

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
        // Eyebrow: "INVITE TO JOIN A SERVER"
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              color: TEXT_FAINT,
              marginBottom: 24,
            },
            children: [
              { type: 'img', props: { src: discordMarkDataUrl, width: 32, height: 24 } },
              'INVITE TO JOIN A SERVER',
            ],
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
