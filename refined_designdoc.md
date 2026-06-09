# Refined Design Document: Crypto Live Trade Terminal

## Overview

This project showcases frontend optimization techniques for handling and rendering high-frequency WebSocket (WS) messages. While the trade data is simulated, the networking is real: the server is deployed to a live environment, and the client handles actual network traffic, demonstrating performance under real-world constraints.

## Goal

- **Performance**: Ensure buttery-smooth UX at 60FPS minimum with up to 50 active widgets, even during moving, resizing, and rapid data updates.
- **Efficiency**: Minimize user data consumption by utilizing a highly compact, custom binary message format over WebSockets instead of standard JSON.

## Features & UX Design

- **Dynamic Workspace**: A single-page application (SPA) starting empty. Users can add up to 50 "Live Trade" widgets.
- **Widget Management**:
  - Freeform dragging (widgets can overlap).
  - Resizable panels.
- **Widget Anatomy**:
  - **Header**: Displays the active pair (e.g., BTC/IDR). Clicking it opens a dropdown to switch coins.
  - **Filter**: A dropdown to filter trades by BUY, SELL, or ALL.
  - **Data Grid**: Displays a list of 100 live trade rows.
- **Minimalist UI**: Controls (scrollbars, dropdown indicators, close buttons) are hidden by default and only appear on hover or click to keep the terminal visually clean.

## Server-side Architecture

- **Tech Stack**: A mock WS server built with NodeJS.
  - _Note on Cloudflare Workers_: Yes, it is possible to deploy WebSocket servers on Cloudflare Workers, but it typically requires using Cloudflare Durable Objects to maintain state and handle persistent connections. Alternatively, simple VPS providers (like Fly.io, Railway, or DigitalOcean) might be easier for a raw high-frequency broadcast server.
- **Data Emulation**: Simulates high-frequency incoming messages and throttles broadcasts to the client at a fixed interval (e.g., every 100ms) to batch updates.
- **Binary Protocol**: No JSON parsing. Messages will be pure binary buffers containing only aligned values.
- **Connection Management**:
  - Server pings clients every 10s.
  - Disconnects clients that fail to respond with a `pong` within 3s.
  - Only accepts `ping/pong` and `subscription` messages from clients.

## Client-side Architecture

- **Rendering Strategy (Hybrid Approach)**:
  - **Canvas Rendering**: A single `<canvas>` element handles the background grid, layout, and rendering the 50 widgets (headers, backgrounds, text).
  - **DOM Overlay**: Standard HTML `<div>` elements are overlaid on top of the canvas for UI controls (Add Widget button, dropdowns, context menus).
  - **Native Scrolling**: Achieved by placing a transparent `<div>` over the widget's content area. The canvas reads this `<div>`'s scroll position to offset the rendered text, allowing for native scroll physics without building custom scrollbar logic.
- **Culling & Optimization**:
  - Only widgets currently visible within the viewport are rendered.
  - Only rows visible within a widget's scrolled area are rendered.
- **Resilience (Heartbeat & Auto-Reconnect)**:
  - Client sends a `ping` after 2s of silence (no messages or pongs), and every 10s thereafter.
  - Auto-reconnects if disconnected, or if the server fails to reply with a `pong` within 3s.

---

## 💡 Suggestions & Refinements

1. **Binary Protocol Definition**: We need to define the exact byte structure for the WebSocket messages. For example, will it be Little Endian or Big Endian? How do we encode strings like "BTC/IDR"?
   _Suggestion: Map symbols to `uint16` Integer IDs on connection (e.g., `0` = BTC/IDR) instead of sending the string every time to save bandwidth._
2. **Delta Updates vs Full Sync**: When throttling messages every 100ms, the server should only send _new_ trades (Delta updates) rather than the full 100 rows every time. The client can append new trades and slice the array to maintain a maximum length of 100.
3. **Canvas Pixel Ratio**: To ensure text doesn't look blurry on Retina/High-DPI displays, the canvas internal resolution (`width` and `height` properties) needs to be scaled by `window.devicePixelRatio`, while keeping the CSS dimensions standard.
4. **Event Delegation on Canvas**: Since everything is drawn on one canvas, you'll need a robust event system to map DOM events (click, mousedown, mousemove) from the canvas to your internal Widget objects based on hit-testing (bounding box checks).
5. **Z-Indexing for Overlaps**: You'll need a way to track the z-index of widgets so that clicking a widget brings it to the front of the render queue.

## ❓ Questions for Clarification

1. **Cloudflare Worker Setup**: Do you want to proceed with Cloudflare Workers (requiring Durable Objects for WebSockets), or should we stick to a standard NodeJS server deployed to a VPS (like Render, Fly.io, or DigitalOcean) for simplicity?
2. **Framework Choice**: Do you want to build this using Vanilla TypeScript/JavaScript for maximum control over the render loop, or integrate the Canvas within a framework like React/Vue? _(Vanilla TS is recommended for this specific use case to avoid virtual DOM overhead during high-frequency updates)._
3. **Binary Parsing**: Do you have a preference for how we parse the binary data on the client? (e.g., using `DataView` or raw `TypedArrays`).
4. **Dropdown Behavior**: For the UI overlays (dropdowns for coin selection and filters), should they be absolute-positioned DOM elements that track the widget's position as it moves, or rendered directly in the canvas? _(Your doc suggests HTML div overlays, which is good, but tracking their position during a drag can be tricky)._
