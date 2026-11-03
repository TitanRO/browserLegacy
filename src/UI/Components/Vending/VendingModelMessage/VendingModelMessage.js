/**
 * UI/Components/Vending/VendingModelMessage/VendingModelMessage.js
 *
 * VendingModelMessage windows
 *
 * @author Francisco Wallison
 */
 define(function(require)
 {
     'use strict';
 
 
     /**
      * Dependencies
      */
     var DB          = require('DB/DBManager');
     var Preferences = require('Core/Preferences');
     var Mouse       = require('Controls/MouseEventHandler');
     var Client      = require('Core/Client');
     var Renderer    = require('Renderer/Renderer');
     var UIManager   = require('UI/UIManager');
     var UIComponent = require('UI/UIComponent');
     var InputBox    = require('UI/Components/InputBox/InputBox');
     var Inventory   = require('UI/Components/Inventory/Inventory');
     var htmlText    = require('text!./VendingModelMessage.html');
     var cssText     = require('text!./VendingModelMessage.css');
     var DOM         = require('Utils/DOM');
     var getModule   = require;

     /**
      * Create VendingModelMessage namespace
      */
     var VendingModelMessage = new UIComponent( 'VendingModelMessage', htmlText, cssText );
      
     /**
      * Initialize UI
      */
     VendingModelMessage.init = function init()
     {
        // Show at center.
        DOM.setCss(this.ui, {
            top:  (Renderer.height- 200)/2,
            left: (Renderer.width - 200)/2
        });

        this.ui.querySelector('.ok').addEventListener('click', function(e){
			e.stopImmediatePropagation();
			VendingModelMessage.onRemove();
		});
        this.draggable(this.ui.querySelector('.titlebar'));
    };

    VendingModelMessage.setInit = function setInit(numMessage)
    {
        VendingModelMessage.append();
        VendingModelMessage.ui.style.display = '';
        let messageText = DB.getMessage(numMessage);
		VendingModelMessage.ui.querySelector('.message').textContent = messageText;
    }

    VendingModelMessage.onRemove = function onRemove()
    {
        if (this.ui == undefined)
            return;
      
        this.ui.style.display = 'none'
    }

    /**
     * Create component based on view file and export it
     */
    return UIManager.addComponent(VendingModelMessage);
 });
 
