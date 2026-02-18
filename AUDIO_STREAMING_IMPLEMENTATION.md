# Audio Streaming Implementation Documentation

## 1) High-level Architecture

The application captures audio from the browser's microphone using Web Audio API and MediaRecorder, streams it via WebSocket to a Node.js server, which then forwards it to an Icecast server via TCP.

**Audio Capture**: Browser-based capture using `navigator.mediaDevices.getUserMedia()` with Web Audio API for processing and MediaRecorder API for encoding. Audio is captured at 48kHz stereo with 16-bit samples.

**FFmpeg Usage**: FFmpeg is **NOT used in the main production server** (`server.js`). However, an alternative implementation exists in `test.buskplayer.com/broadcaster/server.js` that uses FFmpeg to convert WebM/Opus to MP3 before sending to Icecast. The main server streams OGG/Opus directly to Icecast.

**Streaming Path**: 
```
Browser Microphone → getUserMedia() → Web Audio API → MediaRecorder (OGG/Opus) 
→ WebSocket (binary) → Node.js Server (port 8081) → TCP Socket → Icecast Server (test.buskplayer.com:8000)
```

**Platform**: Browser-only capture (no native mic APIs). Server runs on Node.js (cross-platform). FFmpeg implementation is server-side only.

---

## 2) FFmpeg Usage

### FFmpeg Implementation (Alternative Server)

**Location**: `test.buskplayer.com/broadcaster/server.js` lines 29-81

**Command Construction**:
```javascript
ffmpegProcess = spawn('ffmpeg', [
  '-f', 'webm',
  '-i', 'pipe:0',
  '-f', 'mp3',
  '-acodec', 'mp3',
  '-ab', '128k',
  '-ar', '48000',
  '-ac', '2',
  'pipe:1'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});
```

**Exact Command String**:
```bash
ffmpeg -f webm -i pipe:0 -f mp3 -acodec mp3 -ab 128k -ar 48000 -ac 2 pipe:1
```

**Parameters**:
- **Input**: `pipe:0` (stdin) - receives WebM/Opus from WebSocket
- **Output**: `pipe:1` (stdout) - sends MP3 to Icecast TCP socket
- **Input Format**: `webm` (WebM container)
- **Output Format**: `mp3` (MP3 container)
- **Codec**: `mp3` (MP3 audio codec)
- **Bitrate**: `128k` (128 kbps)
- **Sample Rate**: `48000` Hz
- **Channels**: `2` (stereo)
- **Realtime Flags**: None (streaming via pipes)

**Usage Context**:
- Triggered when `config` message received from browser (line 155)
- Receives binary audio chunks from WebSocket (line 169: `ffmpegProcess.stdin.write(data)`)
- Outputs to Icecast TCP socket (line 53: `icecast.write(data)`)
- Process killed on WebSocket close (lines 188-191)

**Platform**: Server-side only (Node.js spawn). Requires FFmpeg binary installed on server.

**Main Production Server**: `server.js` does **NOT** use FFmpeg - streams OGG/Opus directly to Icecast.

---

## 3) Capture Code

### Browser Audio Capture

**File**: `src/components/IcecastBroadcaster.js`

**Function**: `startBroadcast()` (lines 403-541)

**Capture Start**:
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: {
    deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
    channelCount: 2,
    sampleRate: 48000,
    sampleSize: 16,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
});
```

**MediaRecorder Setup** (lines 476-501):
```javascript
const preferredMimeTypes = [
  'audio/ogg;codecs=opus',
  'audio/ogg'
];
let mimeType = 'audio/ogg;codecs=opus';
// ... format detection ...

mediaRecorder.current = new MediaRecorder(stream, {
  mimeType: mimeType,
  audioBitsPerSecond: 128000
});

mediaRecorder.current.ondataavailable = (event) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(event.data);
  }
};

mediaRecorder.current.start(100); // 100ms chunks
```

**Key Details**:
- **Capture API**: Browser `getUserMedia()` → Web Audio API → MediaRecorder
- **Device Selection**: User-selectable via dropdown (lines 718-729)
- **Chunk Interval**: 100ms (line 501)
- **Format**: OGG/Opus (preferred) or WebM/Opus (fallback)
- **Bitrate**: 128 kbps (128000 bits/second)
- **Sample Rate**: 48000 Hz (requested, browser may adjust)
- **Channels**: 2 (stereo)
- **Sample Format**: Browser-native (typically float32 in Web Audio API, encoded to Opus by MediaRecorder)

**Audio Processing Chain** (lines 586-674):
- `getUserMedia()` → `AudioContext` → `createMediaStreamSource()` → Gain nodes → MediaRecorder
- Separate gain nodes for broadcast (`volumeGainNode`) and monitoring (`meterGainNode`)
- Optional audio plugins (EQ, Compressor, Reverb) can be inserted in broadcast chain

---

## 4) Transport Code

### WebSocket Client (Browser)

**File**: `src/components/IcecastBroadcaster.js` lines 425-535

**Connection**:
```javascript
const wsUrl = window.location.hostname === 'localhost'
  ? 'ws://localhost:8081'
  : `wss://${window.location.hostname}/ws`;

