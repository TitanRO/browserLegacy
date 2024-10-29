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
    var DB               = require('DB/DBManager');
    var Client           = require('Core/Client');
    var TextEncoding     = require('Vendors/text-encoding');

	var MsgStringTable_tr = [];

    const default_lang = ['en'];
    // List of desired languages (requires matching msgstringtable_LANG.txt for each LANG)
    const lang_list = ['br'];
    // const lang_list = ['br', 'ja'];

    return function Init(){
        console.log('TranslateMsgstringtable Init() called');
        // Already loaded.
        if (DB.TranslateMsgstringtableEnabled) {
            return true;
        }

        lang_list.forEach(lang => {
            MsgStringTable_tr[lang] = [];
        });

        function loadTable(filename, separator, size, callback)
        {
            Client.loadFile( filename, function(data) {
                console.log('Loading file "'+ filename +'"...');

                // Remove commented lines
                var content  = ('\n' + data).replace(/\n(\/\/[^\n]+)/g, '');
                var elements = content.split(separator);
                var i, count = elements.length;
                var args     = new Array(size+1);

                for (i = 0; i < count; i++) {
                    if (i%size === 0) {
                        if (i) {
                            callback.apply( null, args );
                        }
                        args[i%size] = i;
                    }

                    args[(i%size)+1] = elements[i].replace(/^\s+|\s+$/g, ''); // trim
                }
            });
        }

        const defaultInit = DB.init;
        const customInit = function() {
            defaultInit.apply(this, arguments);

            lang_list.forEach(lang => {
                loadTable( 'data/msgstringtable_' + lang + '.txt', '#', 1, function(index, val){ MsgStringTable_tr['br'][index] = val;});
            });
            // MsgStringTable_tr[default_lang] = DB.MsgStringTable;
        }
        DB.init = customInit;

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
        DB.TranslateMsgstringtableEnabled = true;

        // Return true to signal successful initialization
        return true;
    }
});
