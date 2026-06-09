# Implementation Plan: Crypto Live Trade Terminal

This plan outlines the architecture and implementation steps for building the Crypto Live Trade Terminal based on our finalized design document.

## Architecture Decisions

### 1. Unified WebSocket Client
- A **Singleton WebSocket Client** will be implemented.
- All widgets (up to 50) will subscribe to this single instance, rather than establishing their own connections. This significantly reduces network overhead and connection limits.
- The server will send a unified stream, and the client-side WS manager will dispatch the trade events to the relevant widgets based on the `SymbolID`.

### 2. Mock Server Deployment
- **Decision:** We will use a standard **NodeJS server**.
- **Reasoning:** Cloudflare Workers require paid Durable Objects for persistent WS connections. A free tier on Render or Fly.io is better suited.

### 3. Binary Data Structure & Parsing
- We will use `DataView` on the client for parsing the incoming binary messages.
- The binary payload structure per trade (27 bytes total) is:
  - `timestamp` (uint64, 8 bytes)
  - `symbolId` (uint16, 2 bytes)
  - `side` (uint8, 1 byte)
  - `price` (float64, 8 bytes)
  - `amount` (float64, 8 bytes)

### 4. UI Overlays (Dropdowns & Modals)
- **Decision:** We will use **DOM overlays** (HTML `<div>` elements) positioned absolutely over the canvas for dropdowns and controls. They will be hidden during drag operations to avoid jitter.

### 5. Asynchronous Data Generation & Delta Throttling (NEW)
- A simulated data feed loop runs rapidly every **20ms** generating mock trades and pushing them into a server-side queue.
- The WebSocket broadcast loop runs every **100ms**, acting purely as a network throttle. It drains the queue, packs all new trades into a binary buffer, and sends the delta to the clients.

### 6. Server-Side Pub/Sub
- The server will hold **100+** symbol mappings.
- To save bandwidth, the 20ms data generator will **only** generate trades for symbols that have at least one active subscriber.
- The client must send text/json messages to the server (e.g., `{"action": "subscribe", "symbolId": 1}`) to manage subscriptions when widgets are added/changed.
- The server tracks active subscriptions per connection.

---

## Step-by-Step Implementation List

### Phase 1: Workspace & Mock Server Initialization (Updated)
1. Initialize the project workspace (create `server` and `client` directories).
2. Initialize a standard Node.js project in the `server` directory.
3. Install necessary server dependencies.
4. Setup `tsconfig.json` for the server.
5. Create the basic WebSocket server listening on a port.
6. Implement the binary protocol mapping structure with **100+ symbols**.
7. Implement server-side client connection tracking to track active subscriptions per client.
8. Implement listening for JSON `subscribe`/`unsubscribe` messages from clients.
9. Implement the mock trade generator loop (runs every **20ms**) pushing trades into an internal queue, restricted to actively subscribed symbols.
10. Implement the throttle loop (runs every **100ms**) that drains the queue, packs the `timestamp, symbolId, side, price, amount` into a binary buffer, and broadcasts it to clients.
11. Implement server-side heartbeat (ping clients every 10s, disconnect if no pong after 3s).

### Phase 2: Client Setup & WS Manager
12. Initialize the frontend project in the `client` directory using Vite (Vanilla TypeScript template).
13. Setup the basic HTML structure (canvas element, UI overlay container).
14. Create the `WSManager` class to handle the WebSocket connection to the server.
15. Implement client-side reconnect logic.
16. Implement client-side heartbeat logic (ping after 2s of silence, respond to server pings).
17. Implement the `DataView` parser to decode the incoming binary buffers into trade objects.
18. Implement an Event Emitter or Pub/Sub mechanism in `WSManager` to broadcast parsed trades based on `SymbolID`.
19. Implement the `subscribe` and `unsubscribe` functions in `WSManager` to send messages to the server when widgets request data.

### Phase 3: Canvas Rendering Foundation
20. Create the main `Engine` or `Renderer` class to manage the `requestAnimationFrame` loop.
21. Implement Canvas DPI scaling logic (`devicePixelRatio`) to ensure sharp text.
22. Create the `Widget` class holding state: `x`, `y`, `width`, `height`, `symbolId`, `filter`, and a `trades` array.
23. Implement the background and border rendering for a single `Widget`.
24. Implement the header rendering (title/symbol text) for the `Widget`.
25. Implement the text rendering loop for the `trades` array inside the widget's grid area.

### Phase 4: Culling, Interactivity & Optimization
26. Implement a hit-testing function (bounding box) to detect mouse clicks/hovers on specific widgets.
27. Implement z-index logic (an array of active widgets where the last rendered is on top; clicking a widget moves it to the end of the array).
28. Implement drag-and-drop logic for moving widgets around the canvas.
29. Implement resize handles on widgets and the logic to resize them during a drag.
30. Implement rendering culling: only draw widgets that intersect the viewport.
31. Implement row culling: only draw trade rows that are visible within the widget's scrolling area.

### Phase 5: DOM Overlays & Scrolling
32. Implement the transparent HTML `<div>` overlay system for scrolling widget content.
33. Link the DOM scroll event of the transparent `<div>` to the internal scroll state of the corresponding `Widget` in the canvas.
34. Create the 'Add Widget' button and its click handler to instantiate a new `Widget` on the canvas (up to 50 max).
35. Implement the HTML dropdown for the `Symbol` selection. Show it absolutely positioned over the clicked widget header.
36. Implement the HTML dropdown for the `Filter` selection (BUY/SELL/ALL).
37. Ensure DOM overlays are hidden when dragging or resizing starts to prevent jitter.

### Phase 6: Final Polish & Testing
38. Add styling (CSS) for the UI overlays to match the terminal aesthetic.
39. Test adding 50 widgets simultaneously to ensure the 60FPS target is met.
40. Test the auto-reconnect logic by killing and restarting the server.
41. Clean up code, remove debug logs, and finalize the codebase.
