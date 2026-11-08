/**
 * MasterAccount Plugin (TitanRO)
 *
 * The play site's front door: the TitanRO launcher's own screens (TitanRO/titanro-launcher's web build, served at
 * /shell/titanro-shell.js on the play site) over the game. Players sign in to their master account (Clerk), see their
 * characters, create and delete them, and pick one; the game then logs in to that character's hidden game account
 * with a single-use launch token from the account service, as the desktop launcher's Play does. The login server's
 * launch_token plugin accepts the token, and the char server's master_characters plugin selects the account's
 * character, so there's no login screen, server list or character selection.
 *
 * The shell is imported at runtime (it's built and deployed with the launcher) and lives in its own shadow root over
 * the page; roBrowser loads behind it meanwhile. It's shown whenever the login window would be: on the first load,
 * and again after a disconnect or "back to login". Quick Invite links (?invite=, the Quickstart plugin) skip it.
 *
 * roBrowser asks "Leave site?" before the page unloads (App/Online.js window.onbeforeunload). That's for leaving the
 * game; while the shell is up nobody is in the game, and its sign-in and sign-out leave the page for Clerk, so the
 * question is kept from showing then.
 *
 * Language: the game's client files follow the master account's language. The shell announces it (a `titanro-language`
 * event on window, with the code); the plugin keeps it in localStorage and, for a language other than English, points
 * the remote client at grfhost's `lang/<code>/` (that language's client pack over the release's files) before the game
 * loads anything. A different language announced while the shell is up (on sign-in, or picked in its top bar) reloads
 * the page into it; nobody is in the game then. Server text follows the same setting at the next login.
 *
 * The game's databases (item, skill, job tables...) otherwise load only once a character is picked. The shell
 * announces the language only for a signed-in master account, so from then on, when the browser is idle, they load
 * while the player looks at the characters, and Play goes straight to the map.
 *
 * Config.local.js: plugins: { MasterAccount: { path: 'MasterAccount/MasterAccount',
 *   pars: { shell: '<URL of titanro-shell.js>' } } }
 *
 * @author Trojal
 */

import Configs from 'Core/Configs.js';
import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import WinLogin from 'UI/Components/WinLogin/WinLogin.js';

const DEFAULT_SHELL = '/shell/titanro-shell.js';
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

/** Starts loading the game's databases in the browser's idle time, unless they're loaded or loading. The login window
 * being up means the server (and its packet version) is chosen. */
function preloadDatabases() {
	waitFor(loginReady, 120000)
		.then(() => {
			const start = () => {
				if (DB.isLoaded || DB.startedLazyInit) return;
				DB.startedLazyInit = true;
				DB.lazyInit();
			};
			if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 5000 });
			else setTimeout(start, 1000);
		})
		.catch(() => {});
}

const LANGUAGE_KEY = 'titanro.language';
const LANGUAGE_EVENT = 'titanro-language';
const LANGUAGE_CODE = /^[A-Za-z0-9-]{2,16}$/;

function storedLanguage() {
	try {
		const code = window.localStorage.getItem(LANGUAGE_KEY);
		return code && LANGUAGE_CODE.test(code) ? code : 'en';
	} catch {
		return 'en';
	}
}

/** The language's client files: grfhost's lang/<code>/ (its pack, else the release's file) instead of the release's. */
function useLanguage(code) {
	const remoteClient = Configs.get('remoteClient');
	if (code !== 'en' && remoteClient) {
		Configs.set('remoteClient', remoteClient.replace(/\/?$/, '/') + `lang/${code}/`);
	}
}

export default function Init(params) {
	const language = storedLanguage();
	useLanguage(language);

	if (new URLSearchParams(window.location.search).has('invite')) {
		return true;
	}

	const shellUrl = (params && params.shell) || DEFAULT_SHELL;
	let host = null;
	let shell = null;
	let launchedAt = 0;
	let gameUnload = null;

	// roBrowser's question goes away while the shell is up (Online.js may set it just after this plugin starts, so
	// it's checked again with the shell's poll) and comes back for the game.
	const quietUnload = () => {
		if (window.onbeforeunload) {
			gameUnload = window.onbeforeunload;
			window.onbeforeunload = null;
		}
	};
	const restoreUnload = () => {
		if (gameUnload && !window.onbeforeunload) window.onbeforeunload = gameUnload;
	};

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
		restoreUnload();
		Session.ServerSelectsChar = true;
		WinLogin.onConnectionRequest(username, token);
	};

	const show = () => {
		quietUnload();
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

	// The account's language, from the shell: kept for the next load, and loaded now if it isn't this page's.
	window.addEventListener(LANGUAGE_EVENT, event => {
		const code = event.detail;
		if (typeof code !== 'string' || !LANGUAGE_CODE.test(code)) return;
		try {
			window.localStorage.setItem(LANGUAGE_KEY, code);
		} catch {
			return; // without storage the reload would come back in the same language
		}
		if (code !== language && host) {
			quietUnload();
			window.location.reload();
			return;
		}
		preloadDatabases();
	});

	show();
	setTimeout(quietUnload, 0);
	// Back at the login window (a disconnect, or the game's "back to login"): the shell again, once a launched login
	// had its chance.
	setInterval(() => {
		if (host) quietUnload();
		if (!host && WinLogin.__active && Date.now() - launchedAt > LAUNCH_GRACE_MS) show();
	}, 500);
	return true;
}
