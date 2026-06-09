# Crypto Live Trade Terminal

This project is to showcase optimization techniques for handling and rendering a really fast WS message. The trade data are just fake, dummy data, but the server is real. The server is really actually deployed, and the client really send/receive message from network.

## Features/Design

- A single page which starts out empty, then user can add new widget (only live trade widget is available) to the page. User can add up to 50 widgets
- Each widget can be moved around freely, can overlap with other widgets.
- Widgets can be resized
- Each widgets has a title (for example BTC/IDR), and when clicked, will show a dropdown list of coins, clicking on other coin will change the current widget coin.
- Each widgets has a dropdown of filter (BUY/SELL/ALL).
- Each widget shows list of 100 live trade rows.
- There can be 50 widgets max in the page.

## Server-side Design

- We will create a mock WS server locally with NodeJS. Later we will deploy this mock server to Cloudflare worker (is it possible?).
- The mock server will simulate receiving really high frequency message (maybe from third party server in real scenario), then it will throttle to send to the client every specified ms (let's say every 100ms for now).
- The mock server will only receive and send binary message, so no JSON parsing. We will align the buffer with values only (not key-value pair).
- The mock server will only receive ping/pong and subscription message.
- The mock server will ping the connected client let's say every 10s, and will disconnect if the client doesn't respond with pong after 3s.

## Client-side Design

- The WS client should have heartbeat feature and auto reconnect.
- The WS client will send ping after let's say 2s of not receiving any message (other than pong), then every 10s after that.
- If the WS client is disconnected, or if no pong received from server 3s after ping, then the WS client will try to reconnect.
- The page will have a single canvas element for rendering the layout and the widgets.
- There will be standard html div as overlay for UI, like for adding widget
- Only visible widgets will be rendered.
- Only visible rows in a widget will be rendered.
- Widgets will show no control (like scrollbar, dropdown indicator etc). Only when user hovered or clicked on the widget then they will be shown.
- The widget content can be scrolled. We achieve this by adding a div overlay with transparent background on top of the content. So we will use scroll position based on the div's scroll position.

## Goal

- UX should be buttery smooth at 50 widgets, at 60FPS min, including on moving and resizing widgets.
- Should not increase user's data usage too much, that is why we want the WS server to only send binary message, with compact as possible format.
