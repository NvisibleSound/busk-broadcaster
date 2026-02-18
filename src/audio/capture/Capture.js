export default class Capture {
  async start(_options) {
    throw new Error('Capture.start() must be implemented by subclass');
  }

  stop() {
    throw new Error('Capture.stop() must be implemented by subclass');
  }
}
