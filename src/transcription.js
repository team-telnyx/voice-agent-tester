/**
 * Audio utility functions for voice agent testing.
 */

/**
 * Converts PCM buffer to WAV format
 * @param {Buffer} pcmBuffer - The PCM audio data
 * @param {number} sampleRate - Sample rate in Hz
 * @param {number} channels - Number of audio channels
 * @param {number} bitsPerSample - Bits per sample (usually 16)
 * @returns {Buffer} - The WAV file buffer
 */
export function pcmToWav(pcmBuffer, sampleRate, channels, bitsPerSample) {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  const wavBuffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF chunk descriptor
  wavBuffer.write('RIFF', offset); offset += 4;
  wavBuffer.writeUInt32LE(fileSize, offset); offset += 4;
  wavBuffer.write('WAVE', offset); offset += 4;

  // fmt sub-chunk
  wavBuffer.write('fmt ', offset); offset += 4;
  wavBuffer.writeUInt32LE(16, offset); offset += 4; // Sub-chunk size
  wavBuffer.writeUInt16LE(1, offset); offset += 2; // Audio format (1 = PCM)
  wavBuffer.writeUInt16LE(channels, offset); offset += 2;
  wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
  wavBuffer.writeUInt32LE(byteRate, offset); offset += 4;
  wavBuffer.writeUInt16LE(blockAlign, offset); offset += 2;
  wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data sub-chunk
  wavBuffer.write('data', offset); offset += 4;
  wavBuffer.writeUInt32LE(dataSize, offset); offset += 4;
  pcmBuffer.copy(wavBuffer, offset);

  return wavBuffer;
}
