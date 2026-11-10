/**
 * Plugins/Helpers/InfoPanels.js
 *
 * The information panels (Build-in roadmap track A), the same as the Windows client's (TitanRONet.dll):
 *
 * - Target (panels.target, targetPanel.enabled): the monster the player fights, its HP when the server shows its bar.
 * - Exp (panels.exp, expTracker.enabled): base/job exp per hour, time to level, zeny per hour, a session reset.
 * - Loot (panels.loot, lootAlerts.enabled): rare drops on screen (cards, items at or below maxRatePercent, the watch
 *   list), with a sound (lootAlerts.sound). Enlarged drops (dropSprites.enabled): those drops drawn twice the size and
 *   tinted, at once.
 * - Damage (panels.damage, damageLog.enabled): DPS and damage per skill of the player's own character, homunculus and
 *   mercenary.
 * - WoE (panels.woe, woeTracker.panel): castle owners, the latest breaks, the last WoE's guild kills, from the map
 *   server's woe_stats plugin ({"type":"woe"} beside the game data, every 30 s while the panel shows).
 * - MVP timers (panels.mvp, mvpTimers.panel): alive or the respawn window per permanent MVP spawn: every minute while
 *   the panel shows, a {"type":"mvps"} JSON message to the map server beside the game data, which the mvp_status
 *   plugin answers the same way (Network.sendJson / Network.onJson; no game packet changes).
 *
 * The state and text are InfoCore.js; this file turns received packets into its events (read-only, after the game
 * has handled them) and draws the panels.
 *
 * @author Trojal
 */

import DB from 'DB/DBManager.js';
import PACKET from 'Network/PacketStructure.js';
import ItemObject from 'Renderer/ItemObject.js';
import Sound from 'Audio/SoundManager.js';
import {
	Combat,
	ExpTracker,
	LootLog,
	KIND,
	alertReason,
	damageLines,
	expLines,
	lootRules,
	mvpLines,
	duration,
	targetText,
	woeLines
} from './InfoCore.js';

const ALERT_SOUND = 'effect/number_change.wav';
const TINT = [1, 225 / 255, 110 / 255, 1];
const MVP_EVERY_MS = 60000;
const WOE_EVERY_MS = 30000;

const now = () => performance.now() / 1000;

/** The packets the panels read, as InfoCore events. */
export function packetEvents() {
	const unit = pkt => ({
		type: 'Unit',
		id: pkt.GID,
		kind: pkt.objecttype,
		job: pkt.job,
		level: pkt.clevel,
		hp: pkt.hp,
		maxHp: pkt.maxhp,
		boss: !!pkt.isBoss,
		name: pkt.name || ''
	});
	const param = pkt => ({ type: 'Param', varID: pkt.varID, value: Number(pkt.amount ?? pkt.count) });
	return [
		['AID', pkt => ({ type: 'Entered', aid: pkt.AID })],
		['NPCACK_MAPMOVE', () => ({ type: 'MapChange' })],
		['NPCACK_SERVERMOVE', () => ({ type: 'MapChange' })],
		['NPCACK_SERVERMOVE2', () => ({ type: 'MapChange' })],
		['PAR_CHANGE', param],
		['LONGPAR_CHANGE', param],
		['LONGLONGPAR_CHANGE', param],
		['NOTIFY_MOVEENTRY11', unit],
		['NOTIFY_NEWENTRY11', unit],
		['NOTIFY_STANDENTRY11', unit],
		['NOTIFY_VANISH', pkt => ({ type: 'UnitGone', id: pkt.GID, how: pkt.type })],
		['CHANGESTATE_MER', pkt => ({ type: 'Homunculus', id: pkt.GID >>> 0 })],
		['MER_INIT', pkt => ({ type: 'Mercenary', id: pkt.AID >>> 0 })],
		[
			'NOTIFY_ACT3',
			pkt => ({
				type: 'Damage',
				source: pkt.GID,
				target: pkt.targetGID,
				skill: 0,
				damage: pkt.damage + Math.max(0, pkt.leftDamage || 0)
			})
		],
		[
			'NOTIFY_SKILL2',
			pkt => ({ type: 'Damage', source: pkt.AID, target: pkt.targetID, skill: pkt.SKID, damage: pkt.damage })
		],
		['ITEM_FALL_ENTRY3', pkt => ({ type: 'ItemDrop', floorId: pkt.ITAID, item: pkt.ITID, count: pkt.count })]
	];
}

