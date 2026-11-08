/**
 * When the char server selects the character itself (Session.ServerSelectsChar: the play site's master account
 * login, Quick Invite), the char list is shown only if no selection follows. A selection that came keeps the loading
 * window up while the databases load, however long that takes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	handlers: {},
	db: { isLoaded: false, startedLazyInit: false, lazyInit: vi.fn() },
	network: {
		expectClose: vi.fn(),
		setPing: vi.fn(),
		connect: vi.fn((_ip, _port, cb) => cb(true)),
		sendPacket: vi.fn(),
		read: vi.fn(),
		hookPacket: vi.fn((struct, cb) => {
			mocks.handlers[struct] = cb;
		}),
		utils: { longToIP: () => '127.0.0.1' }
	},
	mapEngine: { init: vi.fn() },
	session: {},
	charSelect: { append: vi.fn(), setInfo: vi.fn(), addCharacter: vi.fn(), __active: false },
	component: { remove: vi.fn(), append: vi.fn(), resetState: vi.fn(), __active: true }
}));

vi.mock('DB/DBManager.js', () => ({ default: mocks.db }));
vi.mock('Core/Configs.js', () => ({ default: { get: (_k, d) => d, getServer: () => ({}) } }));
vi.mock('Core/Events.js', () => ({ default: {} }));
vi.mock('Audio/SoundManager.js', () => ({ default: {} }));
vi.mock('Audio/BGM.js', () => ({ default: { play: vi.fn() } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: mocks.session }));
vi.mock('Engine/MapEngine.js', () => ({ default: mocks.mapEngine }));
vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20180704 } }));
vi.mock('Network/PacketStructure.js', () => ({
	default: new Proxy(
		{},
		{
			get: (_t, ns) =>
				new Proxy(
					{},
					{
						get: (_n, name) => {
							const Struct = function () {};
							Struct.toString = () => `${String(ns)}.${String(name)}`;
							return Struct;
						}
					}
				)
		}
	)
}));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), getComponent: () => mocks.component } }));
vi.mock('UI/UIVersionManager.js', () => ({ default: { selectAllChar: vi.fn() } }));
vi.mock('UI/Background.js', () => ({ default: {} }));
vi.mock('UI/Components/PincodeWindow/PincodeWindow.js', () => ({ default: {} }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: {} }));
vi.mock('UI/Components/JoystickUI/JoystickUI.js', () => ({ default: { onRestore: vi.fn() } }));
vi.mock('UI/Components/CharSelect/CharSelect.js', () => ({ default: mocks.charSelect }));
vi.mock('UI/Components/CharCreate/CharCreate.js', () => ({ default: {} }));
vi.mock('Renderer/Entity/Player.js', () => ({ default: function Player(c) { Object.assign(this, c); } }));

const CharEngine = (await import('Engine/CharEngine.js')).default;

describe('CharEngine when the char server selects the character', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.db.isLoaded = false;
		mocks.db.startedLazyInit = false;
	});

	it('keeps the loading window, not the char list, while the databases load after the selection', () => {
		vi.useFakeTimers();
		CharEngine.init({ ip: 0, port: 6121 });
		mocks.session.ServerSelectsChar = true;
		mocks.handlers['HC.ACCEPT_ENTER_NEO_UNION']({ charInfo: [{ GID: 7, name: 'Hero' }] });
		mocks.handlers['HC.NOTIFY_ZONESVR']({ GID: 7, addr: { ip: 0, port: 5121 }, mapName: 'prontera.gat' });

		vi.advanceTimersByTime(20000);
		expect(mocks.charSelect.append).not.toHaveBeenCalled();
		expect(mocks.mapEngine.init).not.toHaveBeenCalled();

		mocks.db.isLoaded = true;
		vi.advanceTimersByTime(100);
		vi.useRealTimers();
		expect(mocks.charSelect.append).not.toHaveBeenCalled();
		expect(mocks.mapEngine.init).toHaveBeenCalledWith(0, 5121, 'prontera.gat');
	});

	it('shows the char list when no selection follows', () => {
		vi.useFakeTimers();
		CharEngine.init({ ip: 0, port: 6121 });
		mocks.session.ServerSelectsChar = true;
		mocks.handlers['HC.ACCEPT_ENTER_NEO_UNION']({ charInfo: [{ GID: 7, name: 'Hero' }] });

		vi.advanceTimersByTime(6000);
		vi.useRealTimers();
		expect(mocks.charSelect.append).toHaveBeenCalledOnce();
	});
});
