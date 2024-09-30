/**
 * TranslateMsgstringtable Plugin
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 *
 * @author Trojal
 */
define(function( require )
{
    // Dependencies
    var DB = require('DB/DBManager');

	var MsgStringTable_tr;

    const default_lang = ['en'];
    // List of desired languages (requires matching msgstringtable_LANG.txt for each LANG)
    const lang_list = ['br'];
    // const lang_list = ['br', 'ja'];

    return function Init(){
        // Already loaded.
        if (DB.TranslateMsgstringtableEnabled) {
            return true;
        }

        MsgStringTable_tr[default_lang] = DB.MsgStringTable;
        lang_list.forEach(lang => {
            MsgStringTable_tr[lang] = [];
        });

        const defaultInit = DB.Init;
        DB.Init = function() {
            defaultInit.apply(this, arguments);
            // TODO: Not sure if this works as expected in a plugin, but see if it breaks anything.
            var index = 0, count = 0;
            function onLoad(){
                count++;
                return function OnLoadClosure(){
                    index++;

                    if (DB.onProgress) {
                        DB.onProgress(index, count);
                    }

                    if (index === count && DB.onReady) {
                        DB.onReady();
                    }
                };
            }
            lang_list.forEach(lang => {
                DB.loadTable( 'data/msgstringtable_' + lang + '.txt', '#', 1, function(index, val){ MsgStringTable_tr[lang][index] = val;}, onLoad());
            });
        }

        //DB.getMessage = function getMessage(id, defaultText, lang=default_lang)
        DB.getMessage = function getMessage(id, defaultText, lang='br')
        {
            if (!(id in MsgStringTable_tr[lang])) {
                return defaultText !== undefined ? defaultText : 'NO MSG ' + id;
            }

            return TextEncoding.decodeString( MsgStringTable_tr[lang][id] );
        };

        // Record plugin as enabled.
        DB.TranslateMsgstringtableEnabled = true;

        // Return true to signal successful initialization
        return true;
    }
});