/** The information panels' state, fed by events. */
export class Info {
	constructor({ rates = {}, rules } = {}) {
		this.combat = new Combat();
		this.exp = new ExpTracker();
		this.loot = new LootLog();
		this.rates = rates;
		this.rules = rules || lootRules();
		this.owner = null;
		this.mvps = null;
		this.woe = null;
	}

	/** Returns a loot alert ({name, reason, ...}) when the event raises one. */
	event(e, at, itemName) {
		this.combat.event(e, at);
		if (e.type === 'Entered' && this.owner !== e.aid) {
			this.owner = e.aid;
			this.exp.clear();
			this.loot.clear();
		} else if (e.type === 'Param') {
			this.exp.param(e.varID, e.value, at);
		} else if (e.type === 'ItemDrop') {
			return this.loot.drop(this.rates, this.rules, e.floorId, e.item, e.count, at, itemName && itemName(e.item));
		}
		return null;
	}
}

const lines = (body, rows) => {
	let box = body.querySelector('.lines');
	if (!box) {
		box = document.createElement('div');
		box.className = 'lines';
		body.prepend(box);
	}
	box.textContent = '';
	for (const row of rows) {
		const div = document.createElement('div');
		div.textContent = typeof row === 'string' ? row : row.text;
		if (row.cls) div.className = row.cls;
		box.append(div);
	}
};

const resetButton = (body, onClick) => {
	const button = document.createElement('button');
	button.className = 'reset';
	button.textContent = 'Reset';
	button.addEventListener('click', event => {
		event.stopPropagation();
		onClick();
	});
	body.append(button);
};

/**
 * Registers the panels and starts reading packets.
 *
 * @param {object} options
 * @param {NetworkManager} options.network
 * @param {HelperSettingsClient} options.settings
 * @param {HelperPanels} options.panels
 */
