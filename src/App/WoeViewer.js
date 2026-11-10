/**
 * App/WoeViewer.js
 *
 * TitanRO: a castle still from War of Emperium (the moment an Emperium broke, or the end of WoE), drawn on its map
 * with the game's own renderer. The page (titanro/site/woe-view.html) fetches the still from the game data API and
 * hands it over as window.TitanROWoeStill (a promise of the woe_snapshot JSON); the viewer only draws what it gets.
 *
 * The still's units go through the same code as the map server's packets: a spawn packet for each unit (looks,
 * option, opt1-3, direction, guild), a status packet for each status with an icon, and each ground skill cell as its
 * skill unit entry; ground skills without a unit of their own (Storm Gust, Lord of Vermilion, Meteor Storm, ...) as
 * their ground effect, started as far in as it was at that moment. Guild emblems come from the still. Units marked
 * hidden are drawn see-through, as a client with intravision draws them.
 *
 * The castle's warps (the still's own list, or woe-castle-warps.json for stills taken before stills had one) are drawn
 * as portals, and clicking a portal to elsewhere on the castle map looks at where it leads, as walking through it
 * would; portals to other maps are drawn but lead nowhere here. back() returns to the spot before.
 *
 * Mouse: drag to turn, wheel to zoom, click to look at a cell. window.TitanROWoeViewer.lookAt(x, y), .clickCell(x, y),
 * .back() and .ready (a promise, resolved once everything is placed) are for the page.
 */

import Queue from 'Utils/Queue.js';
import Configs from 'Core/Configs.js';
import Client from 'Core/Client.js';
import Thread from 'Core/Thread.js';
import BGM from 'Audio/BGM.js';
import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import Renderer from 'Renderer/Renderer.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import Camera from 'Renderer/Camera.js';
import Altitude from 'Renderer/Map/Altitude.js';
import Entity from 'Renderer/Entity/Entity.js';
import EffectManager from 'Renderer/EffectManager.js';
import Mouse from 'Controls/MouseEventHandler.js';
import MapControl from 'Controls/MapControl.js';
import PACKETVER from 'Network/PacketVerManager.js';
import EntityManager from 'Renderer/EntityManager.js';
import Inflate from 'Utils/Inflate.js';
import Texture from 'Utils/Texture.js';
import { onEntitySpam, onEntityStatusChange } from 'Engine/MapEngine/Entity.js';

const TYPES = { pc: 0, mob: 5, npc: 6, pet: 7, hom: 8, mer: 9, elem: 10 };
const UNT_DUMMYSKILL = 0x86;
// A ground effect that runs for a while (Storm Gust, Lord of Vermilion, ...) is played again this often, so the still
// keeps showing what was on the ground at that moment.
const GROUND_EFFECT_REPEAT_MS = 4000;
// Ids for the ground cells, which the still doesn't number (the client only needs them unique)
let _cellId = 0x7f000000;

const WoeViewer = {};

// The camera's target; with intravision, hidden units the still includes are drawn see-through
WoeViewer.spot = Session.Entity = new Entity();
WoeViewer.spot.intravision = true;

// Ids for the portals (the still lists warps apart from its units)
let _warpId = 0x7e000000;
let _warps = [];
let _map = '';
const _history = [];

let _resolveReady;
WoeViewer.ready = new Promise(resolve => (_resolveReady = resolve));
WoeViewer.placed = { units: 0, statuses: 0, cells: 0, groundEffects: 0, warps: 0 };

/**
 * The spawn packet of a unit of the still (PACKET.ZC.NOTIFY_STANDENTRY11's fields).
 * @param {object} u - a unit of the still
 */
