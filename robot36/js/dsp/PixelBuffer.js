export class PixelBuffer {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.line = 0;
		this.pixels = new Int32Array(width * height);
	}
}
