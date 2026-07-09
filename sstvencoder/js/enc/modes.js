import { Mode } from "./Mode.js";
import { createYuv, YuvImageFormat } from "./Yuv.js";
import { colorRed, colorGreen, colorBlue } from "./ImageBitmap.js";

export class Robot36 extends Mode {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mYuv = createYuv(bitmap, YuvImageFormat.NV21);
		this.mVISCode = 8;
		this.mLumaScanSamples = this.convertMsToSamples(88.0);
		this.mChrominanceScanSamples = this.convertMsToSamples(44.0);
		this.mSyncPulseSamples = this.convertMsToSamples(9.0);
		this.mSyncPulseFrequency = 1200.0;
		this.mSyncPorchSamples = this.convertMsToSamples(3.0);
		this.mSyncPorchFrequency = 1500.0;
		this.mPorchSamples = this.convertMsToSamples(1.5);
		this.mPorchFrequency = 1900.0;
		this.mSeparatorSamples = this.convertMsToSamples(4.5);
		this.mEvenSeparatorFrequency = 1500.0;
		this.mOddSeparatorFrequency = 2300.0;
	}

	getTransmissionSamples() {
		const lineSamples = this.mSyncPulseSamples + this.mSyncPorchSamples
			+ this.mLumaScanSamples + this.mSeparatorSamples
			+ this.mPorchSamples + this.mChrominanceScanSamples;
		return this.mBitmap.height * lineSamples;
	}

	writeEncodedLine() {
		this.addSyncPulse();
		this.addSyncPorch();
		this.addYScan(this.mLine);
		if (this.mLine % 2 === 0) {
			this.addSeparator(this.mEvenSeparatorFrequency);
			this.addPorch();
			this.addVScan(this.mLine);
		} else {
			this.addSeparator(this.mOddSeparatorFrequency);
			this.addPorch();
			this.addUScan(this.mLine);
		}
	}

	addSyncPulse() { for (let i = 0; i < this.mSyncPulseSamples; ++i) this.setTone(this.mSyncPulseFrequency); }
	addSyncPorch() { for (let i = 0; i < this.mSyncPorchSamples; ++i) this.setTone(this.mSyncPorchFrequency); }
	addSeparator(f) { for (let i = 0; i < this.mSeparatorSamples; ++i) this.setTone(f); }
	addPorch() { for (let i = 0; i < this.mPorchSamples; ++i) this.setTone(this.mPorchFrequency); }
	addYScan(y) {
		for (let i = 0; i < this.mLumaScanSamples; ++i)
			this.setColorTone(this.mYuv.getY((i * this.mYuv.getWidth()) / this.mLumaScanSamples | 0, y));
	}
	addUScan(y) {
		for (let i = 0; i < this.mChrominanceScanSamples; ++i)
			this.setColorTone(this.mYuv.getU((i * this.mYuv.getWidth()) / this.mChrominanceScanSamples | 0, y));
	}
	addVScan(y) {
		for (let i = 0; i < this.mChrominanceScanSamples; ++i)
			this.setColorTone(this.mYuv.getV((i * this.mYuv.getWidth()) / this.mChrominanceScanSamples | 0, y));
	}
}

export class Robot72 extends Mode {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mYuv = createYuv(bitmap, YuvImageFormat.YUY2);
		this.mVISCode = 12;
		this.mLumaScanSamples = this.convertMsToSamples(138.0);
		this.mChrominanceScanSamples = this.convertMsToSamples(69.0);
		this.mSyncPulseSamples = this.convertMsToSamples(9.0);
		this.mSyncPulseFrequency = 1200.0;
		this.mSyncPorchSamples = this.convertMsToSamples(3.0);
		this.mSyncPorchFrequency = 1500.0;
		this.mPorchSamples = this.convertMsToSamples(1.5);
		this.mPorchFrequency = 1900.0;
		this.mSeparatorSamples = this.convertMsToSamples(4.5);
		this.mFirstSeparatorFrequency = 1500.0;
		this.mSecondSeparatorFrequency = 2300.0;
	}

	getTransmissionSamples() {
		const lineSamples = this.mSyncPulseSamples + this.mSyncPorchSamples + this.mLumaScanSamples
			+ 2 * (this.mSeparatorSamples + this.mPorchSamples + this.mChrominanceScanSamples);
		return this.mBitmap.height * lineSamples;
	}

	writeEncodedLine() {
		this.addSyncPulse();
		this.addSyncPorch();
		this.addYScan(this.mLine);
		this.addSeparator(this.mFirstSeparatorFrequency);
		this.addPorch();
		this.addVScan(this.mLine);
		this.addSeparator(this.mSecondSeparatorFrequency);
		this.addPorch();
		this.addUScan(this.mLine);
	}

	addSyncPulse() { for (let i = 0; i < this.mSyncPulseSamples; ++i) this.setTone(this.mSyncPulseFrequency); }
	addSyncPorch() { for (let i = 0; i < this.mSyncPorchSamples; ++i) this.setTone(this.mSyncPorchFrequency); }
	addSeparator(f) { for (let i = 0; i < this.mSeparatorSamples; ++i) this.setTone(f); }
	addPorch() { for (let i = 0; i < this.mPorchSamples; ++i) this.setTone(this.mPorchFrequency); }
	addYScan(y) {
		for (let i = 0; i < this.mLumaScanSamples; ++i)
			this.setColorTone(this.mYuv.getY((i * this.mYuv.getWidth()) / this.mLumaScanSamples | 0, y));
	}
	addUScan(y) {
		for (let i = 0; i < this.mChrominanceScanSamples; ++i)
			this.setColorTone(this.mYuv.getU((i * this.mYuv.getWidth()) / this.mChrominanceScanSamples | 0, y));
	}
	addVScan(y) {
		for (let i = 0; i < this.mChrominanceScanSamples; ++i)
			this.setColorTone(this.mYuv.getV((i * this.mYuv.getWidth()) / this.mChrominanceScanSamples | 0, y));
	}
}

