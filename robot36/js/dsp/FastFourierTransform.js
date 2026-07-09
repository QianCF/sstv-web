import { Complex } from "./Complex.js";

export class FastFourierTransform {
	constructor(length) {
		let rest = length;
		while (rest > 1) {
			if (rest % 2 === 0)
				rest /= 2;
			else if (rest % 3 === 0)
				rest /= 3;
			else if (rest % 5 === 0)
				rest /= 5;
			else if (rest % 7 === 0)
				rest /= 7;
			else
				break;
		}
		if (rest !== 1)
			throw new Error("Transform length must be a composite of 2, 3, 5 and 7, but was: " + length);
		this.tf = new Array(length);
		for (let i = 0; i < length; ++i) {
			const x = -(2.0 * Math.PI * i) / length;
			const a = Math.cos(x);
			const b = Math.sin(x);
			this.tf[i] = new Complex(a, b);
		}
		this.tmpA = new Complex();
		this.tmpB = new Complex();
		this.tmpC = new Complex();
		this.tmpD = new Complex();
		this.tmpE = new Complex();
		this.tmpF = new Complex();
		this.tmpG = new Complex();
		this.tmpH = new Complex();
		this.tmpI = new Complex();
		this.tmpJ = new Complex();
		this.tmpK = new Complex();
		this.tmpL = new Complex();
		this.tmpM = new Complex();
		this.tin0 = new Complex();
		this.tin1 = new Complex();
		this.tin2 = new Complex();
		this.tin3 = new Complex();
		this.tin4 = new Complex();
		this.tin5 = new Complex();
		this.tin6 = new Complex();
	}

	isPowerOfTwo(n) {
		return n > 0 && (n & (n - 1)) === 0;
	}

	isPowerOfFour(n) {
		return this.isPowerOfTwo(n) && (n & 0x55555555) !== 0;
	}

	cos(n, N) {
		return Math.cos(n * 2.0 * Math.PI / N);
	}

	sin(n, N) {
		return Math.sin(n * 2.0 * Math.PI / N);
	}

	dft2(out0, out1, in0, in1) {
		out0.set(in0).add(in1);
		out1.set(in0).sub(in1);
	}

	radix2(out, inp, O, I, N, S, F) {
		if (N === 2) {
			this.dft2(out[O], out[O + 1], inp[I], inp[I + S]);
		} else {
			const Q = N / 2;
			this.dit(out, inp, O, I, Q, 2 * S, F);
			this.dit(out, inp, O + Q, I + S, Q, 2 * S, F);
			for (let k0 = O, k1 = O + Q, l1 = 0; k0 < O + Q; ++k0, ++k1, l1 += S) {
				this.tin1.set(this.tf[l1]);
				if (!F)
					this.tin1.conj();
				this.tin0.set(out[k0]);
				this.tin1.mul(out[k1]);
				this.dft2(out[k0], out[k1], this.tin0, this.tin1);
			}
		}
	}

	fwd3(out0, out1, out2, in0, in1, in2) {
		this.tmpA.set(in1).add(in2);
		this.tmpB.set(in1.imag - in2.imag, in2.real - in1.real);
		this.tmpC.set(this.tmpA).mul(this.cos(1, 3));
		this.tmpD.set(this.tmpB).mul(this.sin(1, 3));
		out0.set(in0).add(this.tmpA);
		out1.set(in0).add(this.tmpC).add(this.tmpD);
		out2.set(in0).add(this.tmpC).sub(this.tmpD);
	}

	radix3(out, inp, O, I, N, S, F) {
		if (N === 3) {
			if (F)
				this.fwd3(out[O], out[O + 1], out[O + 2], inp[I], inp[I + S], inp[I + 2 * S]);
			else
				this.fwd3(out[O], out[O + 2], out[O + 1], inp[I], inp[I + S], inp[I + 2 * S]);
		} else {
			const Q = N / 3;
			this.dit(out, inp, O, I, Q, 3 * S, F);
			this.dit(out, inp, O + Q, I + S, Q, 3 * S, F);
			this.dit(out, inp, O + 2 * Q, I + 2 * S, Q, 3 * S, F);
			for (let k0 = O, k1 = O + Q, k2 = O + 2 * Q, l1 = 0, l2 = 0; k0 < O + Q; ++k0, ++k1, ++k2, l1 += S, l2 += 2 * S) {
				this.tin1.set(this.tf[l1]);
				this.tin2.set(this.tf[l2]);
				if (!F) {
					this.tin1.conj();
					this.tin2.conj();
				}
				this.tin0.set(out[k0]);
				this.tin1.mul(out[k1]);
				this.tin2.mul(out[k2]);
				if (F)
					this.fwd3(out[k0], out[k1], out[k2], this.tin0, this.tin1, this.tin2);
				else
					this.fwd3(out[k0], out[k2], out[k1], this.tin0, this.tin1, this.tin2);
			}
		}
	}

