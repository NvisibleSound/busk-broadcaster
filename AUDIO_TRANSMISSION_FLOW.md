# Audio Transmission Flow

This document tracks the current audio transmission pipeline and will be kept updated as changes are made.

```mermaid
flowchart LR
  subgraph Browser[Browser (React)]
    Mic[Microphone Input]
    GUM[getUserMedia\n48kHz stereo, 16-bit]
    MR[MediaRecorder\nWebM/Opus]
    WSClient[WebSocket Client]
  end

  subgraph Server[Node.js WebSocket Server]
    WS[WebSocket Server :8081]
    FF[FFmpeg\nwebm/opus -> mp3]
    TCP[TCP Socket -> Icecast]
  end

  subgraph Icecast[Icecast]
    ICE[Source Mount\nContent-Type: audio/mpeg]
  end

  Mic --> GUM --> MR --> WSClient --> WS
  WS --> FF --> TCP --> ICE
```
