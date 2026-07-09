export class SimpleMovingSum {
	constructor(length) {
		this.length = length;
		this.tree = new Float32Array(2 * length);
		this.leaf = length;
	}

	add(input) {
		this.tree[this.leaf] = input;
		for (let child = this.leaf, parent = Math.floor(this.leaf / 2); parent > 0; child = parent, parent = Math.floor(parent / 2))
			this.tree[parent] = this.tree[child] + this.tree[child ^ 1];
		if (++this.leaf >= this.tree.length)
			this.leaf = this.length;
	}

	sum() {
		return this.tree[1];
	}

	sum(input) {
		if (input !== undefined) {
			this.add(input);
			return this.sum();
		}
		return this.tree[1];
	}
}
