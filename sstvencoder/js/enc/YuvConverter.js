export class YuvConverter {
	static convertToY(color) {
		const R = (color >> 16) & 255;
		const G = (color >> 8) & 255;
		const B = color & 255;
		return YuvConverter.clamp(16.0 + 0.003906 * (65.738 * R + 129.057 * G + 25.064 * B));
	}

	static convertToU(color) {
		const R = (color >> 16) & 255;
		const G = (color >> 8) & 255;
		const B = color & 255;
		return YuvConverter.clamp(128.0 + 0.003906 * (-37.945 * R - 74.494 * G + 112.439 * B));
	}

	static convertToV(color) {
		const R = (color >> 16) & 255;
		const G = (color >> 8) & 255;
		const B = color & 255;
		return YuvConverter.clamp(128.0 + 0.003906 * (112.439 * R - 94.154 * G - 18.285 * B));
	}

	static clamp(value) {
		if (value < 0) return 0;
		if (value > 255) return 255;
		return value | 0;
	}
}
