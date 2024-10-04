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
    var Engine = require('Engine/GameEngine');
	var Queue       = require('Utils/Queue');

	var MsgStringTable_tr = [];

    const default_lang = ['en'];
    // List of desired languages (requires matching msgstringtable_LANG.txt for each LANG)
    const lang_list = ['br'];
    // const lang_list = ['br', 'ja'];

    return function Init(){
        console.log('TranslateMsgstringtable Init() called');
        // Already loaded.
        // if (DB.TranslateMsgstringtableEnabled) {
        //     return true;
        // }

        lang_list.forEach(lang => {
            MsgStringTable_tr[lang] = [];
        });

        const defaultLoadFiles = Engine.loadFiles;
        const customLoadFiles = function(callback) {
            console.log('TranslateMsgstringtable customLoadFiles() called');
            defaultLoadFiles.apply(this, arguments);

            lang_list.forEach(lang => {
                DB.loadTable( 'data/msgstringtable_br.txt', '#', 1, function(index, val){ MsgStringTable_tr['br'][index] = val;}, function(){});
            });
        }
        Engine.loadFiles = customLoadFiles;

        const defaultInit = DB.Init;
        const customInit = function() {
            console.log('TranslateMsgstringtable customInit() called');
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
                DB.loadTable( 'data/msgstringtable_' + lang + '.txt', '#', 1, function(index, val){ MsgStringTable_tr['br'][index] = val;}, onLoad());
            });
            // MsgStringTable_tr[default_lang] = DB.MsgStringTable;
        }
        DB.Init = customInit;

        const defaultGetMessage = DB.getMessage;
        //DB.getMessage = function getMessage(id, defaultText, lang=undefined)
        const customGetMessage = function getMessage(id, defaultText, lang='br')
        {
            console.log('TranslateMsgstringtable customGetMessage() called');
            if (lang === undefined) {
                return defaultGetMessage.apply(this, arguments);
            }

            if (!(id in MsgStringTable_tr[lang])) {
                return defaultText !== undefined ? defaultText : 'NO MSG ' + id;
            }

            return TextEncoding.decodeString( MsgStringTable_tr[lang][id] );
        };
        DB.getMessage = customGetMessage;

        // Record plugin as enabled.
        // DB.TranslateMsgstringtableEnabled = true;

        // Return true to signal successful initialization
        return true;
    }
});
