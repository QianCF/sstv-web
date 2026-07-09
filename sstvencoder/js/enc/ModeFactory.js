import {
	Robot36, Robot72,
	Martin1, Martin2,
	Scottie1, Scottie2, ScottieDX,
	PD50, PD90, PD120, PD160, PD180, PD240, PD290,
	Wraase,
} from "./modes.js";

export const MODE_LIST = [
	{ id: "Martin1", name: "Martin 1", width: 320, height: 256, Class: Martin1 },
	{ id: "Martin2", name: "Martin 2", width: 320, height: 256, Class: Martin2 },
	{ id: "PD50", name: "PD 50", width: 320, height: 256, Class: PD50 },
	{ id: "PD90", name: "PD 90", width: 320, height: 256, Class: PD90 },
	{ id: "PD120", name: "PD 120", width: 640, height: 496, Class: PD120 },
	{ id: "PD160", name: "PD 160", width: 512, height: 400, Class: PD160 },
	{ id: "PD180", name: "PD 180", width: 640, height: 496, Class: PD180 },
	{ id: "PD240", name: "PD 240", width: 640, height: 496, Class: PD240 },
	{ id: "PD290", name: "PD 290", width: 800, height: 616, Class: PD290 },
	{ id: "Scottie1", name: "Scottie 1", width: 320, height: 256, Class: Scottie1 },
	{ id: "Scottie2", name: "Scottie 2", width: 320, height: 256, Class: Scottie2 },
	{ id: "ScottieDX", name: "Scottie DX", width: 320, height: 256, Class: ScottieDX },
	{ id: "Robot36", name: "Robot 36", width: 320, height: 240, Class: Robot36 },
	{ id: "Robot72", name: "Robot 72", width: 320, height: 240, Class: Robot72 },
	{ id: "Wraase", name: "Wraase SC2 180", width: 320, height: 256, Class: Wraase },
];

const MODE_MAP = Object.fromEntries(MODE_LIST.map((m) => [m.id, m]));

export function getDefaultModeId() {
	return "Robot36";
}

export function getModeInfo(id) {
	return MODE_MAP[id] ?? MODE_MAP[getDefaultModeId()];
}

export function createMode(id, bitmap, output) {
	const info = getModeInfo(id);
	if (bitmap.width !== info.width || bitmap.height !== info.height)
		return null;
	return new info.Class(bitmap, output);
}
