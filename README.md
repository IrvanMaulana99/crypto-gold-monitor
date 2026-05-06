# CryptoGold Monitor

Website monitoring harga **Bitcoin** dan **Emas** secara real-time, dilengkapi dengan analisis teknikal AI untuk mendukung keputusan investasi.

## Fitur

- **Harga Real-Time**: Bitcoin (BTC/USD & IDR) dan Emas (XAU/USD & IDR/gram)
- **Estimasi Harga Pegadaian**: Perhitungan estimasi harga emas Pegadaian berdasarkan harga global
- **Grafik Interaktif**: Chart.js dengan timeframe 7H, 1B, 3B, 6B, 1T
- **Analisis AI**: Rekomendasi beli/tunggu berdasarkan indikator teknikal:
  - RSI (14-period)
  - Moving Average Crossover (SMA 7/25)
  - MACD (12/26/9)
  - Bollinger Bands (20, 2σ)
  - Momentum (10-period)
  - Support/Resistance levels
- **Auto-refresh**: Data diperbarui setiap 60 detik
- **Responsive**: Desktop & mobile friendly

## Data Sources

| Asset   | API              | Biaya | Update   |
|---------|------------------|-------|----------|
| Bitcoin | CoinGecko API    | Gratis | ~30 detik |
| Emas    | vang.today       | Gratis | ~5 menit  |
| Emas (fallback) | CoinGecko PAXG | Gratis | ~30 detik |

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JS + Chart.js
- **Deploy**: Vercel (Serverless Functions)
- **Analisis**: Custom technical analysis engine

## Setup Lokal

```bash
npm install
npm start
# Server berjalan di http://localhost:3000
```

## API Endpoints

| Endpoint | Deskripsi |
|----------|-----------|
| `GET /api/prices` | Harga terkini BTC & Emas |
| `GET /api/history?asset=bitcoin&days=30` | Data historis |
| `GET /api/analysis` | Analisis teknikal + rekomendasi AI |

## Disclaimer

Analisis ini bersifat informatif dan bukan merupakan saran investasi. Selalu lakukan riset mandiri (DYOR) sebelum membuat keputusan investasi.
