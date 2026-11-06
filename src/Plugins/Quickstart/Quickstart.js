/**
 * Quickstart Plugin (TitanRO)
 *
 * Quick Invite: a link such as https://play.titanro.net/?invite=<code> (made in game with @quickinvite) shows who sent
 * it and where they are, and "Play Now" logs the visitor in as the guest character, which loads in next to the
 * inviter. The server side is the Hercules quickstart plugin (TitanRO/titanro2 src/plugins/quickstart); the invite
 * details come from titanro-api (query `invite`), and the guest's login from the account service
 * (POST /v1/invites/<code>/accept: the guest account's name and a launch token, valid for a minute).
 *
 * Everything stays in this plugin: the dialog is its own overlay (no roBrowser UI component changes), and the login
 * goes through the login window's own handler, as if the visitor had typed the username and token and pressed
 * Connect. The server picks the character and the map; Session.ServerSelectsChar tells CharEngine to skip the char
 * list, so the client goes straight from login to the game.
 *
 * Config.local.js: plugins: { Quickstart: { path: 'Quickstart/Quickstart',
 *   pars: { api: '<GraphQL URL>', accountApi: '<account service URL>' } } }
 *
 * @author Trojal
 */

import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import WinLogin from 'UI/Components/WinLogin/WinLogin.js';

const INVITE_CODE = /^[A-Za-z0-9]{1,32}$/;
const DEFAULT_API = 'https://api.titanro.net/graphql';
const DEFAULT_ACCOUNT_API = 'https://account-api.titanro.net';

// Styled after the game's own windows (font, title bar, buttons). z-index stays under the game cursor (.cursor, 9999),
// which the game draws itself over every element once its cursor is loaded.
const STYLE = `
.qs-invite { position: fixed; inset: 0; z-index: 9000; display: flex; align-items: center; justify-content: center;
	background: rgba(0, 0, 0, 0.35); font-size: 12px; line-height: 1.3; color: #000; }
.qs-invite__box { width: min(280px, calc(100vw - 32px)); background: #fff; border: 1px solid #8c9db7;
	border-radius: 4px 4px 2px 2px; box-shadow: 1px 2px 6px rgba(0, 0, 0, 0.45); overflow: hidden; }
.qs-invite__title { height: 17px; padding: 0 8px; line-height: 17px; font-weight: bold; color: #2b3e5a;
	background: linear-gradient(#fdfeff, #d9e4f1); border-bottom: 1px solid #b3c2d6; }
.qs-invite__body { padding: 12px 12px 8px; text-align: center; }
.qs-invite__who { font-weight: bold; }
.qs-invite__line { margin: 4px 0; color: #444; }
.qs-invite__where { font-weight: bold; color: #1d4e89; }
.qs-invite__error { color: #b02020; }
.qs-invite__buttons { display: flex; justify-content: flex-end; gap: 4px; padding: 4px 6px 6px; background: #f2f5f9;
	border-top: 1px solid #dde4ee; }
.qs-invite__button { min-width: 58px; height: 20px; padding: 0 8px; font: inherit; color: #1f2f47;
	border: 1px solid #7f93b0; border-radius: 3px; background: linear-gradient(#ffffff, #dbe3ee); cursor: pointer; }
.qs-invite__button:hover:not(:disabled) { background: linear-gradient(#ffffff, #c9d7ea); }
.qs-invite__button:disabled { color: #8a96a8; }
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

/**
 * The account service's accept: {username, token}, or an error with the service's code. A simple request (a POST
 * without a body or custom headers), which browsers send without a preflight; the service answers only POST.
 */
async function acceptInvite(accountApi, code) {
	const res = await fetch(`${accountApi}/v1/invites/${encodeURIComponent(code)}/accept`, { method: 'POST' });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = new Error((body.error && body.error.message) || `HTTP ${res.status}`);
		err.code = body.error && body.error.code;
		throw err;
	}
	return body;
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

function showInvite(api, accountApi, code) {
	const style = el('style', null, STYLE);
	const overlay = el('div', 'qs-invite');
	const box = el('div', 'qs-invite__box');
	const body = el('div', 'qs-invite__body');
	const buttons = el('div', 'qs-invite__buttons');
	box.append(el('div', 'qs-invite__title', 'Invitation'), body, buttons);
	overlay.appendChild(box);
	document.head.appendChild(style);
	document.body.appendChild(overlay);

	const close = () => {
		overlay.remove();
		style.remove();
	};
	const button = (text, onclick) => {
		const node = el('button', 'qs-invite__button', text);
		node.onclick = onclick;
		return node;
	};
	const playWithout = () => {
		forgetInvite();
		close();
	};
	const showError = message => {
		body.replaceChildren(el('div', 'qs-invite__error', message));
		buttons.replaceChildren(button('OK', playWithout));
	};

	body.appendChild(el('div', 'qs-invite__line', 'Checking your invite…'));

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
			body.replaceChildren(
				el('div', 'qs-invite__who', `${name} (${jobName(invite.inviter.class)} ${baseLevel}/${jobLevel})`),
				el('div', 'qs-invite__line', 'has invited you to'),
				where
			);

			// The map's display name comes from the client's map table (keyed by <map>.rsw; getMapName maps .gat to
			// .rsw), which loads while the dialog is up.
			const mapFile = `${invite.map}.gat`;
			waitFor(() => DB.getMapName(mapFile, '') !== '', 60000)
				.then(() => {
					where.textContent = `${DB.getMapName(mapFile, '')} (${invite.map})`;
				})
				.catch(() => {});

			const cancel = button('Cancel', playWithout);
			const play = button('Play Now', () => {
				play.disabled = true;
				cancel.disabled = true;
				play.textContent = 'Joining…';
				// The login window's handler exists once the login screen is up; it logs in exactly as if the username
				// and token had been typed in and Connect pressed. The token is asked for only then, as it's short-lived.
				// The char-server then selects the guest character itself, so CharEngine skips the char list.
				waitFor(() => WinLogin.__active && typeof WinLogin.onConnectionRequest === 'function', 60000)
					.then(() => acceptInvite(accountApi, code))
					.then(login => {
						forgetInvite();
						close();
						Session.ServerSelectsChar = true;
						WinLogin.onConnectionRequest(login.username, login.token);
					})
					.catch(err => {
						showError(
							err.code === 'GUEST_BUSY'
								? 'The guest character is playing right now; try again in a few minutes.'
								: err.code === 'INVITE_NOT_OPEN'
									? 'This invite has expired or was already used.'
									: 'Couldn’t join right now; reload the page and try again.'
						);
					});
			});
			buttons.replaceChildren(play, cancel);
		})
		.catch(() => showError('Couldn’t check this invite; try again later.'));
}

export default function Init(params) {
	const code = (new URLSearchParams(window.location.search).get('invite') || '').trim();
	if (INVITE_CODE.test(code)) {
		showInvite((params && params.api) || DEFAULT_API, (params && params.accountApi) || DEFAULT_ACCOUNT_API, code);
	}
	return true;
}
