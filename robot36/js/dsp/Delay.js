export class Delay {
	constructor(length) {
		this.length = length;
		this.buf = new Float32Array(length);
		this.pos = 0;
	}

	push(input) {
		const tmp = this.buf[this.pos];
		this.buf[this.pos] = input;
		if (++this.pos >= this.length)
			this.pos = 0;
		return tmp;
	}
}
