import Capture from './Capture';

const DEFAULT_MIME_TYPES = ['audio/ogg;codecs=opus', 'audio/ogg'];

export default class MediaRecorderCapture extends Capture {
  constructor() {
    super();
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.mimeType = null;
  }

  static resolveMimeType(preferredMimeTypes = DEFAULT_MIME_TYPES) {
    for (const format of preferredMimeTypes) {
      try {
        if (MediaRecorder.isTypeSupported(format)) {
          return format;
        }
      } catch (_error) {
        // If format checks fail in browser, continue to next candidate.
      }
    }
    return preferredMimeTypes[0] || 'audio/ogg;codecs=opus';
  }

  async start(options) {
    const {
      mediaConstraints,
      mimeType,
      audioBitsPerSecond = 128000,
      timesliceMs = 100,
      onChunk
    } = options;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: mediaConstraints
    });

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond
      });
      this.mimeType = this.mediaRecorder.mimeType || mimeType;
    } catch (_error) {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        audioBitsPerSecond
      });
      this.mimeType = this.mediaRecorder.mimeType || 'audio/webm;codecs=opus';
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0 || typeof onChunk !== 'function') {
        return;
      }
      onChunk(event.data);
    };

    this.mediaRecorder.start(timesliceMs);

    return {
      stream: this.mediaStream,
      mimeType: this.mimeType
    };
  }

  stop() {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }

    this.mediaRecorder = null;
    this.mediaStream = null;
  }
}
