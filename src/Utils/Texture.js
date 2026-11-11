/**
 * Utils/Texture.js
 *
 * WebGL Helper function
 *
 * Trying to define here some functions related to textures.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Targa from 'Loaders/Targa.js';
import GIF from 'Vendors/libgif.js';

/**
 * Namespace
 */
const Texture = {};

const procCanvas = document.createElement('canvas');
const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

/**
 * Texture Constructor
 *
 * @param {string|object} data
 * @param {function} oncomplete callback
 */
Texture.load = function load(data, oncomplete) {
	const args = Array.prototype.slice.call(arguments, 2);

	// Possible missing textures on loaders
	if (!data) {
		args.unshift(false);
		oncomplete.apply(null, args);
		return;
	}

	// TGA Support
	if (data instanceof ArrayBuffer) {
		try {
			const tga = new Targa();
			tga.load(new Uint8Array(data));
			args.unshift(true);
			oncomplete.apply(tga.getCanvas(), args);
		} catch (e) {
			console.error(e.message);
			args.unshift(false);
			oncomplete.apply(null, args);
		}
		return;
	}

	// Regular images: decoded and cleared of magenta off the main thread when the browser can (TextureWorker)
	if (!decodeInWorker(data, oncomplete, args)) {
		loadOnMainThread(data, oncomplete, args);
	}
};

// Creates a canvas spritesheet with gif metadata to animate in guild display
Texture.processGifToSpriteSheet = function processGifToSpriteSheet(buffer, callback) {
	const args = Array.prototype.slice.call(arguments, 2);
	const dummyParent = document.createElement('div');
	const img = new Image();
	dummyParent.appendChild(img);

	img.onload = function () {
		try {
			const gif = new GIF({
				gif: img,
				auto_play: false,
				vp_w: img.width,
				vp_h: img.height
			});

			gif.load(function () {
				const frameCount = gif.get_length();
				const frameWidth = img.width;
				const frameHeight = img.height;

				const framesData = gif.get_frames();
				const frameDelays = [];

				const fLineCount = Math.ceil(Math.sqrt((frameCount * frameWidth) / frameHeight));
				const spriteSheetWidth = fLineCount * frameWidth;
				const spriteSheetHeight = Math.ceil(frameCount / fLineCount) * frameHeight;

				const canvas = document.createElement('canvas');
				canvas.width = spriteSheetWidth;
				canvas.height = spriteSheetHeight;
				const ctx = canvas.getContext('2d', {
					willReadFrequently: true
				});

				for (let i = 0; i < frameCount; i++) {
					const delay = framesData[i] && framesData[i].delay ? framesData[i].delay : 10;
					frameDelays.push(delay * 10);

					gif.move_to(i);
					const frameCanvas = gif.get_canvas();
					const row = Math.floor(i / fLineCount);
					const col = i % fLineCount;
					ctx.drawImage(frameCanvas, col * frameWidth, row * frameHeight);
				}

				Texture.removeMagenta(canvas);

				canvas.isAnimated = true;
				canvas.frameDelays = frameDelays;
				canvas.frameWidth = frameWidth;
				canvas.frameHeight = frameHeight;
				canvas.frameCount = frameCount;
				canvas.framesPerRow = fLineCount;
				canvas.currentFrame = 0;
				canvas.lastFrameChange = Date.now();

				args.unshift(true);
				callback.apply(canvas, args);
			});
		} catch (_e) {
			args.unshift(false);
			callback.apply(null, args);
		}
	};

	const blob = new Blob([buffer], {
		type: 'image/gif'
	});
	img.src = URL.createObjectURL(blob);
};

/**
 * Makes the magenta pixels (the client's transparent color) of RGBA data transparent.
 *
 * @param {Uint8ClampedArray} d
 */
function clearMagenta(d) {
	for (let i = 0; i < d.length; i += 4) {
		if (d[i] > 230 && d[i + 1] < 20 && d[i + 2] > 230) {
			d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
		}
	}
}

/**
 * Decoding images and clearing their magenta in a worker: the main thread only draws the result (an ImageBitmap)
 * into the texture's canvas. A map's textures and the UI's images otherwise cost 100+ ms main-thread tasks (the
 * pixel read-back and the per-pixel loop of removeMagenta), right when a map is shown.
 */
const WORKER_SOURCE = `
${clearMagenta.toString()}
self.onmessage = async (e) => {
	const { id, url, png } = e.data;
	try {
		const blob = await (await fetch(url)).blob();
		const bitmap = await createImageBitmap(blob);
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		ctx.drawImage(bitmap, 0, 0);
		bitmap.close();
		const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
		clearMagenta(image.data);
		ctx.putImageData(image, 0, 0);
		if (png) {
			// the image as a PNG (for a data URL): encoded here, not by the page's canvas.toDataURL
			self.postMessage({ id, blob: await canvas.convertToBlob({ type: 'image/png' }) });
			return;
		}
		const out = canvas.transferToImageBitmap();
		self.postMessage({ id, bitmap: out }, [out]);
	} catch (err) {
		self.postMessage({ id, error: String(err) });
	}
};`;