export function startInfoPanels({ network, settings, panels }) {
	const info = new Info();
	const itemName = id => {
		const it = DB.getItemInfo(id);
		return (it && it.identifiedDisplayName) || (info.rates[id] ? info.rates[id][2] : `Item #${id}`);
	};
	const skillName = id => DB.getSkillName(id) || `Skill ${id}`;
	const views = {};
	const refresh = id => views[id] && views[id].update && views[id].update();

	import('./droprates.json')
		.then(m => {
			info.rates = m.default || m;
		})
		.catch(error => console.warn('[Helpers] no drop rates', error));

	const applyRules = () => {
		info.rules = lootRules(settings.settings.lootAlerts);
	};
	applyRules();
	settings.onChange(applyRules);

	// Enlarged rare drops: shown as they drop (the web client applies it at once)
	ItemObject.decorate = (entity, itemId) => {
		if (settings.get('dropSprites', 'enabled') !== true) return;
		if (!alertReason(info.rates, info.rules, itemId)) return;
		entity.xSize = entity.ySize = 10;
		entity.effectColor = new Float32Array(TINT);
	};

	for (const [name, toEvent] of packetEvents()) {
		const packet = PACKET.ZC[name];
		if (!packet || !packet.id) continue;
		network.onPacket(packet, pkt => {
			const e = toEvent(pkt);
			const alert = info.event(e, now(), itemName);
			if (alert) {
				if (settings.get('lootAlerts', 'enabled') === true && settings.get('lootAlerts', 'sound') === true)
					Sound.play(ALERT_SOUND);
				refresh('loot');
			}
			if (e.type === 'Unit' || e.type === 'UnitGone' || e.type === 'Damage' || e.type === 'MapChange') {
				refresh('target');
				if (e.type === 'Damage') refresh('damage');
			}
			if (e.type === 'Param') refresh('exp');
		});
	}

	panels.register({
		id: 'target',
		title: 'Target',
		width: 190,
		enabled: ['targetPanel', 'enabled'],
		mount(body) {
			const bar = document.createElement('div');
			bar.className = 'hpbar';
			const fill = document.createElement('div');
			bar.append(fill);
			body.append(bar);
			return (views.target = {
				update() {
					const t = info.combat.targetUnit();
					const [name, hp] = targetText(t);
					lines(body, [
						{ text: name, cls: t ? 'gold' : 'grey' },
						...(hp ? [{ text: hp, cls: t && t.unit.dead ? 'red' : '' }] : [])
					]);
					const known = t && !t.unit.dead && t.unit.maxHp > 0 && t.unit.hp >= 0;
					bar.style.display = t ? '' : 'none';
					fill.style.width = (t && t.unit.dead ? 0 : known ? (t.unit.hp * 100) / t.unit.maxHp : 100) + '%';
				}
			});
		}
	});

	panels.register({
		id: 'exp',
		title: 'Exp',
		width: 210,
		enabled: ['expTracker', 'enabled'],
		mount(body) {
			resetButton(body, () => {
				info.exp.reset();
				refresh('exp');
			});
			const timer = setInterval(() => refresh('exp'), 1000);
			return (views.exp = {
				update() {
					lines(
						body,
						expLines(info.exp, now()).map((text, i) => ({ text, cls: i % 2 === 1 && i < 4 ? 'grey' : '' }))
					);
				},
				unmount() {
					clearInterval(timer);
				}
			});
		}
	});

	panels.register({
		id: 'loot',
		title: 'Loot',
		width: 240,
		enabled: ['lootAlerts', 'enabled'],
		mount(body) {
			return (views.loot = {
				update() {
					const drops = info.loot.drops.slice().reverse();
					lines(
						body,
						drops.length
							? drops.map(d => ({
									text: `${duration(now() - d.at)} ${d.name}${d.count > 1 ? ' x' + d.count : ''} (${d.reason})`,
									cls: d.reason === 'card' ? 'gold' : ''
								}))
							: [{ text: 'No rare drops yet', cls: 'grey' }]
					);
				}
			});
		}
	});

	panels.register({
		id: 'damage',
		title: 'Damage',
		width: 230,
		enabled: ['damageLog', 'enabled'],
		mount(body) {
			resetButton(body, () => {
				info.combat.resetDamage();
				refresh('damage');
			});
			return (views.damage = {
				update() {
					const all = damageLines(info.combat, skillName);
					const totals = Math.min(info.combat.totals.size, 4);
					lines(
						body,
						all.map((text, i) => ({ text, cls: i === 0 ? 'gold' : i > totals ? 'grey' : '' }))
					);
				}
			});
		}
	});

	// The map server's mvp_status plugin answers {"type":"mvps"} beside the game data
	let lastFetch = 0;
	const fetchMvps = () => {
		lastFetch = Date.now();
		network.sendJson({ type: 'mvps' });
	};
	network.onJson('mvps', answer => {
		info.mvps = { mvps: answer.mvps || [], skew: answer.now - Math.floor(Date.now() / 1000) };
		refresh('mvp');
	});
	panels.register({
		id: 'mvp',
		title: 'MVP timers',
		width: 260,
		enabled: ['mvpTimers', 'panel'],
		mount(body) {
			const tick = () => {
				if (panels.shown('mvp') && Date.now() - lastFetch >= MVP_EVERY_MS) fetchMvps();
				refresh('mvp');
			};
			const timer = setInterval(tick, 5000);
			tick();
			return (views.mvp = {
				update() {
					lines(
						body,
						mvpLines(info.mvps, Math.floor(Date.now() / 1000)).map(l => ({
							text: l.text,
							cls: l.alive ? 'green' : ''
						}))
					);
				},
				unmount() {
					clearInterval(timer);
				}
			});
		}
	});

	// The WoE tracker: the map server's woe_stats plugin answers {"type":"woe"} beside the game data
	let lastWoe = 0;
	network.onJson('woe', answer => {
		info.woe = answer;
		refresh('woe');
	});
	panels.register({
		id: 'woe',
		title: 'WoE',
		width: 290,
		enabled: ['woeTracker', 'panel'],
		mount(body) {
			const tick = () => {
				if (panels.shown('woe') && Date.now() - lastWoe >= WOE_EVERY_MS) {
					lastWoe = Date.now();
					network.sendJson({ type: 'woe' });
				}
			};
			const timer = setInterval(tick, 5000);
			tick();
			return (views.woe = {
				update() {
					lines(
						body,
						woeLines(info.woe).map(l => ({ text: l.text, cls: l.heading ? 'gold' : '' }))
					);
				},
				unmount() {
					clearInterval(timer);
				}
			});
		}
	});

	return info;
}

export { KIND };
