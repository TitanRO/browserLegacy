/**
 * TitanRO configuration (replaces our old custom index.html).
 *
 * The build generates index.html and Config.js (window.ROConfigBase, upstream defaults); index.html then loads this
 * file and deep-merges window.ROConfigLocal over those defaults (objects merge key by key, arrays like `servers` are
 * replaced). The Dockerfile copies it next to index.html. See applications/pwa/Config.local.js.example.
 */
document.title = 'TitanRO2';

window.ROConfigLocal = {
	development: false,
	remoteClient: 'https://grf.titanro.net/',
	servers: [
		{
			display: 'TitanRO2',
			desc: 'TitanRO2 test server',
			address: 'play.titanro.net',
			port: 6901,
			version: 46,
			langtype: 1,
			packetver: 20250716,
			renewal: true,
			// Connect straight to the game servers: the edge routes wss://ws.titanro.net/login, /char and /map to those
			// servers, which accept WebSocket clients themselves (client_transport plugin).
			socketUrl: 'wss://ws.titanro.net/{role}',
			// 2021-09 and newer kRO clients send packet ids unencrypted (Hercules: all-zero keys); roBrowser's key table
			// ends in 2018 and would encrypt with that year's keys.
			packetKeys: false
		}
	],
	packetDump: false,
	skipServerList: true,
	skipIntro: true,
	clientVersionMode: 'PacketVer',
	plugins: {
		DefaultSettings: 'DefaultSettings/DefaultSettings',
		// The launcher's screens over the game: master account sign-in, characters, create/delete, and Play straight
		// into the game (TitanRO/titanro-launcher's web build).
		MasterAccount: {
			path: 'MasterAccount/MasterAccount',
			pars: { shell: '/shell/titanro-shell.js' }
		},
		// Quick Invite links (?invite=<code>): invite details from titanro-api, the guest login from the account service.
		Quickstart: {
			path: 'Quickstart/Quickstart',
			pars: { api: 'https://api.titanro.net/graphql', accountApi: 'https://account-api.titanro.net' }
		},
		// <URL> chat links (clif_format_url, e.g. the @quickinvite link) as links opening a new tab.
		ChatUrlLinks: 'ChatUrlLinks/ChatUrlLinks'
		// ServiceWorker: 'ServiceWorker/ServiceWorker', // not ported to this branch yet
	},
	clientHash: null,
	enableCashShop: false,
	enableBank: false,
	enableMapName: false,
	enableRefineUI: false,
	enableDmgSuffix: false,
	enableCheckAttendance: false,
	enableAchievements: true,
	enableHomunAutoFeed: true,
	CameraMaxZoomOut: 5,
	loadLua: true,
	enableConsole: true
};
