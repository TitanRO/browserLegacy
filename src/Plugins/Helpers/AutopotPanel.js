/**
 * Plugins/Helpers/AutopotPanel.js
 *
 * The autopot panel (Build-in roadmap feature 19): edits the character's two autopot rules, which live on the map
 * server (TitanRO/titanro2 src/plugins/autopot). It sends the same chat command a player can type (@autopot ...) and
 * shows the server's answers; it never uses items itself. Off unless the player turns it on (helper setting
 * autopot.panel).
 *
 * @author Trojal
 */

const KINDS = [
	{ id: 'hp', label: 'HP' },
	{ id: 'sp', label: 'SP' }
];

/** "Autopot HP: White Potion below 50%." -> {kind: 'hp', item: 'White Potion', percent: 50}; "Autopot SP: no rule." -> {kind: 'sp'} */
export function parseRuleLine(line) {
	let m = /^Autopot (HP|SP): (.+) below (\d+)%\./.exec(line);
	if (m) return { kind: m[1].toLowerCase(), item: m[2], percent: Number(m[3]) };
	m = /^Autopot (HP|SP): no rule\./.exec(line);
	if (m) return { kind: m[1].toLowerCase(), item: null, percent: null };
	return null;
}

/** The chat command for a rule; null when the input is unusable. */
export function ruleCommand(kind, percent, item) {
	const p = Number(percent);
	const name = String(item || '').trim();
	if (!Number.isInteger(p) || p < 10 || p > 90 || !name) return null;
	return `@autopot ${kind} ${p} ${name}`;
}

/**
 * @param {object} chat
 * @param {function} chat.send - sends a chat line as the player (the command)
 * @param {function} chat.onServerMessage - listener(text) for the server's own messages to the player; returns stop
 * @param {function} healingItems - the healing items in the inventory, [{id, name}]: the list offers their ids (the
 *   server's item names can differ from the client's, which follow the player's language)
 */
export function autopotPanel({ send, onServerMessage }, healingItems) {
	return {
		id: 'autopot',
		title: 'Autopot',
		width: 230,
		enabled: ['autopot', 'panel'],
		mount(body) {
			body.innerHTML =
				'<table class="autopot">' +
				KINDS.map(
					k =>
						`<tr data-kind="${k.id}"><td>${k.label} below</td>` +
						'<td><input class="pct" type="number" min="10" max="90" step="5" style="width:38px"> %</td></tr>' +
						`<tr data-kind="${k.id}"><td colspan="2"><input class="item" list="autopot-items" placeholder="potion name or id" style="width:120px"> ` +
						'<button class="set">Set</button> <button class="off">Off</button></td></tr>'
				).join('') +
				'</table><datalist id="autopot-items"></datalist>' +
				'<div style="margin-top:4px"><button class="pause">Pause</button> <button class="resume">Resume</button> ' +
				'<button class="refresh">Show rules</button></div>' +
				'<div class="status hint"></div>';

			const status = body.querySelector('.status');
			// Keys typed here are the panel's, not the game's shortcuts
			for (const input of body.querySelectorAll('input'))
				input.addEventListener('keydown', event => event.stopPropagation());
			const list = body.querySelector('#autopot-items');
			const row = kind => [...body.querySelectorAll(`tr[data-kind="${kind}"]`)];
			const field = (kind, cls) =>
				row(kind)
					.map(r => r.querySelector('.' + cls))
					.find(Boolean);

			const say = text => {
				status.textContent = text;
			};
			const run = command => {
				if (command) send(command);
			};

			for (const k of KINDS) {
				field(k.id, 'set').addEventListener('click', () => {
					const command = ruleCommand(k.id, field(k.id, 'pct').value, field(k.id, 'item').value);
					if (!command) return say('Pick a threshold of 10 to 90 % and a healing item.');
					run(command);
				});
				field(k.id, 'off').addEventListener('click', () => run(`@autopot ${k.id} off`));
			}
			body.querySelector('.pause').addEventListener('click', () => run('@autopot off'));
			body.querySelector('.resume').addEventListener('click', () => run('@autopot on'));
			body.querySelector('.refresh').addEventListener('click', () => run('@autopot'));

			const stop = onServerMessage(text => {
				if (!/^Autopot/.test(text)) return;
				const rule = parseRuleLine(text);
				if (rule) {
					field(rule.kind, 'pct').value = rule.percent == null ? '' : rule.percent;
					field(rule.kind, 'item').value = rule.item || '';
				}
				say(text);
			});

			// The rules are on the server: ask for them once the panel is up.
			run('@autopot');

			return {
				update() {
					list.textContent = '';
					for (const item of healingItems()) {
						const option = document.createElement('option');
						option.value = String(item.id);
						option.label = item.name;
						list.append(option);
					}
				},
				unmount: stop
			};
		}
	};
}
