import { SSTVEngine, frameSampleCount } from "./sstv-engine.js";

const WORKLET_URL = new URL("./worklet/audio-capture.js", import.meta.url);

const SCOPE_W = 640;
const SCOPE_BUF_H = 2560;
const WATERFALL_W = 256;
const WATERFALL_H = 64;

const $ = (id) => document.getElementById(id);

/** 请求尽可能未经处理的原始麦克风数据 */
function rawAudioConstraints(channelCount, sampleRate) {
	const off = {
		echoCancellation: false,
		noiseSuppression: false,
		autoGainControl: false,
		voiceIsolation: false,
		googEchoCancellation: false,
		googAutoGainControl: false,
		googNoiseSuppression: false,
		googHighpassFilter: false,
		googTypingNoiseDetection: false,
		googAudioMirroring: false,
	};
	return {
		...off,
		channelCount,
		sampleRate: { ideal: sampleRate },
		advanced: [
			{ echoCancellation: false },
			{ noiseSuppression: false },
			{ autoGainControl: false },
			{ googEchoCancellation: false },
			{ googAutoGainControl: false },
			{ googNoiseSuppression: false },
			{ googHighpassFilter: false },
		],
	};
}

async function applyRawAudioTrackConstraints(stream) {
	for (const track of stream.getAudioTracks()) {
		try {
			await track.applyConstraints({
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
			});
		} catch {
			// 部分浏览器不支持 applyConstraints，忽略
		}
	}
}

let audioContext = null;
let mediaStream = null;
let workletNode = null;
let sstvEngine = null;
let scopeHeight = 496;

let scopeCtx = null;
let waterfallCtx = null;
let peakCtx = null;
let scopeImage = null;
let waterfallImage = null;
let peakImage = null;

const audioQueue = [];
let uiState = { newLines: false, waterfallDirty: false, mode: null, image: null };
let renderScheduled = false;
let draining = false;

function blitArgbStrip(pixels, width, startRow, rowCount, data) {
	const w = width | 0;
	const h = rowCount | 0;
	const row = startRow | 0;
	for (let y = 0; y < h; y++) {
		const srcBase = (row + y) * w;
		let di = y * w * 4;
		for (let x = 0; x < w; x++) {
			const p = pixels[srcBase + x];
			data[di++] = (p >> 16) & 255;
			data[di++] = (p >> 8) & 255;
			data[di++] = p & 255;
			data[di++] = (p >>> 24) & 255;
		}
	}
}

function ensureScopeImage() {
	if (!scopeImage || scopeImage.width !== SCOPE_W || scopeImage.height !== scopeHeight)
		scopeImage = new ImageData(SCOPE_W, scopeHeight);
	return scopeImage;
}

function ensureWaterfallImage() {
	if (!waterfallImage || waterfallImage.width !== WATERFALL_W || waterfallImage.height !== WATERFALL_H)
		waterfallImage = new ImageData(WATERFALL_W, WATERFALL_H);
	return waterfallImage;
}

function ensurePeakImage() {
	if (!peakImage)
		peakImage = new ImageData(1, 16);
	return peakImage;
}

function resizeScopeCanvas() {
	const wrap = $("scope-wrap");
	const maxW = wrap.clientWidth;
	const maxH = wrap.clientHeight;
	scopeHeight = Math.min(Math.max((SCOPE_W * maxH) / maxW, 496), SCOPE_BUF_H / 2) | 0;
	const scale = Math.min(maxW / SCOPE_W, maxH / scopeHeight);
	const canvas = $("scope");
	canvas.width = SCOPE_W;
	canvas.height = scopeHeight;
	canvas.style.width = `${SCOPE_W * scale}px`;
	canvas.style.height = `${scopeHeight * scale}px`;
	scopeCtx = canvas.getContext("2d");
	scopeImage = null;
}