	fwd4(out0, out1, out2, out3, in0, in1, in2, in3) {
		this.tmpA.set(in0).add(in2);
		this.tmpB.set(in0).sub(in2);
		this.tmpC.set(in1).add(in3);
		this.tmpD.set(in1.imag - in3.imag, in3.real - in1.real);
		out0.set(this.tmpA).add(this.tmpC);
		out1.set(this.tmpB).add(this.tmpD);
		out2.set(this.tmpA).sub(this.tmpC);
		out3.set(this.tmpB).sub(this.tmpD);
	}

	radix4(out, inp, O, I, N, S, F) {
		if (N === 4) {
			if (F)
				this.fwd4(out[O], out[O + 1], out[O + 2], out[O + 3], inp[I], inp[I + S], inp[I + 2 * S], inp[I + 3 * S]);
			else
				this.fwd4(out[O], out[O + 3], out[O + 2], out[O + 1], inp[I], inp[I + S], inp[I + 2 * S], inp[I + 3 * S]);
		} else {
			const Q = N / 4;
			this.radix4(out, inp, O, I, Q, 4 * S, F);
			this.radix4(out, inp, O + Q, I + S, Q, 4 * S, F);
			this.radix4(out, inp, O + 2 * Q, I + 2 * S, Q, 4 * S, F);
			this.radix4(out, inp, O + 3 * Q, I + 3 * S, Q, 4 * S, F);
			for (let k0 = O, k1 = O + Q, k2 = O + 2 * Q, k3 = O + 3 * Q, l1 = 0, l2 = 0, l3 = 0; k0 < O + Q; ++k0, ++k1, ++k2, ++k3, l1 += S, l2 += 2 * S, l3 += 3 * S) {
				this.tin1.set(this.tf[l1]);
				this.tin2.set(this.tf[l2]);
				this.tin3.set(this.tf[l3]);
				if (!F) {
					this.tin1.conj();
					this.tin2.conj();
					this.tin3.conj();
				}
				this.tin0.set(out[k0]);
				this.tin1.mul(out[k1]);
				this.tin2.mul(out[k2]);
				this.tin3.mul(out[k3]);
				if (F)
					this.fwd4(out[k0], out[k1], out[k2], out[k3], this.tin0, this.tin1, this.tin2, this.tin3);
				else
					this.fwd4(out[k0], out[k3], out[k2], out[k1], this.tin0, this.tin1, this.tin2, this.tin3);
			}
		}
	}

	fwd5(out0, out1, out2, out3, out4, in0, in1, in2, in3, in4) {
		this.tmpA.set(in1).add(in4);
		this.tmpB.set(in2).add(in3);
		this.tmpC.set(in1.imag - in4.imag, in4.real - in1.real);
		this.tmpD.set(in2.imag - in3.imag, in3.real - in2.real);
		this.tmpF.set(this.tmpA).mul(this.cos(1, 5)).add(this.tmpE.set(this.tmpB).mul(this.cos(2, 5)));
		this.tmpG.set(this.tmpC).mul(this.sin(1, 5)).add(this.tmpE.set(this.tmpD).mul(this.sin(2, 5)));
		this.tmpH.set(this.tmpA).mul(this.cos(2, 5)).add(this.tmpE.set(this.tmpB).mul(this.cos(1, 5)));
		this.tmpI.set(this.tmpC).mul(this.sin(2, 5)).sub(this.tmpE.set(this.tmpD).mul(this.sin(1, 5)));
		out0.set(in0).add(this.tmpA).add(this.tmpB);
		out1.set(in0).add(this.tmpF).add(this.tmpG);
		out2.set(in0).add(this.tmpH).add(this.tmpI);
		out3.set(in0).add(this.tmpH).sub(this.tmpI);
		out4.set(in0).add(this.tmpF).sub(this.tmpG);
	}