let textureWorker = null;
let workerFailed = false;
let nextJob = 1;
const jobs = new Map();

function getTextureWorker() {
	if (textureWorker || workerFailed) {
		return textureWorker;
	}
	try {
		if (
			typeof Worker === 'undefined' ||
			typeof OffscreenCanvas === 'undefined' ||
			typeof createImageBitmap === 'undefined'
		) {
			workerFailed = true;
			return null;
		}
		const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
		textureWorker = new Worker(url);
		textureWorker.onmessage = e => {
			const job = jobs.get(e.data.id);
			if (job) {
				jobs.delete(e.data.id);
				job(e.data);
			}
		};
		textureWorker.onerror = () => {
			// the worker can't run here: the images still waiting, and later ones, take the main-thread path
			workerFailed = true;
			textureWorker = null;
			const waiting = [...jobs.values()];
			jobs.clear();
			waiting.forEach(job => job({ error: 'worker' }));
		};
	} catch {
		workerFailed = true;
		textureWorker = null;
	}
	return textureWorker;
}

/**
 * Starts decoding an image (a blob: or data: URL) in the texture worker; calls oncomplete with a canvas of the result
 * as Texture.load does. False when there is no worker (the caller decodes on the main thread).
 *
 * @param {string} url
 * @param {function} oncomplete
 * @param {Array} args - oncomplete's extra arguments
 * @returns {boolean}
 */
function decodeInWorker(url, oncomplete, args) {
	if (typeof url !== 'string' || !/^(blob|data):/.test(url)) {
		return false;
	}
	const worker = getTextureWorker();
	if (!worker) {
		return false;
	}
	const id = nextJob++;
	jobs.set(id, ({ bitmap, error }) => {
		if (error || !bitmap) {
			// not decodable there (or the worker failed): the main-thread path, which also reports a broken image
			loadOnMainThread(url, oncomplete, args);
			return;
		}
		if (url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		canvas.getContext('2d').drawImage(bitmap, 0, 0);
		bitmap.close();
		oncomplete.apply(canvas, [true].concat(args));
	});
	worker.postMessage({ id, url });
	return true;
}

/**
 * An image (blob: or data: URL) cleared of magenta, as a PNG data URL: decoded, cleared and encoded in the texture
 * worker where there is one (canvas.toDataURL costs tens of ms per texture on the main thread), else as Texture.load
 * and canvas.toDataURL.
 *
 * @param {string} url
 * @param {function(string|null)} callback - The data URL, or null when the image can't be read.
 */
Texture.loadAsDataURL = function loadAsDataURL(url, callback) {
	const mainThread = () =>
		Texture.load(url, function (success) {
			callback(success ? this.toDataURL() : null);
		});
	const worker =
		typeof url === 'string' && /^(blob|data):/.test(url) && typeof FileReader !== 'undefined'
			? getTextureWorker()
			: null;
	if (!worker) {
		mainThread();
		return;
	}
	const id = nextJob++;
	jobs.set(id, ({ blob, error }) => {
		if (error || !blob) {
			mainThread();
			return;
		}
		if (url.startsWith('blob:')) {
			URL.revokeObjectURL(url);
		}
		const reader = new FileReader();
		reader.onload = () => callback(reader.result);
		reader.onerror = () => callback(null);
		reader.readAsDataURL(blob);
	});
	worker.postMessage({ id, url, png: true });
};

/**
 * Texture.load's main-thread path for an image URL.
 */
function loadOnMainThread(data, oncomplete, args) {
	const img = new Image();
	img.decoding = 'async';
	img.src = data;
	img.onload = function OnLoadClosure() {
		if (data.match(/^blob:/)) {
			URL.revokeObjectURL(data);
		}
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		canvas.width = this.width;
		canvas.height = this.height;
		ctx.drawImage(this, 0, 0, this.width, this.height);
		Texture.removeMagenta(canvas);
		oncomplete.apply(canvas, [true].concat(args));
	};
}

/**
 * Remove magenta pixels from image
 *
 * @param {HTMLElement} canvas
 */
Texture.removeMagenta = function removeMagenta(canvas) {
	const w = canvas.width;
	const h = canvas.height;

	procCtx.clearRect(0, 0, w, h);

	if (procCanvas.width !== w || procCanvas.height !== h) {
		procCanvas.width = w;
		procCanvas.height = h;
	}

	procCtx.drawImage(canvas, 0, 0);
	const imageData = procCtx.getImageData(0, 0, w, h);
	clearMagenta(imageData.data);

	canvas.getContext('2d').putImageData(imageData, 0, 0);
};

/**
 * Export
 */
export default Texture;
