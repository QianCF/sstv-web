export class SchmittTrigger {
	constructor(low, high) {
		this.low = low;
		this.high = high;
		this.previous = false;
	}

	latch(input) {
		if (this.previous) {
			if (input < this.low)
				this.previous = false;
		} else {
			if (input > this.high)
				this.previous = true;
		}
		return this.previous;
	}
}
