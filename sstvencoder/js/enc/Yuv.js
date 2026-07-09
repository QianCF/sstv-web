import { YuvConverter } from "./YuvConverter.js";

export const YuvImageFormat = { NV21: "NV21", YUV440P: "YUV440P", YUY2: "YUY2" };

class YuvBase {
	constructor(bitmap) {
		this.mWidth = bitmap.width;
		this.mHeight = bitmap.height;
		this.mYuv = null;
		this.convertBitmapToYuv(bitmap);
	}

	getWidth() { return this.mWidth; }
	getHeight() { return this.mHeight; }
}

export class NV21 extends YuvBase {
	convertBitmapToYuv(bitmap) {
		const w = this.mWidth;
		const h = this.mHeight;
		this.mYuv = new Uint8Array(((3 * w * h) / 2) | 0);
		let pos = 0;
		for (let y = 0; y < h; ++y)
			for (let x = 0; x < w; ++x)
				this.mYuv[pos++] = YuvConverter.convertToY(bitmap.getPixel(x, y));
		for (let y = 0; y < h; y += 2) {
			for (let x = 0; x < w; x += 2) {
				const v0 = YuvConverter.convertToV(bitmap.getPixel(x, y));
				const v1 = YuvConverter.convertToV(bitmap.getPixel(x + 1, y));
				const v2 = YuvConverter.convertToV(bitmap.getPixel(x, y + 1));
				const v3 = YuvConverter.convertToV(bitmap.getPixel(x + 1, y + 1));
				this.mYuv[pos++] = ((v0 + v1 + v2 + v3) / 4) | 0;
				const u0 = YuvConverter.convertToU(bitmap.getPixel(x, y));
				const u1 = YuvConverter.convertToU(bitmap.getPixel(x + 1, y));
				const u2 = YuvConverter.convertToU(bitmap.getPixel(x, y + 1));
				const u3 = YuvConverter.convertToU(bitmap.getPixel(x + 1, y + 1));
				this.mYuv[pos++] = ((u0 + u1 + u2 + u3) / 4) | 0;
			}
		}
	}

	getY(x, y) { return this.mYuv[wIdx(this.mWidth, y) + x] & 255; }
	getU(x, y) { return this.mYuv[this.mWidth * this.mHeight + this.mWidth * (y >> 1) + (x | 1)] & 255; }
	getV(x, y) { return this.mYuv[this.mWidth * this.mHeight + this.mWidth * (y >> 1) + (x & ~1)] & 255; }
}

function wIdx(w, y) { return w * y; }

export class YUV440P extends YuvBase {
	convertBitmapToYuv(bitmap) {
		const w = this.mWidth;
		const h = this.mHeight;
		this.mYuv = new Uint8Array(2 * w * h);
		let pos = 0;
		for (let y = 0; y < h; ++y)
			for (let x = 0; x < w; ++x)
				this.mYuv[pos++] = YuvConverter.convertToY(bitmap.getPixel(x, y));
		for (let y = 0; y < h; y += 2)
			for (let x = 0; x < w; ++x) {
				const u0 = YuvConverter.convertToU(bitmap.getPixel(x, y));
				const u1 = YuvConverter.convertToU(bitmap.getPixel(x, y + 1));
				this.mYuv[pos++] = ((u0 + u1) / 2) | 0;
			}
		for (let y = 0; y < h; y += 2)
			for (let x = 0; x < w; ++x) {
				const v0 = YuvConverter.convertToV(bitmap.getPixel(x, y));
				const v1 = YuvConverter.convertToV(bitmap.getPixel(x, y + 1));
				this.mYuv[pos++] = ((v0 + v1) / 2) | 0;
			}
	}

	getY(x, y) { return this.mYuv[this.mWidth * y + x] & 255; }
	getU(x, y) { return this.mYuv[this.mWidth * this.mHeight + this.mWidth * (y >> 1) + x] & 255; }
	getV(x, y) { return this.mYuv[((3 * this.mWidth * this.mHeight) >> 1) + this.mWidth * (y >> 1) + x] & 255; }
}

export class YUY2 extends YuvBase {
	convertBitmapToYuv(bitmap) {
		const w = this.mWidth;
		const h = this.mHeight;
		this.mYuv = new Uint8Array(2 * w * h);
		let pos = 0;
		for (let y = 0; y < h; ++y)
			for (let x = 0; x < w; x += 2) {
				this.mYuv[pos++] = YuvConverter.convertToY(bitmap.getPixel(x, y));
				const u0 = YuvConverter.convertToU(bitmap.getPixel(x, y));
				const u1 = YuvConverter.convertToU(bitmap.getPixel(x + 1, y));
				this.mYuv[pos++] = ((u0 + u1) / 2) | 0;
				this.mYuv[pos++] = YuvConverter.convertToY(bitmap.getPixel(x + 1, y));
				const v0 = YuvConverter.convertToV(bitmap.getPixel(x, y));
				const v1 = YuvConverter.convertToV(bitmap.getPixel(x + 1, y));
				this.mYuv[pos++] = ((v0 + v1) / 2) | 0;
			}
	}

	getY(x, y) { return this.mYuv[2 * this.mWidth * y + 2 * x] & 255; }
	getU(x, y) { return this.mYuv[2 * this.mWidth * y + (((x & ~1) << 1) | 1)] & 255; }
	getV(x, y) { return this.mYuv[2 * this.mWidth * y + ((x << 1) | 3)] & 255; }
}

export function createYuv(bitmap, format) {
	switch (format) {
		case YuvImageFormat.NV21: return new NV21(bitmap);
		case YuvImageFormat.YUV440P: return new YUV440P(bitmap);
		case YuvImageFormat.YUY2: return new YUY2(bitmap);
		default: throw new Error(`Unknown YUV format: ${format}`);
	}
}
