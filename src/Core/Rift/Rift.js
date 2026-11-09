/**
 * Core/Rift/Rift.js
 *
 * Rifts: maps the server generates from a name (g<library version><recipe><seed>, TitanRO/genmap). The client builds
 * a rift's .rsw, .gnd, .gat and minimap from that name and its pieces' source maps, with the Windows client DLL's own
 * builder compiled to WebAssembly (riftWasm.js: TitanRO/client dlls/rift-wasm, the same generator commit as the map
 * server's genmap plugin, so the cells match the server's). Nothing is fetched for a rift: FileManager.get answers its
 * files here, and DBManager names it ("Rift: Culvert") from its tileset.
 *
 * Used in the file worker (the files) and on the main thread (the names); each loads its own instance.
 */

import { RIFT_WASM } from './riftWasm.js';

/** A rift's file in a path: data\<name>.rsw/.gnd/.gat, or its minimap ...\map\<name>.bmp */
const FILE = /(?:^|[\\/])(g[0-9a-z]{2}[0-9a-f]{8})\.(rsw|gnd|gat|bmp)$/i;
const NAME = /^(g[0-9a-z]{2}[0-9a-f]{8})(?:\.(?:rsw|gat|gnd))?$/i;
const MINIMAP_DIR = 'data\\texture\\유저인터페이스\\map\\'; // data\texture\유저인터페이스\map\
const KEEP = 2; // built rifts kept (a field rift's .gnd is several MB)

let _exports = null;
let _ready = null;
const _plans = new Map();
const _built = new Map(); // name -> Promise<{rsw, gnd, gat, bmp}|null>

function decode(b64) {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) {
		bytes[i] = bin.charCodeAt(i);
	}
	return bytes;
}

/**
 * Loads the builder (once); resolves when it can be used.
 * @return {Promise<boolean>}
 */
function ready() {
	if (!_ready) {
		_ready = WebAssembly.instantiate(decode(RIFT_WASM), {})
			.then(r => {
				_exports = r.instance.exports;
				return true;
			})
			.catch(e => {
				console.error('[Rift] builder not loaded:', e);
				return false;
			});
	}
	return _ready;
}

function put(bytes) {
	const p = _exports.rw_alloc(bytes.length);
	new Uint8Array(_exports.memory.buffer, p, bytes.length).set(bytes);
	return [p, bytes.length];
}

function out() {
	return new TextDecoder().decode(new Uint8Array(_exports.memory.buffer, _exports.rw_out(), _exports.rw_out_len()));
}

/**
 * The plan of rift `name` ({tileset, grid, arrive, maps}), or null if it isn't one this client builds (or the builder
 * hasn't loaded yet).
 * @param {string} name - g<version><recipe><seed>, with or without .rsw/.gat
 * @return {object|null}
 */
function plan(name) {
	const m = NAME.exec(name || '');
	if (!m || !_exports) {
		return null;
	}
	const key = m[1].toLowerCase();
	if (!_plans.has(key)) {
		const [p, n] = put(new TextEncoder().encode(key));
		_plans.set(key, _exports.rw_plan(p, n) ? JSON.parse(out()) : null);
		_exports.rw_free(p, n);
	}
	return _plans.get(key);
}

/**
 * The map table entry of rift `name` (as DBManager keeps them from mapInfo), or null if it isn't one.
 * @param {string} name
 * @return {object|null}
 */
function mapInfo(name) {
	const p = plan(name);
	if (!p) {
		return null;
	}
	return {
		displayName: `Rift: ${p.tileset}`,
		notifyEnter: true,
		signName: { subTitle: 'Rift', mainTitle: p.tileset },
		backgroundBmp: p.grid ? 'field' : 'dungeon'
	};
}

function read(get, path) {
	return new Promise(resolve => {
		get(path, (buffer, error) => resolve(!error && buffer && buffer.byteLength ? new Uint8Array(buffer) : null));
	});
}

async function build(name, get) {
	if (!(await ready())) {
		return null;
	}
	const p = plan(name);
	if (!p) {
		return null;
	}
	const started = performance.now();
	const sources = await Promise.all(
		p.maps.map(async m => [
			m,
			await Promise.all([
				read(get, `data\\${m}.rsw`),
				read(get, `data\\${m}.gnd`),
				read(get, `data\\${m}.gat`),
				read(get, `${MINIMAP_DIR}${m}.bmp`)
			])
		])
	);
	const [np, nl] = put(new TextEncoder().encode(name));
	for (const [m, files] of sources) {
		if (!files[0] || !files[1] || !files[2]) {
			console.error(`[Rift] ${name} needs ${m}, which this client can't read`);
			_exports.rw_free(np, nl);
			return null;
		}
		const [mp, ml] = put(new TextEncoder().encode(m));
		files.forEach((bytes, kind) => {
			if (bytes) {
				const [fp, fl] = put(bytes);
				_exports.rw_source(mp, ml, kind, fp, fl);
				_exports.rw_free(fp, fl);
			}
		});
		_exports.rw_free(mp, ml);
	}
	const ok = _exports.rw_build(np, nl);
	_exports.rw_free(np, nl);
	if (!ok) {
		console.error(`[Rift] ${out()}`);
		_exports.rw_clear();
		return null;
	}
	const file = kind =>
		new Uint8Array(_exports.memory.buffer, _exports.rw_file(kind), _exports.rw_file_len(kind)).slice().buffer;
	const files = { rsw: file(0), gnd: file(1), gat: file(2), bmp: file(3) };
	console.log(`[Rift] built ${name}: ${out()}; ${Math.round(performance.now() - started)} ms`);
	_exports.rw_clear();
	return files;
}

/**
 * Answers a rift's file: calls `callback(buffer)` (or `callback(null, error)`) and returns true if `filename` is one,
 * else returns false and the caller reads the file as usual. The rift is built once from its source maps, read with
 * `get` (FileManager.get).
 * @param {string} filename
 * @param {function} get - (filename, callback(buffer, error))
 * @param {function} callback
 * @return {boolean}
 */
function serve(filename, get, callback) {
	const m = FILE.exec(filename);
	if (!m) {
		return false;
	}
	const name = m[1].toLowerCase();
	const ext = m[2].toLowerCase();
	let files = _built.get(name);
	if (!files) {
		files = build(name, get);
		_built.set(name, files);
		while (_built.size > KEEP) {
			_built.delete(_built.keys().next().value);
		}
	}
	files.then(
		f => {
			if (f) {
				callback(f[ext].slice(0));
				return;
			}
			// not a rift this client builds: read as any other file
			get(filename, callback, true);
		},
		e => callback(null, `Rift ${name}: ${e.message}`)
	);
	return true;
}

ready();

export default { ready, plan, mapInfo, serve };