function spawnPacket(u) {
	const pc = u.t === 'pc';
	return {
		objecttype: TYPES[u.t] ?? 0,
		GID: u.id,
		AID: u.id,
		speed: 150,
		bodyState: u.opt1 || 0,
		healthState: u.opt2 || 0,
		effectState: u.option || 0,
		job: u.class ?? u.mob ?? u.npc ?? 0,
		head: u.hair || 0,
		weapon: u.weapon || 0,
		shield: u.shield || 0,
		// Hercules' order: bottom, top, mid
		accessory: u.head_bottom || 0,
		accessory2: u.head_top || 0,
		accessory3: u.head_mid || 0,
		headpalette: u.hair_color || 0,
		bodypalette: u.cloth_color || 0,
		headDir: u.hdir || 0,
		Robe: u.robe || 0,
		GUID: u.guild || 0,
		GEmblemVer: u.emblem || 0,
		honor: 0,
		virtue: u.opt3 || 0,
		isPKModeON: 0,
		sex: u.sex ?? 1,
		PosDir: [u.x, u.y, u.dir || 0],
		xSize: 0,
		ySize: 0,
		state: u.dead ? 1 : u.sit ? 2 : 0,
		clevel: u.lv || 0,
		font: 0,
		// Players' HP isn't shown (only a party sees it in game); monsters' as a share
		hp: pc || u.hp === undefined ? -1 : u.hp,
		maxhp: pc || u.hp === undefined ? -1 : 100,
		isBoss: 0,
		body: u.body || 0,
		name: u.name || ''
	};
}

/**
 * Places the still's units, statuses and ground skills.
 * @param {object} still - the woe_snapshot JSON
 */
function place(still) {
	for (const u of still.units || []) {
		onEntitySpam(spawnPacket(u));
		WoeViewer.placed.units++;
		for (const [, icon, ms, val] of u.sc || []) {
			onEntityStatusChange({
				index: icon,
				AID: u.id,
				state: 1,
				RemainMS: ms < 0 ? 9999 : ms,
				val: [val || 0, 0, 0]
			});
			WoeViewer.placed.statuses++;
		}
	}

	for (const g of still.ground || []) {
		const dummy = [];
		for (const [x, y, range, , , , unitId] of g.cells || []) {
			if (unitId === UNT_DUMMYSKILL) {
				dummy.push([x, y]);
				continue;
			}
			EffectManager.spamSkillZone(unitId, x, y, _cellId++, g.caster || 0, g.lv, range);
			WoeViewer.placed.cells++;
		}
		// A skill drawn by its cast's ground effect (no unit of its own), at the middle of its cells, again and again
		if (dummy.length && dummy.length === (g.cells || []).length) {
			const xs = dummy.map(c => c[0]);
			const ys = dummy.map(c => c[1]);
			const x = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
			const y = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
			// From the moment of the still: started as long ago as the skill had been running then
			const elapsed = Math.max(0, g.elapsed_ms || 0);
			const play = () =>
				EffectManager.spamSkill(
					g.skill,
					g.caster || 0,
					[x, y, Altitude.getCellHeight(x, y)],
					Renderer.tick - elapsed,
					g.caster || 0,
					g.lv
				);
			play();
			setInterval(play, GROUND_EFFECT_REPEAT_MS);
			WoeViewer.placed.groundEffects++;
		}
	}
}

/**
 * The guilds' emblems from the still (the client's data, zlib-compressed BMP), on their members.
 * @param {object} still - the woe_snapshot JSON
 */
function emblems(still) {
	const buffer = new Uint8Array(4 * 1024);
	for (const [gid, guild] of Object.entries(still.guilds || {})) {
		if (!guild.emblem) continue;
		try {
			const raw = Uint8Array.from(atob(guild.emblem), c => c.charCodeAt(0));
			const len = new Inflate(raw).getBytes(buffer);
			const src = URL.createObjectURL(new Blob([buffer.slice(0, len)], { type: 'image/bmp' }));
			Texture.load(src, function () {
				URL.revokeObjectURL(src);
				const img = new Image();
				img.onload = () => {
					EntityManager.forEach(entity => {
						if (entity.GUID === Number(gid)) {
							entity.setEntityGuildEmblem(img);
							entity.emblem.display = true;
						}
					});
				};
				img.src = this.toDataURL();
			});
		} catch (error) {
			console.error('[WoeViewer] emblem of guild', gid, error);
		}
	}
}

/**
 * The castle's portals: the still's warps, or the table exported from the server's scripts for older stills.
 * @param {object} still - the woe_snapshot JSON
 * @returns {Promise<object[]>} the warps ({x, y, xs, ys, to_map, to_x, to_y, hidden})
 */
function loadWarps(still) {
	if (Array.isArray(still.warps)) return Promise.resolve(still.warps);
	return fetch('woe-castle-warps.json')
		.then(r => (r.ok ? r.json() : { castles: {} }))
		.then(t => (t.castles && t.castles[still.map]) || [])
		.catch(() => []);
}

