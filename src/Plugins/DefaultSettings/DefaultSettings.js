define(function( require )
{
    var Preferences = require('Core/Preferences');
	var Audio = require('Preferences/Audio');
	var Map = require('Preferences/Map');

	return function Init(){
        const customAudio = Preferences.get( 'Audio', {
            BGM:   {
                volume: 0.1 // 0.5
            },
            Sound: {
                volume: 0.1 // 0.5
            }
        }, 1.0 );
        Audio.BGM.volume = customAudio.BGM.volume;
        Audio.Sound.volume = customAudio.Sound.volume;

        const customMap = Preferences.get( 'Map', {
            fog: false // true
        }, 1.1 );
        Map.fog = customMap.fog;

		return true;
	}
});