function initBottomCanvases() {
	const wf = $("waterfall");
	wf.width = WATERFALL_W;
	wf.height = WATERFALL_H;
	waterfallCtx = wf.getContext("2d");
	waterfallCtx.fillStyle = "#000";
	waterfallCtx.fillRect(0, 0, WATERFALL_W, WATERFALL_H);

	const pm = $("peak-meter");
	pm.width = 1;
	pm.height = 16;
	peakCtx = pm.getContext("2d");
	peakCtx.fillStyle = "#404040";
	peakCtx.fillRect(0, 0, 1, 16);
}

function drawScopeFromEngine() {
	if (!sstvEngine || !scopeCtx) return;
	const startRow = (sstvEngine.scopeBuffer.line + SCOPE_BUF_H / 2 - scopeHeight) | 0;
	const img = ensureScopeImage();
	blitArgbStrip(sstvEngine.scopeBuffer.pixels, SCOPE_W, startRow, scopeHeight, img.data);
	scopeCtx.putImageData(img, 0, 0);
}

function drawWaterfallFromEngine() {
	if (!sstvEngine || !waterfallCtx) return;
	const line = sstvEngine.waterfallBuffer.line | 0;
	const img = ensureWaterfallImage();
	blitArgbStrip(sstvEngine.waterfallBuffer.pixels, WATERFALL_W, line, WATERFALL_H, img.data);
	waterfallCtx.putImageData(img, 0, 0);
}

function drawPeakFromEngine() {
	if (!sstvEngine || !peakCtx) return;
	const img = ensurePeakImage();
	blitArgbStrip(sstvEngine.peakMeterBuffer.pixels, 1, 0, 16, img.data);
	peakCtx.putImageData(img, 0, 0);
}

function renderUI() {
	drawPeakFromEngine();
	if (uiState.waterfallDirty)
		drawWaterfallFromEngine();
	if (uiState.newLines)
		drawScopeFromEngine();
	if (uiState.newLines && uiState.mode)
		$("title").textContent = uiState.mode;
	if (uiState.image) {
		showDecodedImage(uiState.image.pixels, uiState.image.width, uiState.image.height);
		showStatus(`解码完成: ${uiState.mode || ""}`);
	}
	uiState = { newLines: false, waterfallDirty: false, mode: null, image: null };
}

function scheduleRender() {
	if (renderScheduled) return;
	renderScheduled = true;
	requestAnimationFrame(() => {
		renderScheduled = false;
		if (!sstvEngine) return;
		renderUI();
	});
}

function releaseAudioBuffer(buffer) {
	if (workletNode && buffer?.buffer)
		workletNode.port.postMessage({ type: "release", buffer }, [buffer.buffer]);
}

function drainAudioQueue() {
	if (draining || !sstvEngine) return;
	draining = true;
	try {
		while (audioQueue.length > 0) {
			const buffer = audioQueue.shift();
			const meta = sstvEngine.processFrame(buffer);
			releaseAudioBuffer(buffer);
			if (meta.newLines) {
				uiState.newLines = true;
				uiState.mode = meta.mode;
			}
			if (meta.waterfallDirty)
				uiState.waterfallDirty = true;
			if (meta.image)
				uiState.image = meta.image;
		}
	} finally {
		draining = false;
	}
	scheduleRender();
	if (audioQueue.length > 0)
		queueMicrotask(drainAudioQueue);
}

function enqueueAudio(buffer) {
	audioQueue.push(buffer);
	drainAudioQueue();
}

function showStatus(text) {
	const el = $("status");
	el.textContent = text;
	el.classList.add("show");
	clearTimeout(showStatus._timer);
	showStatus._timer = setTimeout(() => el.classList.remove("show"), 2500);
}

function showDecodedImage(pixels, width, height) {
	const overlay = $("image-overlay");
	const canvas = $("decoded-image");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	const img = new ImageData(width, height);
	blitArgbStrip(pixels, width, 0, height, img.data);
	ctx.putImageData(img, 0, 0);
	overlay.classList.add("open");
	canvas._pixels = { pixels, width, height };
}

function saveCanvas(canvas, filename) {
	canvas.toBlob((blob) => {
		if (!blob) return;
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = filename;
		a.click();
		URL.revokeObjectURL(a.href);
	});
}