wsRef.current = new WebSocket(wsUrl);
wsRef.current.binaryType = 'arraybuffer';
```

**Message Framing**:
- **Config Messages**: JSON (lines 458-472)
  ```javascript
  {
    type: 'config',
    sourceName: sourceName,
    description: description,
    mountpoint: mountpoint,
    artistId: selectedArtist?.artistId || null,
    tags: selectedTags,
    contentType: mimeType
  }
  ```
- **Audio Data**: Binary (ArrayBuffer) - sent directly from MediaRecorder `ondataavailable` event (line 494)

**Chunk Size**: Variable (MediaRecorder produces chunks every 100ms, size depends on audio content and Opus encoding)

**Buffering**: No explicit buffering - chunks sent immediately when available

**Reconnect Logic**: None in current implementation (connection failure stops broadcast)

### WebSocket Server (Node.js)

**File**: `server.js` (main production) or `test.buskplayer.com/broadcaster/server.js` (FFmpeg version)

**Server Setup** (`server.js` lines 1-6):
```javascript
import { WebSocketServer } from 'ws';
import net from 'net';

const wss = new WebSocketServer({ port: 8081 });
```

**Message Handling** (`server.js` lines 94-152):
```javascript
ws.on('message', async (data) => {
  try {
    const message = JSON.parse(data.toString());
    // Handle config message
    if (message.type === 'config') {
      setupIcecastConnection();
    }
  } catch (e) {
    // Not JSON, must be audio data
    totalBytesReceived += data.length;
    
    if (icecast && isSourceEstablished) {
      const writeSuccess = icecast.write(data);
      if (!writeSuccess) {
        console.log('Write buffer full - waiting for drain');
      }
    }
  }
});
```

**TCP Connection to Icecast** (`server.js` lines 19-92):
```javascript
icecast = net.connect({
  host: 'test.buskplayer.com',
  port: 8000
}, () => {
  const headers = [
    `SOURCE ${mountpoint} HTTP/1.0`,
    'Authorization: Basic ' + Buffer.from('source:EtherIsBetter').toString('base64'),
    'Content-Type: audio/ogg;codecs=opus',
    'Ice-Public: 1',
    `Ice-Name: ${sourceName}`,
    `Ice-Description: ${description}`,
    `Ice-URL: https://test.buskplayer.com${mountpoint}`,
    'Ice-Audio-Info: ice-bitrate=128;ice-samplerate=48000;ice-channels=2',
    'User-Agent: busk-broadcaster/1.0',
    '',
    ''
  ].join('\r\n');
  
  icecast.write(headers);
});
```

**Backpressure Handling**: 
- Checks `write()` return value (line 141)
- Listens for `drain` event (line 89)
- No explicit buffering - relies on TCP buffer

**Reconnect Logic**: None - single connection per WebSocket session

**Transport Protocol**: 
- Browser → Server: WebSocket (binary frames)
- Server → Icecast: TCP (raw HTTP-like headers + binary audio stream)

---

## 5) Audio Format Assumptions

### Browser Capture Format
- **Sample Rate**: 48000 Hz (requested, may vary by browser/device)
- **Channels**: 2 (stereo)
- **Sample Format**: Browser-native (float32 in Web Audio API, encoded by MediaRecorder)
- **Codec**: Opus
- **Container**: OGG (preferred: `audio/ogg;codecs=opus`) or WebM (fallback: `audio/webm;codecs=opus`)
- **Bitrate**: 128 kbps (128000 bits/second)

### Server-Side Format (Main Production - `server.js`)
- **Input**: OGG/Opus from browser
- **Output**: OGG/Opus to Icecast (no conversion)
- **Content-Type Header**: `audio/ogg;codecs=opus`
- **Sample Rate**: 48000 Hz (assumed, declared in Ice-Audio-Info header)
- **Channels**: 2 (stereo)
- **Bitrate**: 128 kbps (declared in Ice-Audio-Info header)

### Server-Side Format (FFmpeg Version - `test.buskplayer.com/broadcaster/server.js`)
- **Input**: WebM/Opus from browser
- **Output**: MP3 to Icecast
- **Content-Type Header**: `audio/mpeg`
- **Sample Rate**: 48000 Hz (FFmpeg resamples if needed)
- **Channels**: 2 (stereo)
- **Bitrate**: 128 kbps
- **Codec**: MP3 (libmp3lame via FFmpeg)

### Resampling/Channel Mixing
- **Browser**: No explicit resampling - relies on browser's getUserMedia implementation
- **Main Server**: No resampling - passes through OGG/Opus as-is
- **FFmpeg Server**: FFmpeg may resample if input differs from 48kHz (not explicitly configured)

---

## 6) Entry Points & Config

### Entry Points

**Frontend**:
```bash
npm run dev        # Development server on port 3000
npm run build      # Production build
npm start          # Production server on port 3020
```

**Backend**:
```bash
node server.js     # Main WebSocket server on port 8081
```

**Alternative Server** (with FFmpeg):
```bash
cd test.buskplayer.com/broadcaster
node server.js     # FFmpeg-enabled server (uses env vars for config)
```

### Configuration Files

**Frontend Config**: `src/config/BroadcastConfig.js`
```javascript
export const defaultServerConfig = {
  url: 'test.buskplayer.com:8000',
  username: 'source',
  password: 'EtherIsBetter',
  mountPoint: '/ether'
};
```

**Server Config** (main `server.js`):
- **WebSocket Port**: Hardcoded `8081` (line 4)
- **Icecast Host**: Hardcoded `'test.buskplayer.com'` (line 26)
- **Icecast Port**: Hardcoded `8000` (line 27)
- **Mount Point**: Dynamic from config message (default `/ether`)
- **Auth**: Hardcoded `'source:EtherIsBetter'` (line 33)

**Server Config** (FFmpeg version `test.buskplayer.com/broadcaster/server.js`):
- **Environment Variables**:
  - `ICECAST_HOST` (default: `'icecast'`)
  - `ICECAST_PORT` (default: `'8000'`)
  - `ICECAST_PASSWORD` (default: `'EtherIsBetter'`)
  - `WS_PORT` (default: `'8081'`)

### Environment Variables
- **Main Server**: None (all hardcoded)
- **FFmpeg Server**: See above
- **Frontend**: None (uses `BroadcastConfig.js`)

### Ports
- **Frontend Dev**: 3000
- **Frontend Prod**: 3020
- **WebSocket Server**: 8081
- **Icecast**: 8000

### Streaming URLs
- **Broadcast Target**: `test.buskplayer.com:8000` (HTTP, no SSL)
- **Listen HTTPS**: `https://test.buskplayer.com/ether`
- **Listen Direct**: `http://test.buskplayer.com:8000/ether`