/** Draws the portals players see (the warp NPC's sprite and effect, as the client draws a warp). */
function placeWarps(warps) {
	_warps = warps;
	for (const w of warps) {
		if (w.hidden) continue;
		onEntitySpam({
			objecttype: 6,
			GID: _warpId++,
			job: 45,
			PosDir: [w.x, w.y, 0],
			name: w.to_map === _map ? '' : w.to_map,
			hp: -1,
			maxhp: -1
		});
		WoeViewer.placed.warps++;
	}
}

/**
 * A click on a cell: through a portal to elsewhere on the castle map (it leads to its destination), else that cell.
 * @returns {boolean} whether the click went through a portal
 */
WoeViewer.clickCell = function clickCell(x, y) {
	const w = _warps.find(v => Math.abs(v.x - x) <= Math.max(v.xs, 1) && Math.abs(v.y - y) <= Math.max(v.ys, 1));
	const from = [WoeViewer.spot.position[0], WoeViewer.spot.position[1]];
	if (w && w.to_map === _map) {
		_history.push(from);
		WoeViewer.lookAt(w.to_x, w.to_y);
		WoeViewer.onMove(true);
		return true;
	}
	if (w) return false; // to another map: nowhere to go in a castle still
	WoeViewer.lookAt(x, y);
	return false;
};

/** Back to the spot before the last portal. */
WoeViewer.back = function back() {
	const spot = _history.pop();
	if (spot) WoeViewer.lookAt(spot[0], spot[1]);
	WoeViewer.onMove(_history.length > 0);
};

/** Set by the page: called after a portal or back(), with whether there is a spot to go back to. */
WoeViewer.onMove = function onMove() {};

/** The cell to look at first: the Emperium, else the middle of the units. */
function focus(still) {
	const units = still.units || [];
	const emperium = units.find(u => u.mob === 1288);
	if (emperium) return [emperium.x, emperium.y];
	const players = units.filter(u => u.t === 'pc');
	const list = players.length ? players : units;
	if (!list.length) return [Altitude.width >> 1, Altitude.height >> 1];
	return [
		Math.round(list.reduce((n, u) => n + u.x, 0) / list.length),
		Math.round(list.reduce((n, u) => n + u.y, 0) / list.length)
	];
}

WoeViewer.lookAt = function lookAt(x, y) {
	WoeViewer.spot.position[0] = x;
	WoeViewer.spot.position[1] = y;
	WoeViewer.spot.position[2] = Altitude.getCellHeight(x, y);
};

WoeViewer.init = function init() {
	Altitude.MAX_INTERSECT_COUNT = 500;
	PACKETVER.value = Configs.get('packetver', 20250716);
	let still = null;
	const q = new Queue();

	q.add(() => {
		BGM.setAvailableExtensions(['mp3']);
		Thread.hook('THREAD_READY', q.next);
		Thread.init();
	});

	q.add(() => {
		Renderer.init();
		Client.onFilesLoaded = q.next;
		Client.init([]);
	});

	q.add(() => {
		DB.onReady = q.next;
		DB.init();
	});

	q.add(() => {
		Thread.send('CLIENT_FILES_ALIAS', DB.mapalias);
		Promise.resolve(window.TitanROWoeStill).then(
			data => {
				still = data;
				q._next();
			},
			error => console.error('[WoeViewer] no still', error)
		);
	});

	q.add(() => {
		MapRenderer.onLoad = async () => {
			BGM.stop();
			_map = still.map;
			place(still);
			emblems(still);
			placeWarps(await loadWarps(still));
			const [x, y] = focus(still);
			WoeViewer.lookAt(x, y);
			Camera.setTarget(WoeViewer.spot);
			Camera.init();
			Camera.altitudeTo = -200;
			Camera.zoomFinal = 300;
			_resolveReady(WoeViewer.placed);
		};
		MapControl.init();
		MapControl.onRequestWalk = () => {
			if (Mouse.world.x > -1 && Mouse.world.y > -1) {
				WoeViewer.clickCell(Mouse.world.x, Mouse.world.y);
			}
		};
		MapRenderer.setMap(`${still.map}.rsw`);
	});

	q.run();
};

window.TitanROWoeViewer = WoeViewer;

export default WoeViewer.init;

WoeViewer.init();
