/** Web 端位图，对应 Android Bitmap ARGB 像素访问 */
export class ImageBitmap {
	constructor(width, height, rgba) {
		this.width = width;
		this.height = height;
		this.data = rgba;
	}

	getPixel(x, y) {
		const i = (y * this.width + x) * 4;
		const r = this.data[i];
		const g = this.data[i + 1];
		const b = this.data[i + 2];
		return (255 << 24) | (r << 16) | (g << 8) | b;
	}

	static fromCanvas(canvas) {
		const ctx = canvas.getContext("2d");
		const { width, height } = canvas;
		return new ImageBitmap(width, height, ctx.getImageData(0, 0, width, height).data);
	}

	static fromRgbaBuffer(width, height, buffer) {
		return new ImageBitmap(width, height, new Uint8ClampedArray(buffer));
	}
}

export function colorRed(c) { return (c >> 16) & 255; }
export function colorGreen(c) { return (c >> 8) & 255; }
export function colorBlue(c) { return c & 255; }
