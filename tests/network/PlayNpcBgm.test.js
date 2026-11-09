import { describe, it, expect } from 'vitest';
import PACKET from 'Network/PacketStructure.js';
import BinaryReader from 'Utils/BinaryReader.js';

// ZC_PLAY_NPC_BGM: servers from packetver 20220504 send 0x0b8c (length, play type, then the name to the end)
// instead of 0x07fe's fixed 24-byte name. The parser starts past the opcode and the length.
describe('music an NPC or the map server plays', () => {
	it('reads 0x0b8c: the play type, then the name up to its NUL', () => {
		const name = [...'19'].map(c => c.charCodeAt(0));
		const buf = new Uint8Array([1, ...name, 0]).buffer;
		const pkt = new PACKET.ZC.PLAY_NPC_BGM2(new BinaryReader(buf), buf.byteLength);
		expect(pkt.playType).toBe(1);
		expect(pkt.Bgm).toBe('19');
	});

	it('reads 0x07fe: a 24-byte name', () => {
		const bytes = new Uint8Array(24);
		bytes.set([...'40.mp3'].map(c => c.charCodeAt(0)));
		const pkt = new PACKET.ZC.PLAY_NPC_BGM(new BinaryReader(bytes.buffer), 24);
		expect(pkt.Bgm).toBe('40.mp3');
	});
});