class MartinBase extends Mode {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mSyncPulseSamples = this.convertMsToSamples(4.862);
		this.mSyncPulseFrequency = 1200.0;
		this.mSyncPorchSamples = this.convertMsToSamples(0.572);
		this.mSyncPorchFrequency = 1500.0;
		this.mSeparatorSamples = this.convertMsToSamples(0.572);
		this.mSeparatorFrequency = 1500.0;
	}

	getTransmissionSamples() {
		const lineSamples = this.mSyncPulseSamples + this.mSyncPorchSamples
			+ 3 * (this.mSeparatorSamples + this.mColorScanSamples);
		return this.mBitmap.height * lineSamples;
	}

	writeEncodedLine() {
		this.addSyncPulse();
		this.addSyncPorch();
		this.addGreenScan(this.mLine);
		this.addSeparator();
		this.addBlueScan(this.mLine);
		this.addSeparator();
		this.addRedScan(this.mLine);
		this.addSeparator();
	}

	addSyncPulse() { for (let i = 0; i < this.mSyncPulseSamples; ++i) this.setTone(this.mSyncPulseFrequency); }
	addSyncPorch() { for (let i = 0; i < this.mSyncPorchSamples; ++i) this.setTone(this.mSyncPorchFrequency); }
	addSeparator() { for (let i = 0; i < this.mSeparatorSamples; ++i) this.setTone(this.mSeparatorFrequency); }
	getColor(i, y) {
		const x = (i * this.mBitmap.width) / this.mColorScanSamples | 0;
		return this.mBitmap.getPixel(x, y);
	}
	addGreenScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorGreen(this.getColor(i, y))); }
	addBlueScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorBlue(this.getColor(i, y))); }
	addRedScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorRed(this.getColor(i, y))); }
}

export class Martin1 extends MartinBase {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mVISCode = 44;
		this.mColorScanSamples = this.convertMsToSamples(146.432);
	}
}

export class Martin2 extends MartinBase {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mVISCode = 40;
		this.mColorScanSamples = this.convertMsToSamples(73.216);
	}
}

class ScottieBase extends Mode {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mSyncPulseSamples = this.convertMsToSamples(9.0);
		this.mSyncPulseFrequency = 1200.0;
		this.mSyncPorchSamples = this.convertMsToSamples(1.5);
		this.mSyncPorchFrequency = 1500.0;
		this.mSeparatorSamples = this.convertMsToSamples(1.5);
		this.mSeparatorFrequency = 1500.0;
	}

	getTransmissionSamples() {
		const lineSamples = 2 * this.mSeparatorSamples + 3 * this.mColorScanSamples
			+ this.mSyncPulseSamples + this.mSyncPorchSamples;
		return this.mSyncPulseSamples + this.mBitmap.height * lineSamples;
	}

	writeEncodedLine() {
		if (this.mLine === 0) this.addSyncPulse();
		this.addSeparator();
		this.addGreenScan(this.mLine);
		this.addSeparator();
		this.addBlueScan(this.mLine);
		this.addSyncPulse();
		this.addSyncPorch();
		this.addRedScan(this.mLine);
	}

	addSyncPulse() { for (let i = 0; i < this.mSyncPulseSamples; ++i) this.setTone(this.mSyncPulseFrequency); }
	addSyncPorch() { for (let i = 0; i < this.mSyncPorchSamples; ++i) this.setTone(this.mSyncPorchFrequency); }
	addSeparator() { for (let i = 0; i < this.mSeparatorSamples; ++i) this.setTone(this.mSeparatorFrequency); }
	getColor(i, y) {
		const x = (i * this.mBitmap.width) / this.mColorScanSamples | 0;
		return this.mBitmap.getPixel(x, y);
	}
	addGreenScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorGreen(this.getColor(i, y))); }
	addBlueScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorBlue(this.getColor(i, y))); }
	addRedScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorRed(this.getColor(i, y))); }
}

export class Scottie1 extends ScottieBase {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mVISCode = 60;
		this.mColorScanSamples = this.convertMsToSamples(138.24);
	}
}

