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
 * their ground effect. Units marked hidden are drawn see-through, as a client with intravision draws them.
 *
 * Mouse: drag to turn, wheel to zoom, click to look at a cell. window.TitanROWoeViewer.lookAt(x, y) and .ready
 * (a promise, resolved once everything is placed) are for the page.
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

let _resolveReady;
WoeViewer.ready = new Promise(resolve => (_resolveReady = resolve));
WoeViewer.placed = { units: 0, statuses: 0, cells: 0, groundEffects: 0 };

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
			const play = () =>
				EffectManager.spamSkill(
					g.skill,
					g.caster || 0,
					[x, y, Altitude.getCellHeight(x, y)],
					null,
					g.caster || 0,
					g.lv
				);
			play();
			setInterval(play, GROUND_EFFECT_REPEAT_MS);
			WoeViewer.placed.groundEffects++;
		}
	}
}

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
		MapRenderer.onLoad = () => {
			BGM.stop();
			place(still);
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
				WoeViewer.lookAt(Mouse.world.x, Mouse.world.y);
			}
		};
		MapRenderer.setMap(`${still.map}.rsw`);
	});

	q.run();
};

window.TitanROWoeViewer = WoeViewer;

export default WoeViewer.init;

WoeViewer.init();
