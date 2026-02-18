export const MESSAGE_TYPES = {
  CONFIG: 'config',
  AUDIO_CHUNK: 'audio-chunk'
};

export const PROTOCOL_VERSION = 1;

const hasBuffer = typeof Buffer !== 'undefined';

function uint8ToBase64(uint8Array) {
  if (hasBuffer) {
    return Buffer.from(uint8Array).toString('base64');
  }

  let binary = '';
  for (let i = 0; i < uint8Array.length; i += 1) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64String) {
  if (hasBuffer) {
    return Buffer.from(base64String, 'base64');
  }

  const binary = atob(base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeAudioPayload(arrayBuffer) {
  return uint8ToBase64(new Uint8Array(arrayBuffer));
}

export function decodeAudioPayload(base64Payload) {
  return base64ToBuffer(base64Payload);
}

export function createAudioChunkMessage({ sequence, payload, mimeType }) {
  return {
    type: MESSAGE_TYPES.AUDIO_CHUNK,
    sequence,
    timestampMs: Date.now(),
    mimeType,
    payload
  };
}

export function withProtocolEnvelope(message) {
  return {
    ...message,
    v: PROTOCOL_VERSION,
    sentAtMs: Date.now()
  };
}

export function parseMessage(rawMessage) {
  if (typeof rawMessage !== 'string') {
    return null;
  }

  try {
    return JSON.parse(rawMessage);
  } catch (_error) {
    return null;
  }
}

export function isAudioChunkMessage(message) {
  return (
    message &&
    message.type === MESSAGE_TYPES.AUDIO_CHUNK &&
    Number.isInteger(message.sequence) &&
    Number.isFinite(message.timestampMs) &&
    typeof message.payload === 'string'
  );
}
