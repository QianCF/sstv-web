import { MODE_LIST, getDefaultModeId, getModeInfo } from "./enc/ModeFactory.js";
import { ImageBitmap } from "./enc/ImageBitmap.js";
import { CropView, FitMode } from "./crop-view.js";

const WORKER_URL = new URL("./worker/encode-worker.js", import.meta.url);
const DEFAULT_BARS_URL = new URL("../assets/smpte_color_bars.png", import.meta.url);
const $ = (id) => document.getElementById(id);

let cropView = null;
let worker = null;
let jobCounter = 0;
let activeJobId = null;
/** @type {Map<number, { wantWav: boolean }>} */
const activeJobs = new Map();
let audioCtx = null;
let playingSource = null;
let playingCtx = null;

function showStatus(text) {
	const el = $("status");
	el.textContent = text;
	el.classList.add("show");
	clearTimeout(showStatus._t);
	showStatus._t = setTimeout(() => el.classList.remove("show"), 2500);
}

function setProgress(kind, current, total, label) {
	const bar = $(kind === "save" ? "progress-save" : "progress-play");
	const text = $(kind === "save" ? "progress-save-text" : "progress-play-text");
	if (total <= 0) {
		bar.value = 0;
		text.textContent = "—";
		return;
	}
	bar.value = Math.round((100 * current) / total);
	text.textContent = label || `${current} / ${total}`;
}

function ensureWorker() {
	if (worker) return worker;
	worker = new Worker(WORKER_URL, { type: "module" });
	worker.onmessage = (e) => handleWorkerMessage(e.data);
	return worker;
}

function handleWorkerMessage(msg) {
	if (msg.jobId !== activeJobId) return;

	switch (msg.type) {
		case "progress": {
			const job = activeJobs.get(msg.jobId);
			setProgress(job?.wantWav ? "save" : "play", msg.current, msg.total);
			break;
		}
		case "done": {
			const job = activeJobs.get(msg.jobId);
			activeJobs.delete(msg.jobId);
			if (msg.wav) {
				downloadWav(msg.wav);
				setProgress("save", msg.total || 1, msg.total || 1, "完成");
				showStatus("WAV 已保存");
			} else {
				playPcm(msg.pcm, msg.sampleRate);
				setProgress("play", msg.total || 1, msg.total || 1, "播放中…");
			}
			setUiBusy(false);
			activeJobId = null;
			break;
		}
		case "cancelled":
			activeJobs.delete(msg.jobId);
			setUiBusy(false);
			activeJobId = null;
			showStatus("已取消");
			break;
		case "error":
			activeJobs.delete(msg.jobId);
			setUiBusy(false);
			activeJobId = null;
			showStatus(msg.message || "编码失败");
			break;
	}
}

function setUiBusy(busy) {
	$("btn-play").disabled = busy;
	$("btn-save").disabled = busy;
	$("btn-load").disabled = busy;
	$("mode-select").disabled = busy;
	$("btn-stop").disabled = !busy && !playingSource;
}

function getBitmapPayload() {
	const canvas = cropView.getBitmap();
	const bmp = ImageBitmap.fromCanvas(canvas);
	return {
		width: bmp.width,
		height: bmp.height,
		pixels: bmp.data.buffer,
	};
}

function startEncode(wantWav) {
	stopPlayback();
	const w = ensureWorker();
	const payload = getBitmapPayload();
	const jobId = ++jobCounter;
	activeJobId = jobId;
	activeJobs.set(jobId, { wantWav });
	setUiBusy(true);
	setProgress(wantWav ? "save" : "play", 0, 1, wantWav ? "编码中…" : "编码中…");

	w.postMessage({
		type: "encode",
		data: {
			jobId,
			modeId: $("mode-select").value,
			pixels: payload.pixels,
			width: payload.width,
			height: payload.height,
			wantWav,
		},
	}, [payload.pixels]);
}

