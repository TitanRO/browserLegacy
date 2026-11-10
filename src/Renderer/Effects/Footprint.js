/**
 * Renderer/Effects/Footprint.js
 *
 * A Chase Walk footprint (EF_FOOT, EF_FOOT2): the client's foot_l / foot_r texture flat on the cell, turned the way the
 * walker went, fading out. The client leaves one on each cell a Chase Walker steps on (EntityWalk).
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import WebGL from 'Utils/WebGL.js';
import glMatrix from 'Utils/gl-matrix.js';
import Client from 'Core/Client.js';
import Altitude from 'Renderer/Map/Altitude.js';
import _vertexShader from './GroundEffect.vs?raw';
import _fragmentShader from './GroundEffect.fs?raw';

const mat4 = glMatrix.mat4;
const _matrix = mat4.create();
const _color = new Float32Array([1, 1, 1, 1]);
const _textures = { left: null, right: null };
let _program;

/** How long a print stays (ms), and how long it takes to fade at the end. */
const LIFETIME = 4000;
const FADE = 1500;

class Footprint {
	/**
	 * @param {number[]} position - the cell
	 * @param {number} startTick
	 * @param {number} direction - the walker's direction (Entity.direction: 0 south, 2 west, 4 north, 6 east)
	 * @param {boolean} left - the left foot's print
	 */
	constructor(position, startTick, direction, left) {
		this.x = Math.floor(position[0]);
		this.y = Math.floor(position[1]);
		this.position = new Int16Array([this.x, this.y, 1]);
		this.startTick = startTick;
		this.endTick = startTick + LIFETIME;
		this.left = !!left;
		this.angle = ((direction || 0) * Math.PI) / 4;
	}

	init(gl) {
		const plane = Altitude.generatePlane(this.x, this.y, 1);
		if (!plane) return;
		this.buffer = gl.createBuffer();
		this.vertCount = plane.length / 5;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(plane), gl.STATIC_DRAW);
		this.ready = true;
	}

	free(gl) {
		if (this.buffer) gl.deleteBuffer(this.buffer);
		this.ready = false;
	}

	render(gl, tick) {
		const texture = this.left ? _textures.left : _textures.right;
		if (!texture || !this.buffer) return;
		const left = this.endTick - tick;
		_color[3] = Math.max(0, Math.min(1, left / FADE));
		if (_color[3] <= 0) {
			this.needCleanUp = true;
			return;
		}
		const uniform = _program.uniform;
		const attribute = _program.attribute;
		mat4.identity(_matrix);
		mat4.rotateZ(_matrix, _matrix, this.angle);
		gl.uniformMatrix4fv(uniform.uRotationMat, false, _matrix);
		gl.uniform4fv(uniform.uSpriteRendererColor, _color);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.vertexAttribPointer(attribute.aPosition, 3, gl.FLOAT, false, 5 * 4, 0);
		gl.vertexAttribPointer(attribute.aTextureCoord, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
		gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
	}

	static init(gl) {
		_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);
		for (const side of ['left', 'right']) {
			const file = side === 'left' ? 'foot_l' : 'foot_r';
			Client.loadFile(`data/texture/effect/${file}.tga`, buffer => {
				WebGL.texture(gl, buffer, texture => {
					_textures[side] = texture;
				});
			});
		}
		this.ready = true;
	}

	static free(gl) {
		for (const side of ['left', 'right']) {
			if (_textures[side]) gl.deleteTexture(_textures[side]);
			_textures[side] = null;
		}
		if (_program) gl.deleteProgram(_program);
		_program = null;
		this.ready = false;
	}

	static beforeRender(gl, modelView, projection, fog) {
		const uniform = _program.uniform;
		const attribute = _program.attribute;
		gl.depthMask(false);
		gl.useProgram(_program);
		gl.uniformMatrix4fv(uniform.uModelViewMat, false, modelView);
		gl.uniformMatrix4fv(uniform.uProjectionMat, false, projection);
		gl.uniform1i(uniform.uFogUse, fog.use && fog.exist);
		gl.uniform1f(uniform.uFogNear, fog.near);
		gl.uniform1f(uniform.uFogFar, fog.far);
		gl.uniform3fv(uniform.uFogColor, fog.color);
		gl.activeTexture(gl.TEXTURE0);
		gl.uniform1i(uniform.uDiffuse, 0);
		gl.enableVertexAttribArray(attribute.aPosition);
		gl.enableVertexAttribArray(attribute.aTextureCoord);
	}

	static afterRender(gl) {
		gl.depthMask(true);
		gl.disableVertexAttribArray(_program.attribute.aPosition);
		gl.disableVertexAttribArray(_program.attribute.aTextureCoord);
	}
}

Footprint.renderBeforeEntities = true;
Footprint.LIFETIME = LIFETIME;

export default Footprint;
