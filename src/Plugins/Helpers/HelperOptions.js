/**
 * Plugins/Helpers/HelperOptions.js
 *
 * What the "TitanRO helpers" window lists: a data-driven list, the same in both clients (TitanRONet.dll's
 * src/helper_options.json holds the same entries). Each entry names its section (a heading in the window), its
 * setting (`<section>.<field>` in the helper settings document), its label and its type ("toggle": a box that flips
 * the boolean; "choice": one of several rows for the same setting, each with its `value`, picked like a radio
 * button). Rows show in list order under their section's heading. A helper adds its options here; the windows
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
	{ section: 'Info', key: 'woeTracker.panel', label: 'WoE tracker', type: 'toggle' },
	{ section: 'Automation', key: 'autopot.panel', label: 'Autopot', type: 'toggle' },
	{ section: 'Display', key: 'lowEffects.level', label: 'Effects: normal', type: 'choice', value: 0 },
	{ section: 'Display', key: 'lowEffects.level', label: 'Effects: minimum', type: 'choice', value: 1 },
	{ section: 'Display', key: 'lowEffects.level', label: 'Effects: none', type: 'choice', value: 2 },
	{ section: 'Display', key: 'castCircles.enabled', label: 'Cast circles', type: 'toggle' },
	{ section: 'Display', key: 'trapMarkers.enabled', label: 'Ground-skill and trap markers', type: 'toggle' },
	{ section: 'Display', key: 'chatScope.enabled', label: 'Chat range', type: 'toggle' },
	{ section: 'Display', key: 'castRange.enabled', label: 'Cast range', type: 'toggle' },
	{ section: 'Display', key: 'flatMap.enabled', label: 'Grayworld (flat map + grid)', type: 'toggle' },
	{ section: 'Display', key: 'flatMap.hideProps', label: 'Hide props', type: 'toggle' },
	{ section: 'Display', key: 'transparentProps.enabled', label: 'See-through props', type: 'toggle' }
];

/** The entries this window can show, grouped: [{section, options: [...]}] in first-appearance order. */
export function optionSections(list = HELPER_OPTIONS) {
	const sections = [];
	for (const option of list) {
		if (!['toggle', 'choice'].includes(option.type) || option.key.split('.').length !== 2) continue;
		let section = sections.find(s => s.section === option.section);
		if (!section) sections.push((section = { section: option.section, options: [] }));
		section.options.push(option);
	}
	return sections;
}
