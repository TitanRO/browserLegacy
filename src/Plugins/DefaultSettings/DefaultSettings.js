/**
 * DefaultSettings Plugin
 *
 * Framework to override default settings for ROBrowser without modifying the code.
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 *
 * @author Trojal
 */
define(function( require )
{
    // Dependencies
    var Preferences = require('Core/Preferences');
	var Audio = require('Preferences/Audio');
	var Map = require('Preferences/Map');

	return function Init(){
        const customAudio = Preferences.get( 'Audio', {
            BGM:   {
                volume: 0.1 // Defaults to 0.5
            },
            Sound: {
                volume: 0.1 // Defaults to 0.5
            }
        }, 1.0 );
        Audio.BGM.volume = customAudio.BGM.volume;
        Audio.Sound.volume = customAudio.Sound.volume;

        const customMap = Preferences.get( 'Map', {
            fog: false // Defaults to true
        }, 1.1 );
        Map.fog = customMap.fog;

        // Return true to signal successful initialization
		return true;
	}
});
