# Audio Streaming Flow - Concise Summary

## 1) Audio Capture

**File**: `src/components/IcecastBroadcaster.js`  
**Function**: `startBroadcast()` (line 403)

**Implementation**: Browser Web Audio API + MediaRecorder

```javascript
// Capture start (line 409)
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

// MediaRecorder setup (lines 477-501)
const preferredMimeTypes = ['audio/ogg;codecs=opus', 'audio/ogg'];
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

**Details**:
- Uses `getUserMedia()` → Web Audio API → MediaRecorder
- Format: OGG/Opus (preferred) or WebM/Opus (fallback)
- Chunks: 100ms intervals (variable size, Opus-encoded)
- Device selection: User-selectable dropdown (line 719)

---

## 2) FFmpeg Usage

**Status**: FFmpeg is **NOT used** in main production server (`server.js`)

**Alternative Implementation**: `test.buskplayer.com/broadcaster/server.js` (lines 29-81)

**Exact Command**:
```bash
ffmpeg -f webm -i pipe:0 -f mp3 -acodec mp3 -ab 128k -ar 48000 -ac 2 pipe:1
```

**Code**:
```javascript
ffmpegProcess = spawn('ffmpeg', [
  '-f', 'webm',      // Input format
  '-i', 'pipe:0',    // Input from stdin
  '-f', 'mp3',       // Output format
  '-acodec', 'mp3',  // Audio codec
  '-ab', '128k',     // Bitrate
  '-ar', '48000',    // Sample rate
  '-ac', '2',        // Channels (stereo)
  'pipe:1'           // Output to stdout
], {
  stdio: ['pipe', 'pipe', 'pipe']
});
```

**Input**: WebM/Opus chunks from WebSocket (line 169: `ffmpegProcess.stdin.write(data)`)  
**Output**: MP3 to Icecast TCP socket (line 53: `icecast.write(data)`)  
**Where**: Server-side only (Node.js `spawn`)  
**Triggered**: When `config` message received (line 155)

**Main Server**: `server.js` streams OGG/Opus directly to Icecast - no FFmpeg conversion.

---

## 3) Audio Transport

**Protocol**: WebSocket (browser → server) → TCP (server → Icecast)

### WebSocket Client (Browser)

**File**: `src/components/IcecastBroadcaster.js` (lines 427-535)

**Connection**:
```javascript
const wsUrl = window.location.hostname === 'localhost'
  ? 'ws://localhost:8081'
  : `wss://${window.location.hostname}/ws`;

wsRef.current = new WebSocket(wsUrl);
wsRef.current.binaryType = 'arraybuffer';
```

**Message Types**:
- **Config** (JSON, sent once on connect):
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
- **Audio** (Binary ArrayBuffer, sent continuously):
  - Direct from MediaRecorder `ondataavailable` event (line 494)
  - Chunk size: Variable (100ms intervals, Opus-encoded)
  - No explicit buffering - sent immediately

**Reconnect**: None - connection failure stops broadcast

### WebSocket Server

**File**: `server.js` (lines 1-169)

**Setup**:
```javascript
const wss = new WebSocketServer({ port: 8081 });
```

**Message Handling**:
```javascript
ws.on('message', async (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.type === 'config') {
      setupIcecastConnection();
    }
  } catch (e) {
    // Not JSON, must be audio data
    if (icecast && isSourceEstablished) {
      const writeSuccess = icecast.write(data);
      if (!writeSuccess) {
        console.log('Write buffer full - waiting for drain');
      }
    }
  }
});
```

### TCP to Icecast

**File**: `server.js` (lines 19-92)

**Connection**:
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

**Backpressure**: Checks `write()` return value, listens for `drain` event (line 89)  
**Chunking**: Binary data written directly from WebSocket message handler

---

## 4) Audio Format Assumptions

### Browser Capture
- **Sample Rate**: 48000 Hz (requested, browser may adjust)
- **Channels**: 2 (stereo)
- **Sample Format**: float32 in Web Audio API → Opus-encoded by MediaRecorder
- **Codec**: Opus
- **Container**: OGG (`audio/ogg;codecs=opus`) preferred, WebM (`audio/webm;codecs=opus`) fallback
- **Bitrate**: 128 kbps (128000 bits/second)

### Server (Main Production - `server.js`)
- **Input**: OGG/Opus from browser
- **Output**: OGG/Opus to Icecast (passthrough, no conversion)
- **Content-Type**: `audio/ogg;codecs=opus`
- **Sample Rate**: 48000 Hz (declared in Ice-Audio-Info header)
- **Channels**: 2 (stereo)
- **Bitrate**: 128 kbps (declared in header)
- **Resampling**: None - passes through as-is

### Server (FFmpeg Version - `test.buskplayer.com/broadcaster/server.js`)
- **Input**: WebM/Opus from browser
- **Output**: MP3 to Icecast
- **Content-Type**: `audio/mpeg`
- **Sample Rate**: 48000 Hz (FFmpeg may resample if input differs)
- **Channels**: 2 (stereo)
- **Bitrate**: 128 kbps
- **Codec**: MP3 (libmp3lame)

### Notes
- Browser sample rate may differ from 48kHz - unclear if validated
- No explicit resampling in main server
- MediaRecorder chunk size varies with audio content
- Sample format conversion (float32 → Opus) handled by browser

---

## Quick Reference

**Flow**: `getUserMedia()` → MediaRecorder (OGG/Opus) → WebSocket (binary) → TCP → Icecast

**Ports**: WebSocket 8081, Icecast 8000

**Chunk Interval**: 100ms (variable size)

**Main Server**: No FFmpeg - direct OGG/Opus passthrough

**FFmpeg Server**: WebM/Opus → MP3 conversion (alternative implementation only)
