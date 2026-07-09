/** 裁剪视图：平移/缩放图片，输出 SSTV 模式尺寸位图 */
export const FitMode = {
	/** 保持图片宽高比，完整显示，黑底，可缩小留边 */
	CONTAIN: "contain",
	/** 裁切填满模式框（Android 原版行为） */
	CROP: "crop",
};

export class CropView {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.originalSource = null;
		this.source = null;
		this.modeW = 320;
		this.modeH = 240;
		this.fitMode = FitMode.CONTAIN;
		this.srcRect = { x: 0, y: 0, w: 1, h: 1 };
		this.containScale = 1;
		this.containOffsetX = 0;
		this.containOffsetY = 0;
		this.dragging = false;
		this.lastX = 0;
		this.lastY = 0;
		this.pinching = false;
		this.pinchDist = 0;
		this._bindEvents();
	}

	setFitMode(mode) {
		if (this.fitMode === mode) return;
		this.fitMode = mode;
		this.resetImage();
		this.draw();
	}

	_bindEvents() {
		const posFromClient = (clientX, clientY) => this._clientToCanvas(clientX, clientY);

		const startPan = (x, y) => {
			this.dragging = true;
			this.lastX = x;
			this.lastY = y;
		};
		const movePan = (x, y) => {
			if (!this.dragging || !this.source) return;
			const dx = x - this.lastX;
			const dy = y - this.lastY;
			this.lastX = x;
			this.lastY = y;
			if (this.fitMode === FitMode.CONTAIN)
				this._panContain(dx, dy);
			else
				this._panCrop(dx, dy);
			this.draw();
		};
		const endPan = () => { this.dragging = false; };

		this.canvas.addEventListener("mousedown", (e) => {
			if (e.button !== 0) return;
			startPan(e.offsetX, e.offsetY);
		});
		this.canvas.addEventListener("mousemove", (e) => {
			if (e.buttons & 1) movePan(e.offsetX, e.offsetY);
		});
		this.canvas.addEventListener("mouseup", endPan);
		this.canvas.addEventListener("mouseleave", endPan);

		this.canvas.addEventListener("touchstart", (e) => {
			if (!this.source) return;
			const r = this.canvas.getBoundingClientRect();
			if (e.touches.length === 2) {
				e.preventDefault();
				this.pinching = true;
				this.dragging = false;
				this.pinchDist = this._touchDistance(e.touches[0], e.touches[1]);
				return;
			}
			if (e.touches.length === 1 && !this.pinching) {
				e.preventDefault();
				const p = posFromClient(e.touches[0].clientX, e.touches[0].clientY);
				startPan(p.x, p.y);
			}
		}, { passive: false });

		this.canvas.addEventListener("touchmove", (e) => {
			if (!this.source) return;
			if (e.touches.length === 2) {
				e.preventDefault();
				const dist = this._touchDistance(e.touches[0], e.touches[1]);
				const center = this._touchCenter(e.touches[0], e.touches[1]);
				if (this.pinchDist > 0) {
					const factor = dist / this.pinchDist;
					if (Math.abs(factor - 1) > 0.002) {
						this._zoomAt(center.x, center.y, factor);
						this.draw();
					}
				}
				this.pinchDist = dist;
				this.pinching = true;
				this.dragging = false;
				return;
			}
			if (e.touches.length === 1 && !this.pinching) {
				e.preventDefault();
				const p = posFromClient(e.touches[0].clientX, e.touches[0].clientY);
				movePan(p.x, p.y);
			}
		}, { passive: false });

		this.canvas.addEventListener("touchend", (e) => {
			if (e.touches.length < 2) {
				this.pinching = false;
				this.pinchDist = 0;
			}
			if (e.touches.length === 0)
				endPan();
			else if (e.touches.length === 1 && !this.pinching) {
				const p = posFromClient(e.touches[0].clientX, e.touches[0].clientY);
				this.lastX = p.x;
				this.lastY = p.y;
			}
		}, { passive: false });

		this.canvas.addEventListener("touchcancel", () => {
			this.pinching = false;
			this.pinchDist = 0;
			endPan();
		});

		this.canvas.addEventListener("wheel", (e) => {
			e.preventDefault();
			if (!this.source) return;
			const factor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
			this._zoomAt(e.offsetX, e.offsetY, factor);
			this.draw();
		}, { passive: false });
	}

	/** 触摸点 → canvas 像素坐标（兼容 CSS 缩放） */
	_clientToCanvas(clientX, clientY) {
		const r = this.canvas.getBoundingClientRect();
		const sx = this.canvas.width / r.width;
		const sy = this.canvas.height / r.height;
		return {
			x: (clientX - r.left) * sx,
			y: (clientY - r.top) * sy,
		};
	}

	_touchDistance(t0, t1) {
		const dx = t1.clientX - t0.clientX;
		const dy = t1.clientY - t0.clientY;
		return Math.hypot(dx, dy);
	}

	_touchCenter(t0, t1) {
		return this._clientToCanvas(
			(t0.clientX + t1.clientX) / 2,
			(t0.clientY + t1.clientY) / 2,
		);
	}

	setModeSize(w, h) {
		this.modeW = w;
		this.modeH = h;
		if (this.source) this.resetImage();
		this.resize();
		this.draw();
	}

	resize() {
		const wrap = this.canvas.parentElement;
		this.canvas.width = wrap.clientWidth;
		this.canvas.height = wrap.clientHeight;
	}

	loadSourceCanvas(srcCanvas) {
		this.originalSource = copyCanvas(srcCanvas);
		this.source = copyCanvas(srcCanvas);
		this.resetImage();
		this.draw();
	}

	resetImage() {
		if (!this.source) return;
		if (this.originalSource)
			this.source = copyCanvas(this.originalSource);
		if (this.fitMode === FitMode.CONTAIN)
			this._resetContain();
		else
			this._resetCrop();
	}

	/** 适应模式：尽量大、不裁剪、居中、黑底 */
	_resetContain() {
		this.containScale = 1;
		this.containOffsetX = 0;
		this.containOffsetY = 0;
	}

	/** 裁剪模式：与 Android resetInputRect 一致 */
	_resetCrop() {
		const ow = this.source.width;
		const oh = this.source.height;
		const iw = this.modeW;
		const ih = this.modeH;
		if (iw * oh > ow * ih) {
			const right = (iw * oh) / ih;
			this.srcRect = { x: (ow - right) / 2, y: 0, w: right, h: oh };
		} else {
			const bottom = (ih * ow) / iw;
			this.srcRect = { x: 0, y: (oh - bottom) / 2, w: ow, h: bottom };
		}
		this._clampSrcRect();
	}

	rotate90() {
		if (!this.source) return;
		const w = this.source.width;
		const h = this.source.height;
		const rotated = document.createElement("canvas");
		rotated.width = h;
		rotated.height = w;
		const ctx = rotated.getContext("2d");
		ctx.translate(h / 2, w / 2);
		ctx.rotate(Math.PI / 2);
		ctx.drawImage(this.source, -w / 2, -h / 2);
		this.source = rotated;
		if (this.fitMode === FitMode.CONTAIN)
			this._resetContain();
		else
			this._resetCrop();
		this.draw();
	}

	_baseFitScale() {
		return Math.min(this.modeW / this.source.width, this.modeH / this.source.height);
	}

	_containLayout() {
		const sw = this.source.width;
		const sh = this.source.height;
		const s = this._baseFitScale() * this.containScale;
		const dw = sw * s;
		const dh = sh * s;
		const cx = this.modeW / 2 + this.containOffsetX;
		const cy = this.modeH / 2 + this.containOffsetY;
		return {
			sw, sh, s, dw, dh,
			left: cx - dw / 2,
			top: cy - dh / 2,
		};
	}

	_panContain(dx, dy) {
		const vs = this._viewScale();
		this.containOffsetX += dx / vs;
		this.containOffsetY += dy / vs;
	}

	_panCrop(dx, dy) {
		const vs = this._viewScale();
		this.srcRect.x -= dx / vs;
		this.srcRect.y -= dy / vs;
		this._clampSrcRect();
	}

	_outputRect() {
		const w = this.canvas.width;
		const h = this.canvas.height;
		const ow = (9 * w) / 10;
		const oh = (9 * h) / 10;
		let rw, rh, ox, oy;
		if (this.modeW * oh < ow * this.modeH) {
			rw = (this.modeW * oh) / this.modeH;
			rh = oh;
			ox = (w - rw) / 2;
			oy = (h - oh) / 2;
		} else {
			rw = ow;
			rh = (this.modeH * ow) / this.modeW;
			ox = (w - ow) / 2;
			oy = (h - rh) / 2;
		}
		return { x: ox, y: oy, w: rw, h: rh };
	}

	_viewScale() {
		return this._outputRect().w / this.modeW;
	}

	_screenToMode(px, py) {
		const out = this._outputRect();
		const vs = this._viewScale();
		return {
			x: (px - out.x) / vs,
			y: (py - out.y) / vs,
		};
	}

	_clampSrcRect() {
		if (!this.source) return;
		const sw = this.source.width;
		const sh = this.source.height;
		this.srcRect.w = Math.min(this.srcRect.w, sw);
		this.srcRect.h = Math.min(this.srcRect.h, sh);
		this.srcRect.x = Math.max(0, Math.min(this.srcRect.x, sw - this.srcRect.w));
		this.srcRect.y = Math.max(0, Math.min(this.srcRect.y, sh - this.srcRect.h));
	}

	_zoomAt(px, py, factor) {
		const out = this._outputRect();
		if (px < out.x || py < out.y || px > out.x + out.w || py > out.y + out.h) return;

		if (this.fitMode === FitMode.CONTAIN) {
			const { x: mx, y: my } = this._screenToMode(px, py);
			const lay = this._containLayout();
			const u = lay.dw > 0 ? (mx - lay.left) / lay.dw : 0.5;
			const v = lay.dh > 0 ? (my - lay.top) / lay.dh : 0.5;

			this.containScale *= factor;
			this.containScale = Math.max(0.05, Math.min(this.containScale, 8));

			const lay2 = this._containLayout();
			const left2 = mx - u * lay2.dw;
			const top2 = my - v * lay2.dh;
			this.containOffsetX = left2 + lay2.dw / 2 - this.modeW / 2;
			this.containOffsetY = top2 + lay2.dh / 2 - this.modeH / 2;
		} else {
			const u = (px - out.x) / out.w;
			const v = (py - out.y) / out.h;
			const cx = this.srcRect.x + u * this.srcRect.w;
			const cy = this.srcRect.y + v * this.srcRect.h;
			this.srcRect.w *= factor;
			this.srcRect.h *= factor;
			this.srcRect.x = cx - u * this.srcRect.w;
			this.srcRect.y = cy - v * this.srcRect.h;
			this._clampSrcRect();
		}
	}

	draw() {
		const ctx = this.ctx;
		const w = this.canvas.width;
		const h = this.canvas.height;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, w, h);
		if (!this.source) return;

		const out = this._outputRect();
		const vs = this._viewScale();

		ctx.save();
		ctx.beginPath();
		ctx.rect(out.x, out.y, out.w, out.h);
		ctx.clip();
		ctx.fillStyle = "#000";
		ctx.fillRect(out.x, out.y, out.w, out.h);

		if (this.fitMode === FitMode.CONTAIN) {
			const lay = this._containLayout();
			ctx.drawImage(
				this.source,
				0, 0, lay.sw, lay.sh,
				out.x + lay.left * vs,
				out.y + lay.top * vs,
				lay.dw * vs,
				lay.dh * vs,
			);
		} else {
			const { x, y, w: sw, h: sh } = this.srcRect;
			ctx.drawImage(this.source, x, y, sw, sh, out.x, out.y, out.w, out.h);
		}
		ctx.restore();

		ctx.strokeStyle = "#4488ff";
		ctx.lineWidth = 2;
		ctx.strokeRect(out.x + 0.5, out.y + 0.5, out.w - 1, out.h - 1);
		ctx.strokeStyle = "#44ff88";
		ctx.strokeRect(out.x + 1.5, out.y + 1.5, out.w - 3, out.h - 3);
		ctx.strokeStyle = "#ff4444";
		ctx.strokeRect(out.x + 2.5, out.y + 2.5, out.w - 5, out.h - 5);
	}

	getBitmap() {
		const c = document.createElement("canvas");
		c.width = this.modeW;
		c.height = this.modeH;
		const ctx = c.getContext("2d");
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, this.modeW, this.modeH);
		if (!this.source) return c;

		if (this.fitMode === FitMode.CONTAIN) {
			const lay = this._containLayout();
			ctx.drawImage(this.source, 0, 0, lay.sw, lay.sh, lay.left, lay.top, lay.dw, lay.dh);
		} else {
			const { x, y, w, h } = this.srcRect;
			ctx.drawImage(this.source, x, y, w, h, 0, 0, this.modeW, this.modeH);
		}
		return c;
	}
}

function copyCanvas(src) {
	const c = document.createElement("canvas");
	c.width = src.width;
	c.height = src.height;
	c.getContext("2d").drawImage(src, 0, 0);
	return c;
}
