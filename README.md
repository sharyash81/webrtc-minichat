# webrtc-minichat

A **WebRTC**-based real-time chat and calling demo. Browsers establish peer-to-peer audio/video streams using **STUN** for public endpoint discovery and automatically fall back to a **TURN** relay when strict NAT/firewalls block direct connectivity (handled by the browser’s ICE agent, not app logic). A lightweight **signaling server** (Socket.IO) exchanges **SDP** offers/answers and ICE candidates to bootstrap connections. This enables low-latency media and simple text chat directly in the browser with no plugins.

## Quick start
1) Signaling server
```bash
cd signaling_server
npm install
npm start
```
2) Client (static hosting)
```bash
# from project root
python3 -m http.server 5500
# then open http://localhost:5500/app/
```
Open the page in two browsers, allow mic/camera, and you should see a P2P call and chat.

## Configuration
- Signaling URL in `app/script.js`:
  ```js
  const socket = io('http://localhost:8000');
  // or your deployed signaling server URL
  ```
- ICE servers in `app/script.js` (example):
  ```js
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:YOUR_TURN_HOST:3478', username: 'USERNAME', credential: 'CREDENTIAL' }
    ]
  });
  ```
  With valid **TURN** credentials, the browser’s ICE prefers direct/**STUN** paths and falls back to **TURN** when necessary.
