/**
 * Helpers Plugin (TitanRO)
 *
 * The web client's half of the built-in game helpers' shared foundation (Build-in roadmap, phase 0); the Windows client
 * (TitanRONet.dll) builds the same pieces, and every helper feature ships in both:
 *
 * - packet events: Network.onPacket / Network.onAnyPacket let helpers read received packets after the game has
 *   handled them, without replacing its handlers (NetworkManager.js). Helpers never send or change packets.
 * - the zone signal (Zone.js): field, PvP or WoE for the current map, from the map properties the server sends.
 * - helper panels (HelperPanels.js): game windows for helpers, with their key bindings and the "TitanRO helpers"
 *   window; the zone panel (ZonePanel.js) is the first, off by default.
 * - asset swaps: Client.addFileSwap (Core/Client.js) serves another file in place of a game file.
 * - helper settings (HelperSettings.js): the master account's settings from the account service, shared with the
 *   launcher and the Windows client.
 * - the information panels (InfoPanels.js, InfoCore.js): target, exp tracker, loot alerts, damage log, MVP timers.
 *
 * Helper features import the shared pieces from here: `import { helpers } from 'Plugins/Helpers/Helpers.js'`.
 *
 * Config.local.js: plugins: { Helpers: { path: 'Helpers/Helpers', pars: { accountApi: 'https://account-api.titanro.net' } } }
 *
 * @author Trojal
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import DB from 'DB/DBManager.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import { HelperSettingsClient, TOKEN_EVENT } from './HelperSettings.js';
import { ZoneSignal } from './Zone.js';
import { HelperPanels } from './HelperPanels.js';
import { zonePanel } from './ZonePanel.js';
import { autopotPanel } from './AutopotPanel.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import ItemType from 'DB/Items/ItemType.js';
import { startInfoPanels } from './InfoPanels.js';

/** The shared pieces, once the plugin has started. */
export const helpers = { settings: null, zone: null, panels: null, info: null };

let started = false;

/** The healing items in the inventory (the autopot panel's choices). */
function healingItems() {
	try {
		const list = (Inventory.getUI && Inventory.getUI().list) || [];
		const seen = new Map();
		for (const item of list) {
			if (item.type === ItemType.HEALING && !seen.has(item.ITID))
				seen.set(item.ITID, { id: item.ITID, name: DB.getItemName(item) });
		}
		return [...seen.values()];
	} catch {
		return [];
	}
}

export default function Init(params) {
	if (started) return true;
	started = true;

	const settings = new HelperSettingsClient({ accountApi: params && params.accountApi });
	const zone = new ZoneSignal();
	zone.isTown = map => !!DB.getTownInfo(map);
	zone.currentMap = () => MapRenderer.currentMap;
	zone.listen(Network, PACKET);

	// In the game: the map's UI is up (the chat box comes and goes with it).
	const panels = new HelperPanels({ settings, inGame: () => !!ChatBox.__active });
	panels.register(zonePanel(zone));
	panels.register(
		autopotPanel(
			{
				// The command goes out as if typed in the chat box; the server's answers come back as its messages.
				send: text => ChatBox.onRequestTalk('', text, ChatBox.TYPE.PUBLIC),
				onServerMessage: listener => Network.onPacket(PACKET.ZC.NOTIFY_PLAYERCHAT, pkt => listener(pkt.msg))
			},
			healingItems
		)
	);
	const info = startInfoPanels({ network: Network, settings, panels });

	zone.onChange((_state, entered) => {
		if (entered) panels.refresh();
		panels.update();
	});

	// The helper token comes with each launch (MasterAccount); a reload of the page keeps the tab's.
	window.addEventListener(TOKEN_EVENT, event => {
		settings.setToken(event.detail);
	});
	settings.restoreToken();
	window.addEventListener('pagehide', () => settings.flush());

	Object.assign(helpers, { settings, zone, panels, info });
	return true;
}
