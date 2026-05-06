# 🎬 StreamVision IPTV

> Premium IPTV web application with 19,783 live TV channels, movies & series — inspired by Smarters Player.

![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-success)

## ✨ Features

- **19,783 Live TV Channels** — Sports, News, Movies, Music, Kids, Docs & more
- **282 Movie Categories** + **164 Series Categories** via Xtream Codes API
- **Video.js Player** — HLS/MP4 streaming with Live TV / Movies / Series tabs
- **17 Visual Category Pills** with emoji icons and channel counts
- **Bilingual** (FR/EN) with localStorage persistence
- **Fully Responsive** — mobile, tablet, desktop
- **SEO Optimized** — meta tags, Open Graph, Twitter Card, JSON-LD
- **Dark Premium Theme** — glassmorphism cards, animated gradients

## 🚀 Quick Start

### Windows
Double-click `E:\start-iptv.bat`

### WSL / Linux
```bash
cd ~/iptv-webapp
python3 -m http.server 8080
```
Then open **http://localhost:8080**

## 🧰 Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Player:** Video.js 8.x with HLS support
- **API:** Xtream Codes player_api.php
- **Fonts:** Poppins, Inter (Google Fonts)

## 📁 Project Structure

```
streamvision-iptv/
├── index.html      # Main app (HTML + inline templates)
├── style.css       # Dark premium theme (32KB+)
├── script.js       # All logic, API calls, player control (25KB+)
├── deploy.sh       # WSL launch script
└── README.md       # This file
```

## 🔗 Related

- [Smartes Player](https://www.smarters-player.fr/) — Design inspiration
- [Video.js](https://videojs.com/) — HTML5 video player
- [Xtream Codes](https://xtream-codes.com/) — IPTV panel API
