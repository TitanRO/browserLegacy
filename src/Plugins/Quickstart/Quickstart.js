/**
 * Quickstart Plugin (TitanRO)
 *
 * Quick Invite: a link such as https://play.titanro.net/?invite=<code> (made in game with @quickinvite) shows who sent
 * it and where they are, and "Play Now" logs the visitor in as the guest character, which loads in next to the
 * inviter. The server side is the Hercules quickstart plugin (TitanRO/titanro2 src/plugins/quickstart); the invite
 * details and the one-time login come from titanro-api (query `invite`, mutation `acceptInvite`).
 *
 * Everything stays in this plugin: the dialog is its own overlay (no roBrowser UI component changes), and the login
 * goes through the login window's own handler, as if the visitor had typed the username and token and pressed
 * Connect. The server picks the character and the map, so the client goes straight from login to the game.
 *
 * Config.local.js: plugins: { Quickstart: { path: 'Quickstart/Quickstart', pars: { api: '<GraphQL URL>' } } }
 *
 * @author Trojal
 */

import DB from 'DB/DBManager.js';
import WinLogin from 'UI/Components/WinLogin/WinLogin.js';

const INVITE_CODE = /^[a-z0-9]{16}$/;
const DEFAULT_API = 'https://api.titanro.net/graphql';

const STYLE = `
.qs-invite { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center;
	background: rgba(0, 0, 0, 0.55); font-family: Arial, Helvetica, sans-serif; }
.qs-invite__box { width: min(360px, calc(100vw - 32px)); padding: 24px; border-radius: 8px; background: #f6f3ea;
	color: #2b2b2b; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35); text-align: center; }
.qs-invite__who { font-size: 18px; font-weight: bold; }
.qs-invite__line { margin: 6px 0; font-size: 14px; color: #555; }
.qs-invite__where { font-size: 16px; font-weight: bold; margin-bottom: 18px; }
.qs-invite__button { min-width: 140px; padding: 10px 18px; border: 0; border-radius: 6px; background: #3a6ea5;
	color: #fff; font-size: 15px; font-weight: bold; cursor: pointer; }
.qs-invite__button:disabled { background: #8aa4bf; cursor: default; }
.qs-invite__link { display: block; margin: 12px auto 0; border: 0; background: none; color: #3a6ea5;
	font-size: 13px; text-decoration: underline; cursor: pointer; }
.qs-invite__error { color: #a33; font-size: 14px; margin: 12px 0 0; }
`;

/** JOB_LORD_KNIGHT -> Lord Knight */
function jobName(jobClass) {
	return String(jobClass || '')
		.replace(/^JOB_/, '')
		.toLowerCase()
		.split('_')
		.filter(Boolean)
		.map(word => word[0].toUpperCase() + word.slice(1))
		.join(' ');
}

async function graphql(api, query, variables) {
	const res = await fetch(api, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, variables })
	});
	const body = await res.json();
	if (body.errors && body.errors.length) {
		const err = new Error(body.errors[0].message);
		err.code = body.errors[0].extensions && body.errors[0].extensions.code;
		throw err;
	}
	return body.data;
}

/** Resolves once check() is true (polled), or rejects after `ms`. */
function waitFor(check, ms) {
	return new Promise((resolve, reject) => {
		const started = Date.now();
		(function poll() {
			if (check()) return resolve();
			if (Date.now() - started > ms) return reject(new Error('timeout'));
			setTimeout(poll, 200);
		})();
	});
}

function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

/** Drops ?invite= from the address bar, so a reload doesn't reuse a spent invite. */
function forgetInvite() {
	const url = new URL(window.location.href);
	url.searchParams.delete('invite');
	window.history.replaceState(null, '', url.toString());
}

function showInvite(api, code) {
	const style = el('style', null, STYLE);
	const overlay = el('div', 'qs-invite');
	const box = el('div', 'qs-invite__box');
	overlay.appendChild(box);
	document.head.appendChild(style);
	document.body.appendChild(overlay);

	const close = () => {
		overlay.remove();
		style.remove();
	};
	const showError = message => {
		box.replaceChildren(el('div', 'qs-invite__error', message));
		const play = el('button', 'qs-invite__link', 'Play without the invite');
		play.onclick = () => {
			forgetInvite();
			close();
		};
		box.appendChild(play);
	};

	box.appendChild(el('div', 'qs-invite__line', 'Checking your invite…'));

	graphql(
		api,
		'query ($code: String!) { invite(code: $code) { status map inviter { name class baseLevel jobLevel } } }',
		{ code }
	)
		.then(({ invite }) => {
			if (!invite || invite.status !== 'OPEN' || !invite.inviter) {
				showError('This invite has expired or was already used.');
				return;
			}
			const { name, baseLevel, jobLevel } = invite.inviter;
			const where = el('div', 'qs-invite__where', invite.map);
			const play = el('button', 'qs-invite__button', 'Play Now');
			box.replaceChildren(
				el('div', 'qs-invite__who', `${name} — ${jobName(invite.inviter.class)} ${baseLevel}/${jobLevel}`),
				el('div', 'qs-invite__line', 'has invited you to'),
				where,
				play
			);

			// The map's display name comes from the client's map table (keyed by <map>.rsw; getMapName maps .gat to
			// .rsw), which loads while the dialog is up.
			const mapFile = `${invite.map}.gat`;
			waitFor(() => DB.getMapName(mapFile, '') !== '', 60000)
				.then(() => {
					where.textContent = `${DB.getMapName(mapFile, '')} (${invite.map})`;
				})
				.catch(() => {});

			play.onclick = () => {
				play.disabled = true;
				play.textContent = 'Joining…';
				graphql(api, 'mutation ($code: String!) { acceptInvite(code: $code) { username token } }', { code })
					.then(({ acceptInvite }) =>
						// The login window's handler exists once the login screen is up; it logs in exactly as if
						// the username and token had been typed in and Connect pressed.
						waitFor(
							() => WinLogin.__active && typeof WinLogin.onConnectionRequest === 'function',
							60000
						).then(() => {
							forgetInvite();
							close();
							WinLogin.onConnectionRequest(acceptInvite.username, acceptInvite.token);
						})
					)
					.catch(err => {
						showError(
							err.code === 'GUEST_BUSY'
								? 'The guest character is playing right now; try again in a few minutes.'
								: err.code === 'INVITE_NOT_OPEN'
									? 'This invite has expired or was already used.'
									: 'Couldn’t join right now; reload the page and try again.'
						);
					});
			};
		})
		.catch(() => showError('Couldn’t check this invite; try again later.'));
}

export default function Init(params) {
	const code = new URLSearchParams(window.location.search).get('invite');
	if (code && INVITE_CODE.test(code)) {
		showInvite((params && params.api) || DEFAULT_API, code);
	}
	return true;
}