	radix5(out, inp, O, I, N, S, F) {
		if (N === 5) {
			if (F)
				this.fwd5(out[O], out[O + 1], out[O + 2], out[O + 3], out[O + 4], inp[I], inp[I + S], inp[I + 2 * S], inp[I + 3 * S], inp[I + 4 * S]);
			else
				this.fwd5(out[O], out[O + 4], out[O + 3], out[O + 2], out[O + 1], inp[I], inp[I + S], inp[I + 2 * S], inp[I + 3 * S], inp[I + 4 * S]);
		} else {
			const Q = N / 5;
			this.dit(out, inp, O, I, Q, 5 * S, F);
			this.dit(out, inp, O + Q, I + S, Q, 5 * S, F);
			this.dit(out, inp, O + 2 * Q, I + 2 * S, Q, 5 * S, F);
			this.dit(out, inp, O + 3 * Q, I + 3 * S, Q, 5 * S, F);
			this.dit(out, inp, O + 4 * Q, I + 4 * S, Q, 5 * S, F);
			for (let k0 = O, k1 = O + Q, k2 = O + 2 * Q, k3 = O + 3 * Q, k4 = O + 4 * Q, l1 = 0, l2 = 0, l3 = 0, l4 = 0; k0 < O + Q; ++k0, ++k1, ++k2, ++k3, ++k4, l1 += S, l2 += 2 * S, l3 += 3 * S, l4 += 4 * S) {
				this.tin1.set(this.tf[l1]);
				this.tin2.set(this.tf[l2]);
				this.tin3.set(this.tf[l3]);
				this.tin4.set(this.tf[l4]);
				if (!F) {
					this.tin1.conj();
					this.tin2.conj();
					this.tin3.conj();
					this.tin4.conj();
				}
				this.tin0.set(out[k0]);
				this.tin1.mul(out[k1]);
				this.tin2.mul(out[k2]);
				this.tin3.mul(out[k3]);
				this.tin4.mul(out[k4]);
				if (F)
					this.fwd5(out[k0], out[k1], out[k2], out[k3], out[k4], this.tin0, this.tin1, this.tin2, this.tin3, this.tin4);
				else
					this.fwd5(out[k0], out[k4], out[k3], out[k2], out[k1], this.tin0, this.tin1, this.tin2, this.tin3, this.tin4);
			}
		}
	}

	fwd7(out0, out1, out2, out3, out4, out5, out6, in0, in1, in2, in3, in4, in5, in6) {
		this.tmpA.set(in1).add(in6);
		this.tmpB.set(in2).add(in5);
		this.tmpC.set(in3).add(in4);
		this.tmpD.set(in1.imag - in6.imag, in6.real - in1.real);
		this.tmpE.set(in2.imag - in5.imag, in5.real - in2.real);
		this.tmpF.set(in3.imag - in4.imag, in4.real - in3.real);
		this.tmpH.set(this.tmpA).mul(this.cos(1, 7)).add(this.tmpG.set(this.tmpB).mul(this.cos(2, 7))).add(this.tmpG.set(this.tmpC).mul(this.cos(3, 7)));
		this.tmpI.set(this.tmpD).mul(this.sin(1, 7)).add(this.tmpG.set(this.tmpE).mul(this.sin(2, 7))).add(this.tmpG.set(this.tmpF).mul(this.sin(3, 7)));
		this.tmpJ.set(this.tmpA).mul(this.cos(2, 7)).add(this.tmpG.set(this.tmpB).mul(this.cos(3, 7))).add(this.tmpG.set(this.tmpC).mul(this.cos(1, 7)));
		this.tmpK.set(this.tmpD).mul(this.sin(2, 7)).sub(this.tmpG.set(this.tmpE).mul(this.sin(3, 7))).sub(this.tmpG.set(this.tmpF).mul(this.sin(1, 7)));
		this.tmpL.set(this.tmpA).mul(this.cos(3, 7)).add(this.tmpG.set(this.tmpB).mul(this.cos(1, 7))).add(this.tmpG.set(this.tmpC).mul(this.cos(2, 7)));
		this.tmpM.set(this.tmpD).mul(this.sin(3, 7)).sub(this.tmpG.set(this.tmpE).mul(this.sin(1, 7))).add(this.tmpG.set(this.tmpF).mul(this.sin(2, 7)));
		out0.set(in0).add(this.tmpA).add(this.tmpB).add(this.tmpC);
		out1.set(in0).add(this.tmpH).add(this.tmpI);
		out2.set(in0).add(this.tmpJ).add(this.tmpK);
		out3.set(in0).add(this.tmpL).add(this.tmpM);
		out4.set(in0).add(this.tmpL).sub(this.tmpM);
		out5.set(in0).add(this.tmpJ).sub(this.tmpK);
		out6.set(in0).add(this.tmpH).sub(this.tmpI);
	}

