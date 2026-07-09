export class ColorConverter {
	static clamp(value) {
		if (typeof value === "number" && Number.isInteger(value)) {
			return Math.min(Math.max(value, 0), 255);
		}
		return Math.min(Math.max(value, 0), 1);
	}

	static float2int(level) {
		const intensity = Math.round(255 * level);
		return ColorConverter.clamp(intensity);
	}

	static compress(level) {
		const compressed = Math.sqrt(ColorConverter.clamp(level));
		return ColorConverter.float2int(compressed);
	}

	static _YUV2RGBInt(Y, U, V) {
		Y -= 16;
		U -= 128;
		V -= 128;
		const R = ColorConverter.clamp((298 * Y + 409 * V + 128) >> 8);
		const G = ColorConverter.clamp((298 * Y - 100 * U - 208 * V + 128) >> 8);
		const B = ColorConverter.clamp((298 * Y + 516 * U + 128) >> 8);
		return 0xff000000 | (R << 16) | (G << 8) | B;
	}

	static YUV2RGB(Y, U, V) {
		if (V === undefined) {
			const YUV = Y;
			return ColorConverter._YUV2RGBInt((YUV & 0x00ff0000) >> 16, (YUV & 0x0000ff00) >> 8, YUV & 0x000000ff);
		}
		return ColorConverter._YUV2RGBInt(ColorConverter.float2int(Y), ColorConverter.float2int(U), ColorConverter.float2int(V));
	}

	static GRAY(level) {
		return 0xff000000 | 0x00010101 * ColorConverter.compress(level);
	}

	static RGB(red, green, blue) {
		return 0xff000000 | (ColorConverter.float2int(red) << 16) | (ColorConverter.float2int(green) << 8) | ColorConverter.float2int(blue);
	}
}
