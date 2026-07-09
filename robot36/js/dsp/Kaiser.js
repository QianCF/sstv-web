export class Kaiser {
	constructor() {
		this.summands = new Float64Array(35);
	}

	square(value) {
		return value * value;
	}

	i0(x) {
		this.summands[0] = 1;
		let val = 1;
		for (let n = 1; n < this.summands.length; ++n)
			this.summands[n] = this.square(val *= x / (2 * n));
		this.summands.sort();
		let sum = 0;
		for (let n = this.summands.length - 1; n >= 0; --n)
			sum += this.summands[n];
		return sum;
	}

	window(a, n, N) {
		return this.i0(Math.PI * a * Math.sqrt(1 - this.square((2.0 * n) / (N - 1) - 1))) / this.i0(Math.PI * a);
	}
}