async function startListening() {
	if (workletNode) return;

	const sampleRate = parseInt($("rate-select").value, 10);
	const channelSelect = parseInt($("channel-select").value, 10);
	const wantStereo = channelSelect > 0;

	try {
		mediaStream = await navigator.mediaDevices.getUserMedia({
			audio: rawAudioConstraints(wantStereo ? 2 : 1, sampleRate),
		});
		await applyRawAudioTrackConstraints(mediaStream);
	} catch (err) {
		showStatus("麦克风权限被拒绝");
		throw err;
	}

	audioContext = new AudioContext({ sampleRate });
	const actualRate = audioContext.sampleRate;
	const source = audioContext.createMediaStreamSource(mediaStream);

	sstvEngine = new SSTVEngine(actualRate, {
		channelSelect,
		showSpectrogram: $("waterfall-mode").value === "spectrogram",
		binWidthHz: 10,
	});

	if (actualRate !== sampleRate)
		showStatus(`实际采样率 ${actualRate} Hz（已自动适配）`);

	sstvEngine.setMode($("mode-select").value);

	try {
		await audioContext.audioWorklet.addModule(WORKLET_URL);
	} catch (err) {
		showStatus("Audio Worklet 加载失败");
		stopListening();
		throw err;
	}

	workletNode = new AudioWorkletNode(audioContext, "audio-capture", {
		processorOptions: {
			frameSamples: frameSampleCount(actualRate),
			stereo: wantStereo,
		},
	});

	workletNode.port.onmessage = (e) => {
		const msg = e.data;
		if (msg.type !== "audio" || !sstvEngine) return;
		enqueueAudio(msg.buffer);
	};

	source.connect(workletNode);

	audioQueue.length = 0;
	uiState = { newLines: false, waterfallDirty: false, mode: null, image: null };

	$("btn-start").disabled = true;
	$("btn-stop").disabled = false;
	$("rate-select").disabled = true;
	$("waterfall-mode").disabled = true;
	showStatus("正在监听…");
}

function stopListening() {
	if (workletNode) {
		workletNode.disconnect();
		workletNode = null;
	}
	if (mediaStream) {
		mediaStream.getTracks().forEach((t) => t.stop());
		mediaStream = null;
	}
	if (audioContext) {
		audioContext.close();
		audioContext = null;
	}
	sstvEngine = null;
	audioQueue.length = 0;
	$("btn-start").disabled = false;
	$("btn-stop").disabled = true;
	$("rate-select").disabled = false;
	$("waterfall-mode").disabled = false;
	showStatus("已停止");
}

function bindControls() {
	$("btn-start").addEventListener("click", () => startListening().catch(console.error));
	$("btn-stop").addEventListener("click", stopListening);

	$("mode-select").addEventListener("change", () => {
		const mode = $("mode-select").value;
		if (sstvEngine) sstvEngine.setMode(mode);
		if (mode !== "Auto") $("title").textContent = mode;
		else $("title").textContent = "Robot36 SSTV";
	});

	$("channel-select").addEventListener("change", () => {
		const channel = parseInt($("channel-select").value, 10);
		if (sstvEngine) sstvEngine.setChannel(channel);
		if (workletNode)
			workletNode.port.postMessage({ type: "setStereo", value: channel > 0 });
	});

	$("waterfall-mode").addEventListener("change", () => {
		if (sstvEngine)
			sstvEngine.setSpectrogram($("waterfall-mode").value === "spectrogram");
	});

	$("btn-save-scope").addEventListener("click", () => {
		const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		saveCanvas($("scope"), `scope_${ts}.png`);
	});

	$("btn-save-image").addEventListener("click", () => {
		const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		saveCanvas($("decoded-image"), `sstv_${ts}.png`);
	});

	$("btn-close-image").addEventListener("click", () => {
		$("image-overlay").classList.remove("open");
	});

	window.addEventListener("resize", resizeScopeCanvas);
}

resizeScopeCanvas();
initBottomCanvases();
bindControls();
