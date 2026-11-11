import { describe, it, expect, vi } from 'vitest';

vi.mock('Renderer/Renderer.js', () => ({ default: {} }));
const { precalcSmoothNormals } = await import('Renderer/Map/AnimatedModels.js');

// The scan the one-pass version replaces: per group and vertex, the sum of the group's faces that use the vertex.
function reference(node, flat) {
	const faces = node.faces;
	const used = [];
	for (const f of faces) if (f.smoothGroup >= 0 && f.smoothGroup < 32) used[f.smoothGroup] = true;
	const groups = [];
	for (let j = 0; j < 32; j++) {
		if (!used[j]) continue;
		const norm = new Float32Array(node.vertices.length * 3);
		groups[j] = norm;
		for (let v = 0; v < node.vertices.length; v++) {
			let x = 0, y = 0, z = 0;
			for (let f = 0; f < faces.length; f++) {
				const face = faces[f];
				if (face.smoothGroup === j && (face.vertidx[0] === v || face.vertidx[1] === v || face.vertidx[2] === v)) {
					x += flat[f * 3]; y += flat[f * 3 + 1]; z += flat[f * 3 + 2];
				}
			}
			let len = x * x + y * y + z * z;
			if (len > 0) { len = 1 / Math.sqrt(len); x *= len; y *= len; z *= len; }
			norm[v * 3] = x; norm[v * 3 + 1] = y; norm[v * 3 + 2] = z;
		}
	}
	return groups;
}

describe('AnimatedModels smooth normals', () => {
	it('match the per-vertex scan exactly, on random models with shared and repeated vertices', () => {
		let seed = 7;
		const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
		for (let m = 0; m < 20; m++) {
			const nv = 5 + Math.floor(rnd() * 60);
			const nf = 1 + Math.floor(rnd() * 120);
			const node = {
				vertices: Array.from({ length: nv }, () => [0, 0, 0]),
				faces: Array.from({ length: nf }, () => ({
					smoothGroup: Math.floor(rnd() * 5) - 1, // -1: no group
					vertidx: [0, 1, 2].map(() => Math.floor(rnd() * nv))
				}))
			};
			const flat = Float32Array.from({ length: nf * 3 }, () => rnd() * 2 - 1);
			const got = precalcSmoothNormals(node, flat);
			const want = reference(node, flat);
			expect(got.length).toBe(want.length);
			for (let j = 0; j < want.length; j++) {
				if (!want[j]) expect(got[j]).toBeUndefined();
				else expect(Array.from(got[j])).toEqual(Array.from(want[j]));
			}
		}
	});
});
