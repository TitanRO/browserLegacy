/**
 * Renderer/Map/GroundMarkers.js
 *
 * Coloured cells on the ground, drawn as RCX (and its open successor SimpleROHook) drew its ground overlays: a flat
 * translucent square per cell, slightly smaller than the cell so a thin gap shows the grid, following the cell's
 * corner heights, depth-tested against the map but never written to the depth buffer.
 *
 * Two kinds of cells: markers that stay until removed (a skill unit's cell, by its id), and layers that are asked
 * for their cells every frame (the chat range around the player, the cast range, a cast's target area). Who adds
 * them decides what is marked; this only draws them. Markers go when the map changes.
 *
 * @author Trojal
 */

import WebGL from 'Utils/WebGL.js';
import Altitude from 'Renderer/Map/Altitude.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';

/** The square's half size: 4.8 of the cell's 5 world units, as SimpleROHook draws its cells. */
const HALF = 0.48;

const _vertexShader = `#version 300 es
precision highp float;

in vec2 aCorner;

uniform mat4 uModelViewMat;
uniform mat4 uProjectionMat;
uniform vec2 uCell;
uniform vec4 uHeights;

void main(void) {
	// corners (-1,-1) (1,-1) (-1,1) (1,1) take the cell's four corner heights
	vec2 t = aCorner * 0.5 + 0.5;
	float h = mix(mix(uHeights.x, uHeights.y, t.x), mix(uHeights.z, uHeights.w, t.x), t.y);
	vec4 position = vec4(uCell.x + 0.5 + aCorner.x * ${HALF.toFixed(2)}, h, uCell.y + 0.5 + aCorner.y * ${HALF.toFixed(2)}, 1.0);
	gl_Position = uProjectionMat * uModelViewMat * position;
	gl_Position.z -= 0.02;
}`;

const _fragmentShader = `#version 300 es
precision highp float;

out vec4 fragColor;
uniform vec4 uColor;

void main(void) {
	fragColor = uColor;
}`;

/** uid -> {x, y, color} */
const _markers = new Map();
/** functions (tick) => [{x, y, color}] asked every frame */
const _layers = new Set();

let _program = null;
let _buffer = null;
let _gl = null;
const _heights = new Float32Array(4);

/** An RCX colour (0xAARRGGBB, a number or hex string) as [r, g, b, a] 0..1. */
export function argb(value) {
	const n = typeof value === 'string' ? parseInt(value, 16) : value;
	return [((n >>> 16) & 255) / 255, ((n >>> 8) & 255) / 255, (n & 255) / 255, ((n >>> 24) & 255) / 255];
}

function init(gl) {
	_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);
	_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	_gl = gl;
}

/** The cell's four corner heights as the ground mesh has them (bottom-left, bottom-right, top-left, top-right). */
function cellHeights(x, y) {
	const cell = Altitude.getCell(x, y);
	if (cell) {
		for (let i = 0; i < 4; ++i) _heights[i] = cell[i];
	} else {
		_heights.fill(-Altitude.getCellHeight(x + 0.5, y + 0.5));
	}
	return _heights;
}

const GroundMarkers = {
	/**
	 * Mark a cell.
	 *
	 * @param {number} uid - what the marker is for (a skill unit's id); a second add replaces the first
	 * @param {number} x - cell
	 * @param {number} y - cell
	 * @param {Array<number>} color - [r, g, b, a] 0..1
	 */
	add(uid, x, y, color) {
		_markers.set(uid, { x, y, color });
	},

	remove(uid) {
		_markers.delete(uid);
	},

	clear() {
		_markers.clear();
	},

	/** The markers now (for tests and panels). */
	list() {
		return [..._markers.entries()].map(([uid, m]) => ({ uid, ...m }));
	},

	/**
	 * Cells asked for every frame.
	 *
	 * @param {function} layer - layer(tick) => [{x, y, color}]
	 * @returns {function} call to remove the layer
	 */
	addLayer(layer) {
		_layers.add(layer);
		return () => _layers.delete(layer);
	},

	render(gl, modelView, projection, tick) {
		const cells = [];
		for (const layer of _layers) {
			try {
				const more = layer(tick);
				if (more) cells.push(...more);
			} catch (error) {
				console.error('[GroundMarkers] layer failed', error);
			}
		}
		if (!_markers.size && !cells.length) {
			return;
		}
		if (_gl !== gl || !_program) {
			init(gl);
		}

		const uniform = _program.uniform;
		const attribute = _program.attribute;

		gl.useProgram(_program);
		gl.uniformMatrix4fv(uniform.uModelViewMat, false, modelView);
		gl.uniformMatrix4fv(uniform.uProjectionMat, false, projection);

		gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
		gl.enableVertexAttribArray(attribute.aCorner);
		gl.vertexAttribPointer(attribute.aCorner, 2, gl.FLOAT, false, 2 * 4, 0);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		const draw = cell => {
			gl.uniform2f(uniform.uCell, cell.x, cell.y);
			gl.uniform4fv(uniform.uHeights, cellHeights(cell.x, cell.y));
			gl.uniform4fv(uniform.uColor, cell.color);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		};

		SpriteRenderer.runWithDepth(true, false, true, () => {
			for (const marker of _markers.values()) draw(marker);
			for (const cell of cells) draw(cell);
		});

		gl.disableVertexAttribArray(attribute.aCorner);
	},

	free(gl) {
		_markers.clear();
		if (_program && gl) {
			gl.deleteProgram(_program);
			gl.deleteBuffer(_buffer);
		}
		_program = null;
		_buffer = null;
		_gl = null;
	}
};

export default GroundMarkers;
