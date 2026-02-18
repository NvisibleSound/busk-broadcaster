import { createAudioChunkMessage, encodeAudioPayload, withProtocolEnvelope } from '../../protocol/audioMessages';

export default class WebSocketTransport {
  constructor({ url, onOpen, onClose, onError, onMessage }) {
    this.url = url;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onError = onError;
    this.onMessage = onMessage;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = (event) => {
      if (typeof this.onOpen === 'function') {
        this.onOpen(event);
      }
    };

    this.ws.onclose = (event) => {
      if (typeof this.onClose === 'function') {
        this.onClose(event);
      }
    };

    this.ws.onerror = (event) => {
      if (typeof this.onError === 'function') {
        this.onError(event);
      }
    };

    this.ws.onmessage = (event) => {
      if (typeof this.onMessage === 'function') {
        this.onMessage(event);
      }
    };
  }

  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  sendJSON(message) {
    if (this.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(withProtocolEnvelope(message)));
  }

  sendConfig(config) {
    this.sendJSON(config);
  }

  async sendAudioChunk({ sequence, blob, mimeType }) {
    if (this.readyState !== WebSocket.OPEN) {
      return;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const payload = encodeAudioPayload(arrayBuffer);
    const message = createAudioChunkMessage({
      sequence,
      payload,
      mimeType
    });

    this.sendJSON(message);
  }

  close() {
    if (!this.ws) {
      return;
    }

    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    this.ws = null;
  }
}
