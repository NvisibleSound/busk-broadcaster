# Busk Broadcaster - Current Status & Setup Guide

**Last Updated:** Current session  
**Status:** Ready for final Docker/Caddy configuration

---

## 🎯 Current Configuration

### Server Settings
- **Server:** `test.buskplayer.com:443`
- **Protocol:** SSL/TLS (HTTPS)
- **Mount Point:** `/ether`
- **Username:** `source`
- **Password:** `EtherIsBetter`
- **Stream URL:** `https://test.buskplayer.com/ether`

### Audio Settings
- **Format:** WebM/Opus (converted to MP3 via FFmpeg)
- **Bitrate:** 128 kbps
- **Sample Rate:** 48000 Hz
- **Channels:** 2 (stereo)
- **Recording Interval:** 100ms chunks

---

## ✅ Completed Features

### UI & Styling
- ✅ Dark theme color scheme (matching react-music-player)
  - Background: `rgb(3, 1, 3)` (container), `rgb(26, 26, 26)` (body)
  - Text: `rgb(201, 201, 201)` (primary), `rgb(129, 129, 129)` (secondary)
  - Borders: `rgba(129, 129, 129, 0.3)`
- ✅ Responsive mobile layout (max-width: 360px)
- ✅ Compact spacing and padding throughout
- ✅ Broadcast icon: White when idle, Red when broadcasting
- ✅ Stream URLs styled in grey

### Functionality
- ✅ WebSocket server on port 8081
- ✅ Audio device selection
- ✅ Real-time audio meters (stereo)
- ✅ Volume control
- ✅ Broadcast stats display
- ✅ Artist/description/tags configuration
- ✅ Settings menu with source name input
- ✅ Audio menu with device selection

### Code Cleanup
- ✅ Removed constant audio data logging
- ✅ Disabled API calls (using mock artists)
- ✅ Cleaned up console logs

---

## 📁 Key Files & Their Purpose

### Configuration Files
- **`src/config/BroadcastConfig.js`**
  - Contains default server configuration
  - Currently set for test.buskplayer.com:443
  - Mount point: `/ether`
  - Password: `EtherIsBetter`

### Server Files
- **`server.js`** (root directory)
  - WebSocket server on port 8081
  - Handles browser → WebSocket → Icecast connection
  - Converts WebM/Opus to MP3 via FFmpeg
  - Uses TLS for SSL connection to Icecast
  - **Run with:** `npm run server` or `node server.js`

### Main Component
- **`src/components/IcecastBroadcaster.js`**
  - Main broadcaster component
  - Handles audio capture, WebSocket connection, UI
  - Sends config and audio data to WebSocket server

### Styling
- **`src/components/IcecastBroadcaster.module.css`**
  - All component styles
  - Dark theme colors
  - Responsive layout
  - Mobile-first design

---

## ⏳ Pending Setup (Waiting for Docker/Caddy)

### Connection Issues
- Icecast connection not yet established
- Need final Docker/Caddy configuration details
- SSL/TLS connection may need adjustment based on Caddy setup

### What Needs to Be Configured
1. **Final server URL/port** (may change with Caddy reverse proxy)
2. **SSL certificate handling** (Caddy may handle this)
3. **Connection path** (may need to go through Caddy instead of direct)
4. **Mount point verification** (ensure `/ether` is correct in Icecast config)

---

## 🔧 How to Run

### Development Setup
1. **Start WebSocket Server:**
   ```bash
   npm run server
   # or
   node server.js
   ```

2. **Start Frontend:**
   ```bash
   npm run dev
   ```
   Runs on `http://localhost:3000`

### Production
- Frontend builds with: `npm run build`
- WebSocket server runs independently

---

## 📝 Connection Flow

```
Browser (MediaRecorder)
  ↓ WebSocket (ws://localhost:8081)
Node.js Server (server.js)
  ↓ FFmpeg (WebM/Opus → MP3)
  ↓ TLS/SSL (test.buskplayer.com:443)
Icecast Server
  ↓ Mount: /ether
Listeners (https://test.buskplayer.com/ether)
```

---

## 🐛 Known Issues / Notes

1. **Icecast Connection:**
   - Currently configured but not connecting
   - Waiting for Docker/Caddy setup to finalize
   - May need to adjust connection method based on Caddy reverse proxy

2. **FFmpeg:**
   - Required for WebM/Opus → MP3 conversion
   - Falls back to direct stream if FFmpeg unavailable (may not work)

3. **API Calls:**
   - Artist API calls disabled (using mock data)
   - Can be re-enabled when needed

4. **SSL Certificates:**
   - Currently using `rejectUnauthorized: false` for testing
   - Should be updated once Caddy handles SSL properly

---

## 🔄 Next Steps (After Docker/Caddy Setup)

1. **Update Connection Details:**
   - Verify final server URL/port
   - Update `BroadcastConfig.js` if needed
   - Update `server.js` connection settings

2. **Test Icecast Connection:**
   - Verify mountpoint appears in Icecast console
   - Test audio streaming
   - Verify listeners can connect

3. **SSL Configuration:**
   - Update certificate handling if Caddy manages SSL
   - Remove `rejectUnauthorized: false` if using proper certs

4. **Final Testing:**
   - Test full broadcast cycle
   - Verify audio quality
   - Test stream URLs

---

## 📞 Configuration Reference

### Mount Configuration (from Icecast)
```xml
<mount>
  <mount-name>/ether</mount-name>
  <password>EtherIsBetter</password>
  <stream-name>Ether</stream-name>
  <stream-description>Live music streaming (test)</stream-description>
  <stream-url>https://test.buskplayer.com</stream-url>
</mount>
```

### WebSocket Server
- **Port:** 8081
- **Protocol:** ws:// (local)
- **Location:** `server.js` (root directory)

### Frontend
- **Port:** 3000 (dev)
- **Build:** Vite
- **Framework:** React 18

---

## 💡 Tips for Your Friend

1. **Caddy Reverse Proxy:**
   - May need to proxy WebSocket connections
   - SSL termination might be handled by Caddy
   - Connection path may change from direct to proxied

2. **Docker Networking:**
   - Ensure WebSocket server can reach Icecast
   - Check port mappings
   - Verify network connectivity

3. **Icecast Configuration:**
   - Mount point `/ether` is configured
   - Password `EtherIsBetter` is set
   - Verify mount is active and accessible

---

## 📚 File Structure

```
busk-broadcaster/
├── server.js                    # WebSocket server (port 8081)
├── src/
│   ├── config/
│   │   └── BroadcastConfig.js   # Server configuration
│   ├── components/
│   │   ├── IcecastBroadcaster.js      # Main component
│   │   ├── IcecastBroadcaster.module.css
│   │   ├── AudioMeters.js
│   │   ├── VolumeControl.js
│   │   └── BroadcastStats.js
│   └── App.jsx
└── package.json
```

---

**Ready to continue once Docker/Caddy setup is complete!** 🚀

