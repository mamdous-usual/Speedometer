# 🚗 Speedometer

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-brightgreen.svg)](#-pwa-installation)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](#-tech-stack)
[![No Dependencies](https://img.shields.io/badge/dependencies-none-success.svg)](#)

A high-performance Progressive Web App speedometer built with vanilla HTML, CSS, and modern JavaScript (ES6+). Track your speed in real-time using GPS with beautiful analog and digital displays.

## 🌐 Live Demo

**👉 [View Live App](https://speedometerweb.vercel.app/)**

Try it out on your phone while walking or driving to see real-time speed tracking!

## ✨ Features

- **📍 Real-time GPS Tracking** - Uses Browser Geolocation API with `watchPosition` and high accuracy mode
- **🎯 Dual Speed Calculation** - Uses native GPS speed or calculates from position using Haversine formula
- **🎨 Dual Display Modes** - Switch between analog gauge and digital display
- **🌓 Dark/Light Theme** - OneDark theme with smooth transitions
- **⚡ Smooth Animations** - 60 FPS needle animation using `requestAnimationFrame`
- **📊 Speed Smoothing** - Exponential Moving Average (EMA) to reduce GPS jitter
- **📱 PWA Support** - Install on your device, works offline
- **🔋 Battery Efficient** - Optimized for low power consumption
- **📐 Responsive Design** - Works on all screen sizes (mobile, tablet, desktop)
- **♿ Accessible** - ARIA labels, keyboard navigation, reduced motion support

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5** | Semantic markup |
| **CSS3** | Custom properties, Flexbox, Grid |
| **ES6+ JavaScript** | Modules, Classes, async/await |
| **Canvas API** | Analog gauge rendering |
| **Geolocation API** | GPS position and speed tracking |
| **Service Worker** | Offline functionality & caching |
| **Web App Manifest** | PWA installation |

## 📁 Project Structure

```
Speedometer/
├── index.html              # Main HTML entry point
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service Worker
│   └── icons/              # App icons
│       └── icon.svg
├── src/
│   ├── css/
│   │   └── speedometer.css # Styles (OneDark theme)
│   ├── js/
│   │   ├── app.js          # Main entry point
│   │   ├── gps.js          # GPS module
│   │   ├── speed.js        # Speed processing & smoothing
│   │   ├── animation.js    # Canvas gauge renderer
│   │   └── ui.js           # UI management
│   └── utils/
│       ├── haversine.js    # Distance calculation
│       └── kalman.js       # Kalman filter for GPS smoothing
├── LICENSE
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local HTTP server (GPS requires secure context)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mamdous-usual/Speedometer.git
   cd Speedometer
   ```

2. **Start a local server**

   Using Python:
   ```bash
   python3 -m http.server 8000
   ```

   Using Node.js:
   ```bash
   npx serve .
   ```

   Using PHP:
   ```bash
   php -S localhost:8000
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

### VS Code Live Server

Alternatively, install the "Live Server" extension and click "Go Live" on `index.html`.

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Import the repository on [Vercel](https://vercel.com)
3. Deploy with default settings - no configuration needed

### GitHub Pages
For GitHub Pages deployment, you'll need to adjust paths in `index.html`, `manifest.json`, `sw.js`, and `app.js` to include your repository name prefix (e.g., `/Speedometer/`).

## 📖 Usage

1. **Click "Start"** to begin GPS tracking
2. **Allow location permission** when prompted
3. **Move around** (walk, bike, drive) to see your speed
4. **Toggle views** using the analog/digital buttons in the header
5. **Switch themes** with the sun/moon icon
6. **Click "Reset"** to clear trip statistics

### Desktop Testing (Without GPS Movement)

1. Open Chrome DevTools (F12)
2. Click ⋮ → More tools → **Sensors**
3. Under "Location", select **Custom location**
4. Change coordinates periodically to simulate movement

## ⚙️ Configuration

### Speed Settings

Edit `src/js/speed.js`:

```javascript
const config = {
  maxSpeed: 200,           // Maximum speed on gauge (km/h)
  smoothingAlpha: 0.25,    // EMA smoothing factor (0-1)
  minSpeedThreshold: 0.5,  // Speeds below this show as 0
};
```

### Gauge Appearance

Edit `src/js/animation.js`:

```javascript
this.config = {
  minSpeed: 0,
  maxSpeed: 200,
  startAngle: -225,        // Gauge start angle
  endAngle: 45,            // Gauge end angle
  tickMajorCount: 10,      // Major tick marks
  tickMinorCount: 4,       // Minor ticks between majors
};
```

## 🎨 Theming

The app uses the OneDark color scheme. Customize in `src/css/speedometer.css`:

```css
/* Dark Theme */
[data-theme="dark"] {
  --color-bg-primary: #282c34;
  --color-accent: #61afef;
  --gauge-low: #98c379;    /* Green: 0-60 km/h */
  --gauge-mid: #e5c07b;    /* Yellow: 60-120 km/h */
  --gauge-high: #e06c75;   /* Red: 120+ km/h */
}

/* Light Theme */
[data-theme="light"] {
  --color-bg-primary: #fafafa;
  --color-accent: #4078f2;
}
```

## 🔧 Technical Details

### Speed Calculation

| Method | Description |
|--------|-------------|
| **Primary** | Uses `coords.speed` from Geolocation API (m/s → km/h) |
| **Fallback** | Calculates speed using Haversine distance formula |

### Smoothing Algorithm

Uses Exponential Moving Average (EMA) with configurable alpha:

```
smoothedSpeed = α × currentSpeed + (1 - α) × previousSpeed
```

### Geolocation Options

```javascript
{
  enableHighAccuracy: true,  // Use GPS for best accuracy
  maximumAge: 0,             // No cached positions
  timeout: 5000              // 5 second timeout
}
```

## 🌐 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 60+ | ✅ Full |
| Firefox | 55+ | ✅ Full |
| Safari | 11.1+ | ✅ Full |
| Edge | 79+ | ✅ Full |
| iOS Safari | 11.3+ | ✅ Full |
| Chrome Android | 60+ | ✅ Full |

## 📱 PWA Installation

### Mobile (Android/iOS)
1. Open the app in your browser
2. Tap **"Add to Home Screen"** (or Share → Add to Home Screen on iOS)
3. The app will be installed with an icon

### Desktop (Chrome/Edge)
1. Look for the install icon (⊕) in the address bar
2. Click **"Install"**

> The app will work offline after first load!

## 🖼️ Generating App Icons

Convert the SVG icon to PNG at various sizes:

```bash
# Using ImageMagick
convert public/icons/icon.svg -resize 192x192 public/icons/icon-192x192.png
convert public/icons/icon.svg -resize 512x512 public/icons/icon-512x512.png
```

Or use [Real Favicon Generator](https://realfavicongenerator.net/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OneDark Theme](https://github.com/atom/atom/tree/master/packages/one-dark-syntax) - Color scheme inspiration
- [MDN Web Docs](https://developer.mozilla.org/) - Geolocation API documentation

---

<p align="center">
  Made with ❤️ using vanilla JavaScript<br>
  <sub>No frameworks. No dependencies. Just pure web.</sub>
</p>
