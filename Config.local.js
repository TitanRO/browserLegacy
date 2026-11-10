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
			// Connect straight to the game servers: the edge routes wss://ws.titanro.net/login/6901, /char/6122 and
			// /map/<port> (one path per map server, by the port it announces) to those servers, which accept
			// WebSocket clients themselves (client_transport plugin).
			socketUrl: 'wss://ws.titanro.net/{role}/{port}',
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
		// Built-in game helpers: packet events, zone signal, helper panels, asset swaps, and the master account's helper
		// settings from the account service (shared with the launcher and the Windows client).
		Helpers: {
			path: 'Helpers/Helpers',
			pars: { accountApi: 'https://account-api.titanro.net' }
		},
		// <URL> chat links (clif_format_url, e.g. the @quickinvite link) as links opening a new tab.
		ChatUrlLinks: 'ChatUrlLinks/ChatUrlLinks'
		// ServiceWorker: 'ServiceWorker/ServiceWorker', // not ported to this branch yet
	},
	clientHash: null,
	enableCashShop: false,
	enableBank: false,
	enableMapName: true,
	enableRefineUI: false,
	enableDmgSuffix: false,
	enableCheckAttendance: false,
	enableAchievements: true,
	enableHomunAutoFeed: true,
	CameraMaxZoomOut: 5,
	loadLua: true,
	// The client's own item names (ROenglishRE SystemEN/itemInfo.lua: the official table, itemInfo_C.lua's custom items),
	// as the Windows client reads them (grf.titanro.net serves SystemEN/, and /lang/<code>/ a language pack's copy).
	customItemInfo: ['SystemEN/itemInfo.lua'],
	enableConsole: true
};
