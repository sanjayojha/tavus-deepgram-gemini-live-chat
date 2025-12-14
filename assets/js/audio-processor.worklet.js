class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        //this.bufferSize = 3200; // 200ms at 16kHz sample rate
        this.bufferSize = 4000; // 250ms at 16kHz sample rate (Formula: bufferSize = (milliseconds / 1000) * sampleRate)
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const inputChannel = input[0];

            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex++] = inputChannel[i];

                // When buffer is full, send it to main thread
                if (this.bufferIndex >= this.bufferSize) {
                    this.port.postMessage({
                        audio: this.buffer.slice(0),
                    });
                    this.bufferIndex = 0;
                }
            }
        }
        return true; // Keep processor alive
    }
}

registerProcessor("audio-processor", AudioProcessor);