	radix7(out, inp, O, I, N, S, F) {
		if (N === 7) {
			if (F)
				this.fwd7(out[O], out[O + 1], out[O + 2], out[O + 3], out[O + 4], out[O + 5], out[O + 6], inp[I], inp[I + S], inp[I + 2 * S], inp[I + 3 * S], inp[I + 4 * S], inp[I + 5 * S], inp[I + 6 * S]);
			else
				this.fwd7(out[O], out[O + 6], out[O + 5], out[O + 4], out[O + 3], out[O + 2], out[O + 1], inp[I], inp[I + S], inp[I + 2 * S], inp[I + 3 * S], inp[I + 4 * S], inp[I + 5 * S], inp[I + 6 * S]);
		} else {
			const Q = N / 7;
			this.dit(out, inp, O, I, Q, 7 * S, F);
			this.dit(out, inp, O + Q, I + S, Q, 7 * S, F);
			this.dit(out, inp, O + 2 * Q, I + 2 * S, Q, 7 * S, F);
			this.dit(out, inp, O + 3 * Q, I + 3 * S, Q, 7 * S, F);
			this.dit(out, inp, O + 4 * Q, I + 4 * S, Q, 7 * S, F);
			this.dit(out, inp, O + 5 * Q, I + 5 * S, Q, 7 * S, F);
			this.dit(out, inp, O + 6 * Q, I + 6 * S, Q, 7 * S, F);
			for (let k0 = O, k1 = O + Q, k2 = O + 2 * Q, k3 = O + 3 * Q, k4 = O + 4 * Q, k5 = O + 5 * Q, k6 = O + 6 * Q, l1 = 0, l2 = 0, l3 = 0, l4 = 0, l5 = 0, l6 = 0; k0 < O + Q; ++k0, ++k1, ++k2, ++k3, ++k4, ++k5, ++k6, l1 += S, l2 += 2 * S, l3 += 3 * S, l4 += 4 * S, l5 += 5 * S, l6 += 6 * S) {
				this.tin1.set(this.tf[l1]);
				this.tin2.set(this.tf[l2]);
				this.tin3.set(this.tf[l3]);
				this.tin4.set(this.tf[l4]);
				this.tin5.set(this.tf[l5]);
				this.tin6.set(this.tf[l6]);
				if (!F) {
					this.tin1.conj();
					this.tin2.conj();
					this.tin3.conj();
					this.tin4.conj();
					this.tin5.conj();
					this.tin6.conj();
				}
				this.tin0.set(out[k0]);
				this.tin1.mul(out[k1]);
				this.tin2.mul(out[k2]);
				this.tin3.mul(out[k3]);
				this.tin4.mul(out[k4]);
				this.tin5.mul(out[k5]);
				this.tin6.mul(out[k6]);
				if (F)
					this.fwd7(out[k0], out[k1], out[k2], out[k3], out[k4], out[k5], out[k6], this.tin0, this.tin1, this.tin2, this.tin3, this.tin4, this.tin5, this.tin6);
				else
					this.fwd7(out[k0], out[k6], out[k5], out[k4], out[k3], out[k2], out[k1], this.tin0, this.tin1, this.tin2, this.tin3, this.tin4, this.tin5, this.tin6);
			}
		}
	}

	dit(out, inp, O, I, N, S, F) {
		if (N === 1)
			out[O].set(inp[I]);
		else if (this.isPowerOfFour(N))
			this.radix4(out, inp, O, I, N, S, F);
		else if (N % 7 === 0)
			this.radix7(out, inp, O, I, N, S, F);
		else if (N % 5 === 0)
			this.radix5(out, inp, O, I, N, S, F);
		else if (N % 3 === 0)
			this.radix3(out, inp, O, I, N, S, F);
		else if (N % 2 === 0)
			this.radix2(out, inp, O, I, N, S, F);
	}

	forward(out, inp) {
		if (inp.length !== this.tf.length)
			throw new Error("Input array length (" + inp.length + ") must be equal to Transform length (" + this.tf.length + ")");
		if (out.length !== this.tf.length)
			throw new Error("Output array length (" + out.length + ") must be equal to Transform length (" + this.tf.length + ")");
		this.dit(out, inp, 0, 0, this.tf.length, 1, true);
	}

	backward(out, inp) {
		if (inp.length !== this.tf.length)
			throw new Error("Input array length (" + inp.length + ") must be equal to Transform length (" + this.tf.length + ")");
		if (out.length !== this.tf.length)
			throw new Error("Output array length (" + out.length + ") must be equal to Transform length (" + this.tf.length + ")");
		this.dit(out, inp, 0, 0, this.tf.length, 1, false);
	}
}
