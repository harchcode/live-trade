# Live Trade Visualizer

A hyper-optimized, real-time running trade built with Vanilla TypeScript, Canvas API, and Node.js WebSockets.

This project demonstrates how to handle massive firehoses of incoming network data and render dozens of UI widgets simultaneously without crashing the browser.

## Architecture

This project is a monorepo containing:

- **`client/`**: A Vanilla TypeScript frontend powered by Vite. It uses a custom-built 2D Canvas engine to render a draggable, resizable window manager.
- **`server/`**: A lightweight Node.js backend simulating a high-frequency trading exchange.
- **`shared/`**: Contains shared configuration constants ensuring the client and server remain perfectly synced.

## Performance Optimizations

This application was engineered from the ground up to minimize garbage collection, network overhead, and CPU repaints. Here are the core technical achievements:

### 1. Pure Binary WebSockets

We completely eliminated the massive overhead of `JSON.stringify` and `JSON.parse`.
The backend serializes every single trade into a tightly packed **27-byte** binary chunk (`ArrayBuffer`):

- `8 bytes` - Timestamp (BigInt64)
- `2 bytes` - Symbol ID (Uint16)
- `1 byte` - Trade Side (Uint8)
- `8 bytes` - Price (Float64)
- `8 bytes` - Amount (Float64)

The client intercepts these raw ArrayBuffers and decodes them instantly using `DataView`, allowing the browser to process thousands of trades per second with virtually zero memory allocation overhead.

### 2. Canvas 2D Rendering Engine

Instead of creating heavy HTML DOM nodes for every row, button, and graph, the entire UI is rendered dynamically inside a single `<canvas>` element using `requestAnimationFrame`. This allows 50 concurrent widgets to float, stack, and resize seamlessly without triggering expensive browser layout recalculations (Reflows).

### 3. Subscription Multiplexing

The `WSManager` acts as a central data router. It maintains exactly **one** WebSocket connection to the server. If 20 widgets subscribe to the same symbol, the network pipeline only requests the data _once_, parses it _once_, and dispatches it in memory to all 20 widgets simultaneously.

### 4. Offscreen Background Caching

The application background features a beautiful geometric grid. Because drawing hundreds of overlapping lines and applying shadow drops every frame is expensive, the background is rendered exactly once into an offscreen hidden Canvas (`gridCache`). The engine simply blits (`drawImage`) this static cache onto the screen every frame, saving tremendous CPU resources.

### 5. Backend Network Throttling

To prevent packet fragmentation and network flooding, the backend queues incoming high-frequency trades and flushes them across the WebSocket at a strict **10 Hz** (every 100ms). This ensures a perfectly stable network packet rate (`Msg/s`) while delivering the payload in highly compressed batches.

### 6. DOM Overlay Virtualization

Scrollbars are notoriously difficult to implement well in pure Canvas. Instead, a single invisible HTML `<div>` is absolutely positioned dynamically over whichever widget is currently active. This tricks the browser into handling the heavy lifting of mouse-wheel events and hardware-accelerated scroll compositing natively.

### 7. Background Tab Circuit Breaker

Browsers aggressively throttle `requestAnimationFrame` when a tab loses focus. To prevent the engine from collapsing under the weight of accumulated background network data when the tab wakes up, the math pipeline detects extreme frame-deltas (> 2 seconds) and triggers a silent circuit breaker, safely resetting throughput math without visual artifacting.

## Development

Install dependencies using `pnpm`:

```bash
pnpm install
```

Start the backend (generates trades on `ws://localhost:8080`):

```bash
cd server
pnpm start
```

Start the frontend:

```bash
cd client
pnpm dev
```
