import { RGBDecoder } from "./RGBDecoder.js";

export class RGBModes {
	static Martin(name, code, channelSeconds, sampleRate) {
		const syncPulseSeconds = 0.004862;
		const separatorSeconds = 0.000572;
		const scanLineSeconds = syncPulseSeconds + separatorSeconds + 3 * (channelSeconds + separatorSeconds);
		const greenBeginSeconds = separatorSeconds;
		const greenEndSeconds = greenBeginSeconds + channelSeconds;
		const blueBeginSeconds = greenEndSeconds + separatorSeconds;
		const blueEndSeconds = blueBeginSeconds + channelSeconds;
		const redBeginSeconds = blueEndSeconds + separatorSeconds;
		const redEndSeconds = redBeginSeconds + channelSeconds;
		return new RGBDecoder("Martin " + name, code, 320, 256, 0, scanLineSeconds, greenBeginSeconds, redBeginSeconds, redEndSeconds, greenBeginSeconds, greenEndSeconds, blueBeginSeconds, blueEndSeconds, redEndSeconds, sampleRate);
	}

	static Scottie(name, code, channelSeconds, sampleRate) {
		const syncPulseSeconds = 0.009;
		const separatorSeconds = 0.0015;
		const firstSyncPulseSeconds = syncPulseSeconds + 2 * (separatorSeconds + channelSeconds);
		const scanLineSeconds = syncPulseSeconds + 3 * (channelSeconds + separatorSeconds);
		const blueEndSeconds = -syncPulseSeconds;
		const blueBeginSeconds = blueEndSeconds - channelSeconds;
		const greenEndSeconds = blueBeginSeconds - separatorSeconds;
		const greenBeginSeconds = greenEndSeconds - channelSeconds;
		const redBeginSeconds = separatorSeconds;
		const redEndSeconds = redBeginSeconds + channelSeconds;
		return new RGBDecoder("Scottie " + name, code, 320, 256, firstSyncPulseSeconds, scanLineSeconds, greenBeginSeconds, redBeginSeconds, redEndSeconds, greenBeginSeconds, greenEndSeconds, blueBeginSeconds, blueEndSeconds, redEndSeconds, sampleRate);
	}

	static Wraase_SC2_180(sampleRate) {
		const syncPulseSeconds = 0.0055225;
		const syncPorchSeconds = 0.0005;
		const channelSeconds = 0.235;
		const scanLineSeconds = syncPulseSeconds + syncPorchSeconds + 3 * channelSeconds;
		const redBeginSeconds = syncPorchSeconds;
		const redEndSeconds = redBeginSeconds + channelSeconds;
		const greenBeginSeconds = redEndSeconds;
		const greenEndSeconds = greenBeginSeconds + channelSeconds;
		const blueBeginSeconds = greenEndSeconds;
		const blueEndSeconds = blueBeginSeconds + channelSeconds;
		return new RGBDecoder("Wraase SC2–180", 55, 320, 256, 0, scanLineSeconds, redBeginSeconds, redBeginSeconds, redEndSeconds, greenBeginSeconds, greenEndSeconds, blueBeginSeconds, blueEndSeconds, blueEndSeconds, sampleRate);
	}
}
