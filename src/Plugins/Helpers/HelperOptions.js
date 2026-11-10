/**
 * Plugins/Helpers/HelperOptions.js
 *
 * What the "TitanRO helpers" window lists: a data-driven list, the same in both clients (TitanRONet.dll's
 * src/helper_options.json holds the same entries). Each entry names its section (a heading in the window), its
 * setting (`<section>.<field>` in the helper settings document), its label and its type ("toggle": a box that flips
 * the boolean). Rows show in list order under their section's heading. A helper adds its options here; the windows
 * need no code for them.
 *
 * @author Trojal
 */

export const HELPER_OPTIONS = [
	{ section: 'Info', key: 'targetPanel.enabled', label: 'Target panel', type: 'toggle' },
	{ section: 'Info', key: 'expTracker.enabled', label: 'Exp tracker', type: 'toggle' },
	{ section: 'Info', key: 'lootAlerts.enabled', label: 'Loot alerts', type: 'toggle' },
	{ section: 'Info', key: 'lootAlerts.sound', label: 'Loot alert sound', type: 'toggle' },
	{ section: 'Info', key: 'lootAlerts.cards', label: 'Alert on every card', type: 'toggle' },
	{ section: 'Info', key: 'dropSprites.enabled', label: 'Large rare drops', type: 'toggle' },
	{ section: 'Info', key: 'mvpTimers.panel', label: 'MVP timers', type: 'toggle' },
	{ section: 'Info', key: 'damageLog.enabled', label: 'Damage log', type: 'toggle' },
	{ section: 'Info', key: 'zonePanel.enabled', label: 'Zone', type: 'toggle' },
	{ section: 'Automation', key: 'autopot.panel', label: 'Autopot', type: 'toggle' }
];

/** The entries this window can show, grouped: [{section, options: [...]}] in first-appearance order. */
export function optionSections(list = HELPER_OPTIONS) {
	const sections = [];
	for (const option of list) {
		if (option.type !== 'toggle' || option.key.split('.').length !== 2) continue;
		let section = sections.find(s => s.section === option.section);
		if (!section) sections.push((section = { section: option.section, options: [] }));
		section.options.push(option);
	}
	return sections;
}
