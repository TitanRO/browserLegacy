/**
 * Plugins/Helpers/ZonePanel.js
 *
 * The foundation's demo panel: the map and the zone rules it follows (field, PvP or WoE), as the zone signal reports
 * them. Off unless the player turns it on (helper setting zonePanel.enabled).
 *
 * @author Trojal
 */

const ZONE_NAMES = { field: 'Field', pvp: 'PvP', woe: 'WoE' };
const ZONE_COLOURS = { field: '#2a7a2a', pvp: '#b03030', woe: '#8a5a00' };

export function zonePanel(zone) {
	return {
		id: 'zone',
		title: 'Zone',
		width: 150,
		enabled: ['zonePanel', 'enabled'],
		mount(body) {
			body.innerHTML =
				'<table><tr><td>Map</td><td class="value map"></td></tr>' +
				'<tr><td>Zone</td><td class="value zone"></td></tr></table>';
			const map = body.querySelector('.map');
			const name = body.querySelector('.zone');
			return {
				update() {
					const state = zone.state;
					map.textContent = (state.map || '-') + (state.town ? ' (town)' : '');
					let text = ZONE_NAMES[state.zone] || state.zone;
					if (state.battleground) text += ' (battleground)';
					name.textContent = text;
					name.style.color = ZONE_COLOURS[state.zone] || '';
				}
			};
		}
	};
}
