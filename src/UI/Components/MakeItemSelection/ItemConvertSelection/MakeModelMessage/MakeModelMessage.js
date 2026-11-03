/**
 * UI/Components/MakeItemSelection/ItemConvertSelection/MakeModelMessage/MakeModelMessage.js
 *
 * MakeModelMessage windows
 *
 * @author Francisco Wallison
 */
 define(function(require)
 {
     'use strict';
 
 
     /**
      * Dependencies
      */
     var Renderer    = require('Renderer/Renderer');
     var UIManager   = require('UI/UIManager');
     var UIComponent = require('UI/UIComponent');
     var htmlText    = require('text!./MakeModelMessage.html');
     var cssText     = require('text!./MakeModelMessage.css');
     var DOM         = require('Utils/DOM');
     var getModule   = require;

     /**
      * Create MakeModelMessage namespace
      */
     var MakeModelMessage = new UIComponent( 'MakeModelMessage', htmlText, cssText );
      
     /**
      * Initialize UI
      */
    MakeModelMessage.init = function init()
    {
        // Show at center.
        DOM.setCss(this.ui, {
            top:  (Renderer.height- 200)/2,
            left: (Renderer.width - 200)/2
        });

        this.ui.querySelector('.ok').addEventListener('click', onSendMaterial); 
        this.ui.querySelector('.cancel').addEventListener('click', onClose);

        this.draggable(this.ui.querySelector('.titlebar'));
    };

    function onSendMaterial(event){
        event.stopImmediatePropagation();
        getModule('UI/Components/MakeItemSelection/ItemConvertSelection/ConvertItems')
            .validItemSend(true);

    }

    function onClose(event){
		event.stopImmediatePropagation();
		getModule('UI/Components/MakeItemSelection/ItemConvertSelection/ConvertItems')
            .validItemSend(false);
	}

    /**
     * Create component based on view file and export it
     */
    return UIManager.addComponent(MakeModelMessage);
 });
 
