export class Complex {
	constructor(real = 0, imag = 0) {
		this.real = real;
		this.imag = imag;
	}

	set(real, imag) {
		if (real instanceof Complex) {
			this.real = real.real;
			this.imag = real.imag;
			return this;
		}
		if (imag === undefined) {
			return this.set(real, 0);
		}
		this.real = real;
		this.imag = imag;
		return this;
	}

	norm() {
		return this.real * this.real + this.imag * this.imag;
	}

	abs() {
		return Math.sqrt(this.norm());
	}

	arg() {
		return Math.atan2(this.imag, this.real);
	}

	polar(a, b) {
		this.real = a * Math.cos(b);
		this.imag = a * Math.sin(b);
		return this;
	}

	conj() {
		this.imag = -this.imag;
		return this;
	}

	add(other) {
		this.real += other.real;
		this.imag += other.imag;
		return this;
	}

	sub(other) {
		this.real -= other.real;
		this.imag -= other.imag;
		return this;
	}

	mul(value) {
		if (value instanceof Complex) {
			const tmp = this.real * value.real - this.imag * value.imag;
			this.imag = this.real * value.imag + this.imag * value.real;
			this.real = tmp;
			return this;
		}
		this.real *= value;
		this.imag *= value;
		return this;
	}

	div(value) {
		if (value instanceof Complex) {
			const den = value.norm();
			const tmp = (this.real * value.real + this.imag * value.imag) / den;
			this.imag = (this.imag * value.real - this.real * value.imag) / den;
			this.real = tmp;
			return this;
		}
		this.real /= value;
		this.imag /= value;
		return this;
	}
}
