# Near-Zero Latency Plan (Future Phase)

This document describes a future path to near-zero latency monitoring/listening while keeping the current Icecast pipeline stable for public playback.

## Current Baseline (Stable)

- Browser ingest: `MediaRecorder` (`audio/webm;codecs=opus`) -> WebSocket -> Node server
- Node server: transcodes browser ingest to `audio/mpeg` for Icecast listener compatibility
- Public listener URL: `https://test.buskplayer.com/ether`
- Typical listener delay with Icecast + HTML audio: several seconds

This baseline is intentionally compatibility-first and should remain the default public path.

## Goal

Add a **parallel low-latency listener path** for near-live monitoring (target: ~0.3s to ~1.5s), without breaking the public Icecast stream.

## Recommended Architecture

Keep two outputs from server:

1. **Compatibility Output (existing)**
   - `audio/mpeg` -> Icecast
   - Used for public listeners

2. **Low-Latency Output (new)**
   - WebRTC-based monitor channel (preferred)
   - Used for near-live operator/venue monitoring

Why this split:
- Icecast + HTML `<audio>` is reliable but buffered.
- WebRTC is built for real-time and can run in parallel.

## Proposed Phase Plan

### Phase A: Instrumentation (no behavior change)

- Add optional latency markers in audio messages:
  - capture timestamp
  - server ingress timestamp
  - client playback timestamp (monitor page)
- Log median/p95 end-to-end delay for test sessions.

Deliverable: measured baseline numbers before protocol changes.

### Phase B: Low-Latency Monitor Channel (parallel path)

- Add a new endpoint for monitor clients (separate from Icecast URL).
- Start with one-way audio (broadcaster -> listeners), no chat/data needed.
- Keep auth simple (shared token or short-lived signed token).

Deliverable: monitor page with near-live playback for approved clients.

### Phase C: Production Hardening

- Add reconnect logic and health checks for monitor path.
- Add max monitor listener cap and basic abuse protection.
- Add feature toggle in config:
  - `ENABLE_LOW_LATENCY_MONITOR=true/false`

Deliverable: optional, production-safe near-live mode.

## Candidate Technologies

### Option 1 (Preferred): WebRTC (one-way audio)

Pros:
- Lowest practical browser latency
- Native A/V sync and jitter handling
- Good ecosystem support

Cons:
- More moving parts than Icecast
- Signaling required

### Option 2: Custom WebSocket + MSE/WebCodecs

Pros:
- Full control
- Can share transport concepts with existing pipeline

Cons:
- Higher implementation complexity
- Browser codec/container edge cases

Recommendation: start with WebRTC for fastest path to near-live.

## Integration Notes for This Repo

- Keep current modules (`capture`, `transport`, `protocol`) as-is.
- Add new monitor transport modules under `src/audio/monitor/` (future).
- Do not replace existing broadcast button behavior.
- Do not remove Icecast output path.

## Quality and UX Targets

- Public stream:
  - stable playback, broad compatibility
  - acceptable delay for casual ambient use

- Monitor stream:
  - target < 1.5s glass-to-glass
  - prioritize continuity over absolute fidelity

## Rollout Strategy

1. Ship monitor path disabled by default.
2. Test on local network and one real venue.
3. Enable per environment after confidence check.
4. Keep instant rollback to Icecast-only mode.

## Out of Scope for This Plan

- Replacing Icecast public distribution
- Full duplex communication
- Studio-grade audio transport guarantees

