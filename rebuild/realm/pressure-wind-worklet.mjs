import { PressureWindDSP } from './pressure-wind.mjs';

class PressureWindProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.dsp = new PressureWindDSP(sampleRate, options.processorOptions);
    this.port.onmessage = event => {
      const message = event.data;
      if (message?.type === 'progress') this.dsp.setProgress(message.progress);
      if (message?.type === 'stop') this.dsp.stop();
      if (message?.type === 'shutdown') this.dsp.stop(true);
    };
  }
  process(inputs, outputs) {
    const channels = outputs[0];
    if (!channels?.[0] || !channels[1]) return !this.dsp.ended;
    const alive = this.dsp.render(channels[0], channels[1]);
    if (!alive) { this.port.postMessage({ type: 'ended' }); this.port.onmessage = null; }
    return alive;
  }
}
registerProcessor('pressure-wind', PressureWindProcessor);
