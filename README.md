# TraceScape 📊

> ⚠️ **NOT READY FOR USE**: This project is in very early active development. Core features are experimental, and APIs are subject to change.

TraceScape is a modern, high-performance web application designed to view, compare, and analyze performance trace files. Built with strict compliance to Material Design 3 guidelines, it integrates on-device AI capability to help you find and fix performance bottlenecks in your applications.

## 🚀 Features

- **On-Device AI Assistant**: Ask questions directly about your traces using Chrome's built-in Gemini Nano model (Prompt API). Includes a diagnostics panel for troubleshooting API availability and live download progress tracking.
- **Off-Main-Thread Processing**: Trace parsing, filtering, and aggregation happen inside a dedicated Web Worker to keep the UI smooth and responsive.
- **Gzip Decompression**: Seamlessly handles `.gz` and `.gzip` trace files using the modern browser DecompressionStream API.
- **Material 3 Design**: Clean, spec-compliant interface utilizing modern typography, dynamic states, and fluid transitions.
- **View Transitions**: Uses the View Transitions API for animations when switching tabs.
- **Interactive Dashboards**: Visualizes key metrics, thread activity, and flame graphs.

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+)
- A browser supporting Chrome's experimental **Prompt API / Built-in AI** (Chrome 128+ recommended).

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd TraceScape

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Vite development server
npm run dev
```

The application will be available at `http://localhost:5173`.

## 🤖 Setting Up Built-in AI

To enable the local AI Chat Assistant on your trace files:

1. Open **Google Chrome** (Chrome 128+).
2. Navigate to `chrome://flags/#prompt-api-for-gemini-nano` and set it to **Enabled**.
3. Navigate to `chrome://flags/#optimization-guide-on-device-model` and set it to **Enabled (BypassPrefRequirement)**.
4. Relaunch Chrome.
5. Go to `chrome://components` and ensure that **Optimization Guide On Device Model** is fully downloaded. If not, click **Check for update**.
6. When you load a trace file in TraceScape and switch to the **AI Assistant** tab, it will automatically connect or guide you through any remaining steps.

## 📦 Project Structure

- `src/components/` - Lit web components (App Shell, Dashboard, Assistant, etc.)
- `src/utils/` - Trace parsers, decompression helpers, and Web Worker setup
- `src/workers/` - Web Worker source for off-thread processing
- `src/styles/` - Theme definitions and global styles

## 📄 License

MIT
