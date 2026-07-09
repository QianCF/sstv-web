export class Filter {
	static sinc(x) {
		if (x === 0)
			return 1;
		x *= Math.PI;
		return Math.sin(x) / x;
	}

	static lowPass(cutoff, rate, n, N) {
		const f = 2 * cutoff / rate;
		const x = n - (N - 1) / 2.0;
		return f * Filter.sinc(f * x);
	}
}
