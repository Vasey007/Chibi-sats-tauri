# 🪙 Chibi Sats

A lightweight, always-on-top desktop widget for tracking cryptocurrency prices in real time. Built with [Tauri](https://tauri.app/) + React + TypeScript. Free and open source under the MIT license.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-blueviolet)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)

---

## ✨ Features

- **Real-time prices** — live price updates via Bybit WebSocket stream (BTC, ETH, SOL)
- **Interactive price chart** — mini candlestick/line chart with selectable timeframes: 24h, 1w, 1m, 1y
- **Multi-currency support** — USD, EUR, BRL, TRY, PLN
- **Price alerts** — set target prices and get notified with a cute two-tone sound when triggered
- **8 themes** — Light, Dark, Anime, Billionaire, Dragon, Bender, Casino, Lord
- **Always on Top** — stays visible over other windows
- **Adjustable opacity** — blend the widget into your desktop
- **Configurable refresh interval** — 5s, 10s, 30s, 1min, 5min
- **Launch at startup** — autostart support
- **i18n** — English and Russian interface
- **Compact & draggable** — tiny footprint, drag anywhere on screen

---

## 🖥️ Tech Stack

| Layer | Tech |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app/) (Rust) |
| Frontend | React 19, TypeScript |
| Charts | [lightweight-charts](https://github.com/tradingview/lightweight-charts) |
| Price data | [Bybit API v5](https://bybit-exchange.github.io/docs/) (REST + WebSocket) |
| Build tool | Vite 6 |
| i18n | i18next + react-i18next |
| Testing | Vitest, Playwright |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) LTS
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)

### Install & run

```bash
git clone https://github.com/your-username/chibi-sats.git
cd chibi-sats

pnpm install
pnpm tauri dev
```

### Build for production

```bash
pnpm tauri build
```

The installer/binary will appear in `src-tauri/target/release/bundle/`.

---

---

## ⚙️ How It Works

1. **WebSocket** connects to `wss://stream.bybit.com` and streams real-time ticker data.
2. **REST polling** (every 30s minimum) keeps historical kline data fresh for the chart.
3. **Price alerts** are stored in `localStorage` and checked on every price update; a pleasant two-beep sound fires when a target is hit.
4. Settings, theme, alerts, and currency are all persisted via `localStorage` and synced across Tauri windows through Tauri events.

---

## 🎨 Themes Preview

| Theme | Vibe |
|---|---|
| `dark` | Classic dark mode |
| `light` | Clean & minimal |
| `anime` | Pink & purple pastel |
| `billionaire` | Gold on black |
| `dragon` | Fire & gold |
| `bender` | Futurama-inspired |
| `casino` | Vegas neon |
| `lord` | Dark fantasy |

---

## 📄 License

MIT © 2026 [Vasey007](https://t.me/Newpepol)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
