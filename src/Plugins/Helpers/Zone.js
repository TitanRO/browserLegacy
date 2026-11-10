/**
 * Plugins/Helpers/Zone.js
 *
 * The zone signal (Build-in roadmap F4): which zone rules the current map follows. Three zones: field (towns, fields,
 * dungeons, instances), pvp (pvp mapflag, battlegrounds) and woe (gvg maps, and castles during WoE). Field is the
 * default: a map is pvp or woe only when the server labels it so.
 *
 * The labels are the map properties the server already sends on every map entry and when a GM or WoE changes them:
 * ZC_MAPPROPERTY_R2 (0x99b; Hercules clif_maptypeproperty2: party = pvp mapflag, siege = gvg or castle during WoE,
 * bg = battleground), and on older clients ZC_NOTIFY_MAPPROPERTY (0x199: FREEPVPZONE / AGITZONE). It only listens
 * (Network.onPacket); MapState.js keeps handling the packets for the game.
 *
 * @author Trojal
 */

import MapState from 'DB/Map/MapState.js';

const { MapProperty, MapType, MapFlag } = MapState;

export const FIELD = 'field';
export const PVP = 'pvp';
export const WOE = 'woe';

/** The zone from 0x99b's flags. */
export function zoneFromFlags(flag) {
	if (flag & MapFlag.BATTLEFIELD) return PVP;
	if (flag & MapFlag.SIEGE) return WOE;
	if (flag & MapFlag.PVP) return PVP;
	return FIELD;
}

/** The zone from 0x199's property (clients without 0x99b). */
export function zoneFromProperty(property) {
	if (property === MapProperty.AGITZONE) return WOE;
	if (property === MapProperty.FREEPVPZONE || property === MapProperty.EVENTPVPZONE) return PVP;
	return FIELD;
}

export class ZoneSignal {
	constructor() {
		this.state = {
			map: null,
			zone: FIELD,
			pvp: false,
			gvg: false,
			castle: false,
			battleground: false,
			town: false
		};
		this._hasFlags = false;
		this._entering = false;
		this._listeners = new Set();
		/** Hooks the plugin sets: whether a map is a town (DB town info), the map loaded now (MapRenderer). */
		this.isTown = () => false;
		this.currentMap = () => null;
	}

	get zone() {
		return this.state.zone;
	}

	/**
	 * listener(state, entered): after a change of zone or map; `entered` is true once per map entry, when 0x99b arrives
	 * (the server sends it once the client has loaded the map, so the game UI is up).
	 */
	onChange(listener) {
		this._listeners.add(listener);
		return () => this._listeners.delete(listener);
	}

	/** A new map (map change, or a new map server): field until the server says otherwise. */
	mapChanged(mapName) {
		const map = mapName
			? String(mapName)
					.replace(/\.gat$/i, '')
					.toLowerCase()
			: null;
		this._hasFlags = false;
		this._entering = true;
		this._set(
			{
				map,
				zone: FIELD,
				pvp: false,
				gvg: false,
				castle: false,
				battleground: false,
				town: !!map && this.isTown(map)
			},
			false
		);
	}

	/** ZC_MAPPROPERTY_R2 (0x99b). */
	mapFlags(flag) {
		this._hasFlags = true;
		this._set(
			{
				zone: zoneFromFlags(flag),
				pvp: !!(flag & MapFlag.PVP),
				gvg: !!(flag & MapFlag.GVG),
				castle: !!(flag & MapFlag.SIEGE),
				battleground: !!(flag & MapFlag.BATTLEFIELD)
			},
			true
		);
	}

	/** ZC_NOTIFY_MAPPROPERTY (0x199): used only when the client gets no 0x99b. */
	mapProperty(property) {
		if (this._hasFlags) return;
		const zone = zoneFromProperty(property);
		this._set({ zone, pvp: zone === PVP, castle: zone === WOE }, false);
	}

	/** ZC_NOTIFY_MAPPROPERTY2 (0x1d6): battlegrounds. */
	mapType(type) {
		if (type === MapType.BATTLEFIELD) this._set({ zone: PVP, battleground: true }, false);
	}

	_set(change, mayEnter) {
		const before = this.state;
		this.state = { ...before, ...change };
		if (!this.state.map) {
			const map = this.currentMap();
			if (map) {
				this.state.map = String(map)
					.replace(/\.gat$/i, '')
					.toLowerCase();
				this.state.town = this.isTown(this.state.map);
			}
		}
		const entered = mayEnter && this._entering;
		if (entered) this._entering = false;
		const changed = Object.keys(this.state).some(key => this.state[key] !== before[key]);
		if (!changed && !entered) return;
		for (const listener of this._listeners) {
			try {
				listener(this.state, entered);
			} catch (error) {
				console.error('[Helpers] zone listener failed', error);
			}
		}
	}

	/** Listens to the map packets on the client's network (Network.onPacket). */
	listen(Network, PACKET) {
		const on = (packet, listener) => {
			if (packet && packet.id) Network.onPacket(packet, listener);
		};
		const entered = pkt => this.mapChanged(pkt.mapName);
		on(PACKET.ZC.NPCACK_MAPMOVE, entered);
		on(PACKET.ZC.NPCACK_SERVERMOVE, entered);
		on(PACKET.ZC.NPCACK_SERVERMOVE2, entered);
		// a new map server connection: the map name came with the char server's answer, MapRenderer has it later
		for (const name of ['ACCEPT_ENTER', 'ACCEPT_ENTER2', 'ACCEPT_ENTER3'])
			on(PACKET.ZC[name], () => this.mapChanged(null));
		on(PACKET.ZC.MAPPROPERTY_R2, pkt => this.mapFlags(pkt.flag | 0));
		on(PACKET.ZC.NOTIFY_MAPPROPERTY, pkt => this.mapProperty(pkt.type));
		on(PACKET.ZC.MAPPROPERTY, pkt => this.mapProperty(pkt.type));
		on(PACKET.ZC.NOTIFY_MAPPROPERTY2, pkt => this.mapType(pkt.type));
	}
}
