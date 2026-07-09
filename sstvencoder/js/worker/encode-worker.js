import { ImageBitmap } from "../enc/ImageBitmap.js";
import { createMode } from "../enc/ModeFactory.js";
import { SampleCollector } from "../enc/Output.js";

const jobs = new Map();

self.onmessage = (e) => {
	const msg = e.data;
	if (msg.type === "cancel") {
		const job = jobs.get(msg.jobId);
		if (job) job.cancelled = true;
		return;
	}
	if (msg.type !== "encode") return;

	const { jobId, modeId, pixels, width, height, wantWav } = msg.data;
	const state = { cancelled: false };
	jobs.set(jobId, state);

	try {
		const bmp = ImageBitmap.fromRgbaBuffer(width, height, pixels);
		const collector = new SampleCollector();
		const mode = createMode(modeId, bmp, collector);
		if (!mode) {
			self.postMessage({ type: "error", jobId, message: "图片尺寸与所选模式不匹配" });
			jobs.delete(jobId);
			return;
		}

		mode.init();
		const total = mode.getProcessCount();
		let current = 0;

		const step = () => {
			if (state.cancelled) {
				mode.finish(true);
				jobs.delete(jobId);
				self.postMessage({ type: "cancelled", jobId });
				return;
			}
			if (!mode.process()) {
				mode.finish(false);
				jobs.delete(jobId);
				const pcm = collector.toFloat32Array();
				const transfer = [pcm.buffer];
				const payload = {
					type: "done",
					jobId,
					pcm,
					sampleRate: collector.sampleRate,
					total: pcm.length,
				};
				if (wantWav) {
					payload.wav = collector.toWav();
					transfer.push(payload.wav);
				}
				self.postMessage(payload, transfer);
				return;
			}
			current = mode.mLine;
			self.postMessage({ type: "progress", jobId, current, total });
			setTimeout(step, 0);
		};
		step();
	} catch (err) {
		jobs.delete(jobId);
		self.postMessage({ type: "error", jobId, message: String(err?.message || err) });
	}
};
