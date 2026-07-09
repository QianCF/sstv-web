export class Hann {
	static window(n, N) {
		return 0.5 * (1.0 - Math.cos((2.0 * Math.PI * n) / (N - 1)));
	}
}
