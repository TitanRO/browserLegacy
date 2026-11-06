/**
 * MasterAccount Plugin (TitanRO)
 *
 * The play site's front door: the TitanRO launcher's own screens (TitanRO/titanro-launcher, its web build
 * /web/titanro-shell.js) over the game. Players sign in to their master account (Clerk), see their characters, create
 * and delete them, and pick one; the game then logs in to that character's hidden game account with a single-use
 * launch token from the account service, as the desktop launcher's Play does. The login server's launch_token plugin
 * accepts the token, and the char server's master_characters plugin selects the account's character, so there's no
 * login screen, server list or character selection.
 *
 * The shell is imported at runtime (it's built and deployed with the launcher) and lives in its own shadow root over
 * the page; roBrowser loads behind it meanwhile. It's shown whenever the login window would be: on the first load,
 * and again after a disconnect or "back to login". Quick Invite links (?invite=, the Quickstart plugin) skip it.
 * `?gamelogin` skips it too and shows roBrowser's own login window (test accounts).
 *
 * Config.local.js: plugins: { MasterAccount: { path: 'MasterAccount/MasterAccount',
 *   pars: { shell: '<URL of titanro-shell.js>' } } }
 *
 * @author Trojal
 */

import Session from 'Engine/SessionStorage.js';
import WinLogin from 'UI/Components/WinLogin/WinLogin.js';

const DEFAULT_SHELL = 'https://electron.titanro.net/web/titanro-shell.js';
// How long a launched login may keep the login window up (e.g. refused) before the shell comes back over it.
const LAUNCH_GRACE_MS = 10000;

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

const loginReady = () => WinLogin.__active && typeof WinLogin.onConnectionRequest === 'function';

export default function Init(params) {
	const query = new URLSearchParams(window.location.search);
	if (query.has('invite') || query.has('gamelogin')) {
		return true;
	}

	const shellUrl = (params && params.shell) || DEFAULT_SHELL;
	let host = null;
	let shell = null;
	let launchedAt = 0;

	const hide = () => {
		if (shell) shell.unmount();
		if (host) host.remove();
		shell = null;
		host = null;
	};

	/** Logs in as the picked character once the login window is up: the token is fetched only then (it's short-lived),
	 * and the login goes through the window's own handler, as if typed in and Connect pressed. */
	const launch = async (character, login) => {
		await waitFor(loginReady, 60000).catch(() => {
			throw new Error('The game is still loading; try again in a moment.');
		});
		const { username, token } = await login();
		launchedAt = Date.now();
		hide();
		Session.ServerSelectsChar = true;
		WinLogin.onConnectionRequest(username, token);
	};

	const show = () => {
		if (host) return;
		host = document.createElement('div');
		host.id = 'titanro-shell';
		document.body.appendChild(host);
		const mountIn = host;
		import(/* @vite-ignore */ shellUrl)
			.then(module => {
				if (host === mountIn) shell = module.mount(mountIn, { launch });
			})
			.catch(err => {
				console.error('[MasterAccount] could not load the TitanRO shell', err);
				if (host === mountIn) {
					mountIn.style.cssText =
						'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;' +
						'background:#fff;color:#000;font:16px system-ui,sans-serif';
					mountIn.textContent = 'TitanRO couldn’t load; reload the page to try again.';
				}
			});
	};

	show();
	// Back at the login window (a disconnect, or the game's "back to login"): the shell again, once a launched login
	// had its chance.
	setInterval(() => {
		if (!host && WinLogin.__active && Date.now() - launchedAt > LAUNCH_GRACE_MS) show();
	}, 500);
	return true;
}
