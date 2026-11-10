/**
 * Renderer/Map/GroundMarkers.js
 *
 * Bright cell outlines on the ground (TitanRO's trap and ground-skill markers): a marker is a cell with a colour,
 * drawn as a filled square with a strong border, over the ground and its effects, whatever the effect settings
 * (/effect off or low effects) hide. Who adds markers decides what is marked; this only draws them. They go when the
 * map changes.
 *
 * @author Trojal
 */

import WebGL from 'Utils/WebGL.js';
import Altitude from 'Renderer/Map/Altitude.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';

const _vertexShader = `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUv;

uniform mat4 uModelViewMat;
uniform mat4 uProjectionMat;
uniform vec3 uPosition;

void main(void) {
	vec4 position = vec4(uPosition.x + aPosition.x, -uPosition.z, uPosition.y + aPosition.y, 1.0);
	gl_Position = uProjectionMat * uModelViewMat * position;
	gl_Position.z -= 0.02;
	vUv = aPosition;
}`;

const _fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec4 uColor;
uniform float uPulse;

void main(void) {
	// distance to the cell's edge, 0 .. 0.5
	float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
	float border = 1.0 - smoothstep(0.06, 0.1, edge);
	float alpha = mix(0.22, 0.95, border) * uPulse;
	fragColor = vec4(mix(uColor.rgb, vec3(1.0), border * 0.15), alpha * uColor.a);
}`;

/** uid -> {x, y, color} */
const _markers = new Map();

let _program = null;
let _buffer = null;
let _gl = null;
const _position = new Float32Array(3);

function init(gl) {
	_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);
	_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
	// a unit square (0..1) as two triangles
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0]), gl.STATIC_DRAW);
	_gl = gl;
}

const GroundMarkers = {
	/**
	 * Mark a cell.
	 *
	 * @param {number} uid - what the marker is for (a skill unit's id); a second add replaces the first
	 * @param {number} x - cell
	 * @param {number} y - cell
	 * @param {Array<number>} color - [r, g, b] 0..1
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
	 * Draw the markers: depth tested (walls and props hide them as they hide the ground), not depth written, blended.
	 */
	render(gl, modelView, projection, tick) {
		if (!_markers.size) {
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
		// a slow pulse, so markers stand out from ground effects of the same colour
		gl.uniform1f(uniform.uPulse, 0.8 + 0.2 * Math.sin((tick || 0) / 250));

		gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
		gl.enableVertexAttribArray(attribute.aPosition);
		gl.vertexAttribPointer(attribute.aPosition, 2, gl.FLOAT, false, 2 * 4, 0);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		SpriteRenderer.runWithDepth(true, false, true, () => {
			for (const marker of _markers.values()) {
				_position[0] = marker.x;
				_position[1] = marker.y;
				_position[2] = Altitude.getCellHeight(marker.x + 0.5, marker.y + 0.5);
				gl.uniform3fv(uniform.uPosition, _position);
				gl.uniform4f(uniform.uColor, marker.color[0], marker.color[1], marker.color[2], 1);
				gl.drawArrays(gl.TRIANGLES, 0, 6);
			}
		});

		gl.disableVertexAttribArray(attribute.aPosition);
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
