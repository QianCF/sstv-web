import { FastFourierTransform } from "./FastFourierTransform.js";
import { Complex } from "./Complex.js";
import { Filter } from "./Filter.js";
import { Hann } from "./Hann.js";

export class ShortTimeFourierTransform {
	constructor(length, overlap) {
		this.fft = new FastFourierTransform(length);
		this.prev = new Array(length * overlap);
		for (let i = 0; i < length * overlap; ++i)
			this.prev[i] = new Complex();
		this.fold = new Array(length);
		for (let i = 0; i < length; ++i)
			this.fold[i] = new Complex();
		this.freq = new Array(length);
		for (let i = 0; i < length; ++i)
			this.freq[i] = new Complex();
		this.temp = new Complex();
		this.power = new Float32Array(length);
		this.weight = new Float32Array(length * overlap);
		for (let i = 0; i < length * overlap; ++i)
			this.weight[i] = Filter.lowPass(1, length, i, length * overlap) * Hann.window(i, length * overlap);
		this.index = 0;
	}

	push(input) {
		this.prev[this.index].set(input);
		this.index = (this.index + 1) % this.prev.length;
		if (this.index % this.fold.length !== 0)
			return false;
		for (let i = 0; i < this.fold.length; ++i, this.index = (this.index + 1) % this.prev.length)
			this.fold[i].set(this.prev[this.index]).mul(this.weight[i]);
		for (let i = this.fold.length; i < this.prev.length; ++i, this.index = (this.index + 1) % this.prev.length)
			this.fold[i % this.fold.length].add(this.temp.set(this.prev[this.index]).mul(this.weight[i]));
		this.fft.forward(this.freq, this.fold);
		for (let i = 0; i < this.power.length; ++i)
			this.power[i] = this.freq[i].norm();
		return true;
	}
}
