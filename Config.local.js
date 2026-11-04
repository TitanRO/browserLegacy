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
			packetver: 20151029,
			renewal: true,
			forceUseAddress: false,
			socketProxy: 'wss://ws.titanro.net/',
			packetKeys: true
		}
	],
	packetDump: false,
	skipServerList: true,
	skipIntro: true,
	clientVersionMode: 'PacketVer',
	plugins: {
		DefaultSettings: 'DefaultSettings/DefaultSettings'
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
