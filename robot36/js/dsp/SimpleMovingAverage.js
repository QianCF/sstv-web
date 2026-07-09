import { SimpleMovingSum } from "./SimpleMovingSum.js";

export class SimpleMovingAverage extends SimpleMovingSum {
	constructor(length) {
		super(length);
	}

	avg(input) {
		return this.sum(input) / this.length;
	}
}