---

## 7) "Paste Pack" - Compact Summary

### File Structure
```
server.js                                    # Main WebSocket server (OGG/Opus direct)
test.buskplayer.com/broadcaster/server.js   # Alternative server (FFmpeg WebM→MP3)
src/components/IcecastBroadcaster.js         # Browser capture & WebSocket client
src/config/BroadcastConfig.js               # Server connection config
```

### Key Code Snippets

**Browser Capture** (`IcecastBroadcaster.js:403-501`):
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: { channelCount: 2, sampleRate: 48000, sampleSize: 16 }
});
mediaRecorder.current = new MediaRecorder(stream, {
  mimeType: 'audio/ogg;codecs=opus',
  audioBitsPerSecond: 128000
});
mediaRecorder.current.ondataavailable = (e) => wsRef.current.send(e.data);
mediaRecorder.current.start(100); // 100ms chunks
```

**WebSocket Server** (`server.js:94-152`):
```javascript
ws.on('message', async (data) => {
  try {
    JSON.parse(data.toString()); // Config message
  } catch (e) {
    icecast.write(data); // Binary audio data
  }
});
```

**FFmpeg Command** (`test.buskplayer.com/broadcaster/server.js:37-46`):
```bash
ffmpeg -f webm -i pipe:0 -f mp3 -acodec mp3 -ab 128k -ar 48000 -ac 2 pipe:1
```

**Icecast TCP Headers** (`server.js:31-44`):
```
SOURCE /ether HTTP/1.0
Authorization: Basic c291cmNlOkV0aGVySXNCZXR0ZXI=
Content-Type: audio/ogg;codecs=opus
Ice-Audio-Info: ice-bitrate=128;ice-samplerate=48000;ice-channels=2
```

### Assumptions Summary
- **Capture**: Browser `getUserMedia()` → MediaRecorder (OGG/Opus preferred, WebM/Opus fallback)
- **Sample Rate**: 48000 Hz
- **Channels**: 2 (stereo)
- **Bitrate**: 128 kbps
- **Chunk Size**: Variable (100ms intervals)
- **Transport**: WebSocket (binary) → TCP (raw HTTP-like + binary stream)
- **Main Server**: No FFmpeg - streams OGG/Opus directly
- **Alternative Server**: FFmpeg converts WebM/Opus → MP3
- **Ports**: Frontend 3000, WebSocket 8081, Icecast 8000
- **No Reconnection**: Single connection per session
- **No Explicit Buffering**: Relies on TCP/WebSocket buffers

### Critical Notes
- Main production server (`server.js`) does **NOT use FFmpeg** - streams OGG/Opus directly
- FFmpeg implementation exists only in `test.buskplayer.com/broadcaster/server.js`
- Browser prefers OGG/Opus but falls back to WebM/Opus if OGG not supported
- MediaRecorder chunks every 100ms (variable size, Opus-encoded)
- No resampling in main server - passes through browser's format
- Icecast headers sent as raw HTTP-like text over TCP before binary stream