function stopPlayback() {
	if (worker && activeJobId) {
		worker.postMessage({ type: "cancel", jobId: activeJobId });
	}
	if (playingSource) {
		try { playingSource.stop(); } catch { /* */ }
		playingSource = null;
	}
	if (playingCtx) {
		playingCtx.close();
		playingCtx = null;
	}
}

function playPcm(pcm, sampleRate) {
	stopPlayback();
	audioCtx = new AudioContext({ sampleRate });
	playingCtx = audioCtx;
	const buffer = audioCtx.createBuffer(1, pcm.length, sampleRate);
	buffer.copyToChannel(pcm, 0);
	const src = audioCtx.createBufferSource();
	src.buffer = buffer;
	src.connect(audioCtx.destination);
	src.onended = () => {
		setProgress("play", 0, 0);
		$("btn-stop").disabled = true;
		showStatus("播放完成");
	};
	src.start();
	playingSource = src;
	$("btn-stop").disabled = false;
}

function downloadWav(wavBuffer) {
	const blob = new Blob([wavBuffer], { type: "audio/wav" });
	const a = document.createElement("a");
	const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const mode = getModeInfo($("mode-select").value);
	a.href = URL.createObjectURL(blob);
	a.download = `sstv_${mode.name.replace(/\s+/g, "_")}_${ts}.wav`;
	a.click();
	URL.revokeObjectURL(a.href);
}

function loadImageUrl(url) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const c = document.createElement("canvas");
			c.width = img.naturalWidth;
			c.height = img.naturalHeight;
			c.getContext("2d").drawImage(img, 0, 0);
			resolve(c);
		};
		img.onerror = () => reject(new Error("图片加载失败"));
		img.src = url;
	});
}
function loadImageFile(file) {
	const url = URL.createObjectURL(file);
	const img = new Image();
	img.onload = () => {
		const c = document.createElement("canvas");
		c.width = img.naturalWidth;
		c.height = img.naturalHeight;
		c.getContext("2d").drawImage(img, 0, 0);
		cropView.loadSourceCanvas(c);
		URL.revokeObjectURL(url);
		showStatus("图片已加载");
	};
	img.onerror = () => {
		URL.revokeObjectURL(url);
		showStatus("无法加载图片");
	};
	img.src = url;
}

async function loadDefaultBars() {
	try {
		const canvas = await loadImageUrl(DEFAULT_BARS_URL.href);
		cropView.loadSourceCanvas(canvas);
	} catch {
		showStatus("默认彩条加载失败");
	}
}

function onModeChange() {
	const info = getModeInfo($("mode-select").value);
	cropView.setModeSize(info.width, info.height);
	$("title").textContent = `SSTV Encoder — ${info.name}`;
}

function initModeSelect() {
	const sel = $("mode-select");
	for (const m of MODE_LIST) {
		const opt = document.createElement("option");
		opt.value = m.id;
		opt.textContent = m.name;
		sel.appendChild(opt);
	}
	sel.value = getDefaultModeId();
}

function bindControls() {
	$("btn-load").addEventListener("click", () => $("file-input").click());
	$("file-input").addEventListener("change", (e) => {
		const f = e.target.files?.[0];
		if (f) loadImageFile(f);
		e.target.value = "";
	});
	$("btn-rotate").addEventListener("click", () => cropView.rotate90());
	$("btn-reset").addEventListener("click", () => cropView.resetImage());
	$("fit-select").addEventListener("change", () => {
		cropView.setFitMode($("fit-select").value === "crop" ? FitMode.CROP : FitMode.CONTAIN);
	});
	$("mode-select").addEventListener("change", onModeChange);
	$("btn-play").addEventListener("click", () => startEncode(false));
	$("btn-save").addEventListener("click", () => startEncode(true));
	$("btn-stop").addEventListener("click", () => {
		stopPlayback();
		setUiBusy(false);
		setProgress("play", 0, 0);
		showStatus("已停止");
	});
	window.addEventListener("resize", () => {
		cropView.resize();
		cropView.draw();
	});
}

function init() {
	initModeSelect();
	cropView = new CropView($("crop-canvas"));
	onModeChange();
	loadDefaultBars();
	bindControls();
}

init();
