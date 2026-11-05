/**
 * DefaultSettings Plugin
 *
 * Framework to override default ROBrowser settings without modifying the source.
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 *
 * @author Trojal
 */

// Dependencies
import Preferences from 'Core/Preferences.js';
import Audio from 'Preferences/Audio.js';
import BGM from 'Audio/BGM.js';
import SoundManager from 'Audio/SoundManager.js';
import Map from 'Preferences/Map.js';

export default function Init() {
	// Audio preferences
	const customAudio = Preferences.get(
		'Audio',
		{
			BGM: {
				volume: 0.1 // Defaults to 0.5
			},
			Sound: {
				volume: 0.1 // Defaults to 0.5
			}
		},
		1.0
	);
	// BGM and SoundManager copy the volume from Preferences when their modules load, before plugins run, so
	// setting Audio.*.volume alone only moves the sliders; their setters update what actually plays.
	BGM.setVolume(customAudio.BGM.volume);
	SoundManager.setVolume(customAudio.Sound.volume);

	// Map preferences
	const customMap = Preferences.get(
		'Map',
		{
			fog: false // Defaults to true
		},
		1.1
	);
	Map.fog = customMap.fog;

	// Return true to signal successful initialization
	return true;
}
