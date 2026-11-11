/**
 * Renderer/Map/MapLabels.js
 *
 * Text on map cells, drawn over the scene: the display helpers' effect countdowns and WoE map marks
 * (Plugins/Helpers/VisualHelpers.js). Each layer gives [{x, y, text, color}] every frame; labels sit above their cell,
 * centred, with a dark outline. Nothing is drawn while no layer gives labels.
 *
 * @author Trojal
 */
import glMatrix from 'Utils/gl-matrix.js';
import Camera from 'Renderer/Camera.js';
import Renderer from 'Renderer/Renderer.js';
import Altitude from 'Renderer/Map/Altitude.js';

const { mat4, vec4 } = glMatrix;
const _matrix = mat4.create();
const _point = vec4.create();
const _layers = [];
let _box = null;
const _pool = [];

/** Screen pixels of a cell's centre on the ground, or null behind the camera. */
export function cellToScreen(x, y, matrix, width, height) {
	const h = Altitude.getCellHeight(x, y) || 0;
	_point[0] = x + 0.5;
	_point[1] = -h;
	_point[2] = y + 0.5;
	_point[3] = 1.0;
	vec4.transformMat4(_point, _point, matrix);
	if (_point[3] <= 0) return null;
	const w = 1.0 / _point[3];
	return [width / 2 + (_point[0] * w * width) / 2, height / 2 - (_point[1] * w * height) / 2];
}

function box() {
	if (!_box) {
		_box = document.createElement('div');
		_box.className = 'map-labels';
		_box.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:40';
		document.body.appendChild(_box);
	}
	return _box;
}

function render() {
	const labels = [];
	for (const layer of _layers) {
		try {
			labels.push(...layer());
		} catch (e) {
			console.error('[MapLabels] layer failed', e);
		}
	}
	if (!labels.length && !_box) return;
	const root = box();
	mat4.multiply(_matrix, Camera.projection, Camera.modelView);
	const width = Renderer.width;
	const height = Renderer.height;
	let n = 0;
	for (const l of labels) {
		const p = cellToScreen(l.x, l.y, _matrix, width, height);
		if (!p) continue;
		let div = _pool[n];
		if (!div) {
			div = document.createElement('div');
			div.style.cssText =
				'position:absolute;transform:translate(-50%,-150%);white-space:nowrap;font:bold 14px Arial,sans-serif;' +
				'text-shadow:-1px 0 #000,1px 0 #000,0 -1px #000,0 1px #000';
			_pool.push(div);
			root.appendChild(div);
		}
		div.style.display = '';
		div.style.left = `${Math.round(p[0])}px`;
		div.style.top = `${Math.round(p[1])}px`;
		div.style.color = l.color || '#ffe040';
		if (div.textContent !== l.text) div.textContent = l.text;
		n++;
	}
	for (let i = n; i < _pool.length; i++) _pool[i].style.display = 'none';
}

const MapLabels = {
	/** Adds a layer: () => [{x, y, text, color}]. The first layer starts the drawing. */
	addLayer(fn) {
		_layers.push(fn);
		if (_layers.length === 1) Renderer.render(render);
	}
};

export default MapLabels;