export class Scottie2 extends ScottieBase {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mVISCode = 56;
		this.mColorScanSamples = this.convertMsToSamples(88.064);
	}
}

export class ScottieDX extends ScottieBase {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mVISCode = 76;
		this.mColorScanSamples = this.convertMsToSamples(345.6);
	}
}

class PDBase extends Mode {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mYuv = createYuv(bitmap, YuvImageFormat.YUV440P);
		this.mSyncPulseSamples = this.convertMsToSamples(20.0);
		this.mSyncPulseFrequency = 1200.0;
		this.mPorchSamples = this.convertMsToSamples(2.08);
		this.mPorchFrequency = 1500.0;
	}

	getProcessCount() { return this.mBitmap.height / 2; }

	getTransmissionSamples() {
		const lineSamples = this.mSyncPulseSamples + this.mPorchSamples + 4 * this.mColorScanSamples;
		return (this.mBitmap.height / 2) * lineSamples;
	}

	writeEncodedLine() {
		this.addSyncPulse();
		this.addPorch();
		this.addYScan(this.mLine);
		this.addVScan(this.mLine);
		this.addUScan(this.mLine);
		this.addYScan(++this.mLine);
	}

	addSyncPulse() { for (let i = 0; i < this.mSyncPulseSamples; ++i) this.setTone(this.mSyncPulseFrequency); }
	addPorch() { for (let i = 0; i < this.mPorchSamples; ++i) this.setTone(this.mPorchFrequency); }
	addYScan(y) {
		for (let i = 0; i < this.mColorScanSamples; ++i)
			this.setColorTone(this.mYuv.getY((i * this.mYuv.getWidth()) / this.mColorScanSamples | 0, y));
	}
	addUScan(y) {
		for (let i = 0; i < this.mColorScanSamples; ++i)
			this.setColorTone(this.mYuv.getU((i * this.mYuv.getWidth()) / this.mColorScanSamples | 0, y));
	}
	addVScan(y) {
		for (let i = 0; i < this.mColorScanSamples; ++i)
			this.setColorTone(this.mYuv.getV((i * this.mYuv.getWidth()) / this.mColorScanSamples | 0, y));
	}
}

export class PD50 extends PDBase {
	constructor(b, o) { super(b, o); this.mVISCode = 93; this.mColorScanSamples = this.convertMsToSamples(91.52); }
}
export class PD90 extends PDBase {
	constructor(b, o) { super(b, o); this.mVISCode = 99; this.mColorScanSamples = this.convertMsToSamples(170.24); }
}
export class PD120 extends PDBase {
	constructor(b, o) { super(b, o); this.mVISCode = 95; this.mColorScanSamples = this.convertMsToSamples(121.6); }
}
export class PD160 extends PDBase {
	constructor(b, o) { super(b, o); this.mVISCode = 98; this.mColorScanSamples = this.convertMsToSamples(195.584); }
}
export class PD180 extends PDBase {
	constructor(b, o) { super(b, o); this.mVISCode = 96; this.mColorScanSamples = this.convertMsToSamples(183.04); }
}
export class PD240 extends PDBase {
	constructor(b, o) { super(b, o); this.mVISCode = 97; this.mColorScanSamples = this.convertMsToSamples(244.48); }
}
export class PD290 extends PDBase {
	constructor(b, o) { super(b, o); this.mVISCode = 94; this.mColorScanSamples = this.convertMsToSamples(228.8); }
}

export class Wraase extends Mode {
	constructor(bitmap, output) {
		super(bitmap, output);
		this.mVISCode = 55;
		this.mColorScanSamples = this.convertMsToSamples(235.0);
		this.mSyncPulseSamples = this.convertMsToSamples(5.5225);
		this.mSyncPulseFrequency = 1200.0;
		this.mPorchSamples = this.convertMsToSamples(0.5);
		this.mPorchFrequency = 1500.0;
	}

	getTransmissionSamples() {
		const lineSamples = this.mSyncPulseSamples + this.mPorchSamples + 3 * this.mColorScanSamples;
		return this.mBitmap.height * lineSamples;
	}

	writeEncodedLine() {
		this.addSyncPulse();
		this.addPorch();
		this.addRedScan(this.mLine);
		this.addGreenScan(this.mLine);
		this.addBlueScan(this.mLine);
	}

	addSyncPulse() { for (let i = 0; i < this.mSyncPulseSamples; ++i) this.setTone(this.mSyncPulseFrequency); }
	addPorch() { for (let i = 0; i < this.mPorchSamples; ++i) this.setTone(this.mPorchFrequency); }
	getColor(i, y) {
		const x = (i * this.mBitmap.width) / this.mColorScanSamples | 0;
		return this.mBitmap.getPixel(x, y);
	}
	addRedScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorRed(this.getColor(i, y))); }
	addGreenScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorGreen(this.getColor(i, y))); }
	addBlueScan(y) { for (let i = 0; i < this.mColorScanSamples; ++i) this.setColorTone(colorBlue(this.getColor(i, y))); }
}
