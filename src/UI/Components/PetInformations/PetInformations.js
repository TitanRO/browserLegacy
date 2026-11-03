/**
 * UI/Components/PetInformations/PetInformations.js
 *
 * Display pet informations
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB                   = require('DB/DBManager');
	var Client               = require('Core/Client');
	var Preferences          = require('Core/Preferences');
	var Renderer             = require('Renderer/Renderer');
	var UIManager            = require('UI/UIManager');
	var UIComponent          = require('UI/UIComponent');
	var htmlText             = require('text!./PetInformations.html');
	var cssText              = require('text!./PetInformations.css');
	var PACKETVER            = require('Network/PacketVerManager');
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var PetInformations = new UIComponent( 'PetInformations', htmlText, cssText );


	/**
	 * @var {Preferences} Window preferences
	 */
	var _preferences = Preferences.get('PetInformations', {
		x:        100,
		y:        200,
		show:     true,
	}, 1.0);

	/**
	 * Auto Feed Flag
	 */
	var petAutoFeeding = 0;

	/**
	 * Initialize component
	 */
	PetInformations.init = function init()
	{
		this.draggable(this.ui.querySelector('.titlebar'));

		this.ui.querySelector('.base').addEventListener('mousedown', stopPropagation);
		this.ui.querySelector('.close').addEventListener('click', onClose);
		this.ui.querySelector('.modify').addEventListener('click', onChangeName);
		this.ui.querySelector('.command').addEventListener('change', onCommandSelected);
		this.ui.querySelector('.pet_auto_feed').addEventListener('mousedown', petToggleAutoFeed);

		if (!_preferences.show) {
			DOM.hide(this.ui);
		}

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});
	};

	PetInformations.onAppend = function onAppend() {
		Client.loadFile( DB.INTERFACE_PATH + 'checkbox_' + (petAutoFeeding ? '1' : '0') + '.bmp', function(data){
			PetInformations.ui.querySelector('.pet_auto_feed').style.backgroundImage = 'url(' + data + ')';
		});
		if(PACKETVER.value < 20141008)
			PetInformations.ui.querySelector('.feeding').style.display = 'none';

    }

	/**
	 * Once remove from body, save user preferences
	 */
	PetInformations.onRemove = function onRemove()
	{
		// Save preferences
		_preferences.show   =  DOM.isVisible(this.ui);
		_preferences.y      =  parseInt(this.ui.style.top, 10);
		_preferences.x      =  parseInt(this.ui.style.left, 10);
		_preferences.save();
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	PetInformations.onShortCut = function onShortCut( key )
	{
		// Not in body
		if (!this.ui) {
			return;
		}

		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				if (DOM.isVisible(this.ui)) {
					this.focus();
				}
				break;
		}
	};


	/**
	 * Update UI
	 *
	 * @param {object} pet info
	 */
	PetInformations.setInformations = function setInformations(info)
	{
		this.ui.querySelector('.name').value = info.szName;
		this.ui.querySelector('.level').textContent = info.nLevel;

		this.setHunger(info.nFullness);
		this.setIntimacy(info.nRelationship);

		this.ui.querySelector('.accessory').textContent = DB.getMessage(info.ITID ? 598 : 600);

		Client.loadFile( DB.getPetIllustPath(info.job), function(data){
			this.ui.querySelector('.content').style.backgroundImage = 'url('+ data +')';
		}.bind(this));

		if (!info.bModified) {
			this.ui.querySelector('.name, .modify').classList.remove('disabled').setAttribute('disabled', false);
		}
		else {
			this.ui.querySelector('.name, .modify').classList.add('disabled').setAttribute('disabled', true);
		}
	};


	/**
	 * Set intimacy
	 *
	 * @param {number} intimacy
	 */
	PetInformations.setIntimacy = function setIntimacy(val)
	{
		this.ui.querySelector('.intimacy').textContent = DB.getMessage(
			val < 100 ? 672 :
			val < 250 ? 673 :
			val < 600 ? 669 :
			val < 900 ? 674 :
			675
		);
	};

	PetInformations.setFeedConfig = function setFeedConfig(flag)
	{
		petAutoFeeding = flag;

		 // server sent this info before of pet
		if(PetInformations.ui) {
			Client.loadFile( DB.INTERFACE_PATH + 'checkbox_' + (petAutoFeeding ? '1' : '0') + '.bmp', function(data){
				PetInformations.ui.querySelector('.pet_auto_feed').style.backgroundImage = 'url(' + data + ')';
			});
		}
	}

	/**
	 * Set hunger value
	 *
	 * @param {number} hunger
	 */
	PetInformations.setHunger = function setHunger(val)
	{
		this.ui.querySelector('.hunger').textContent = DB.getMessage(
			val < 10 ? 667 :
			val < 25 ? 668 :
			val < 75 ? 669 :
			val < 90 ? 670 :
			671
		);
	};


	/**
	 * User just execute a command
	 */
	function onCommandSelected()
	{
		switch (this.value) {
			case 'feed':
				PetInformations.reqPetFeed();
				break;

			case 'action':
				PetInformations.reqPetAction();
				break;

			case 'release':
				PetInformations.reqBackToEgg();
				break;

			case 'unequip':
				PetInformations.reqUnEquipPet();
				break;

			default:
		}

		this.value = 'default';
	}


	/**
	 * Toggle Auto Feed
	 */
	function petToggleAutoFeed()
	{
		PetInformations.onConfigUpdate( 2, !petAutoFeeding ? 1 : 0 );
	}


	/**
	 * Request to modify pet's name
	 */
	function onChangeName()
	{
		var input = PetInformations.ui.querySelector('.name');
		PetInformations.reqNameEdit( input.value );
	}


	/**
	 * Closing window
	 */
	function onClose()
	{
		PetInformations.ui.style.display = 'none';
	}


	/**
	 * Stop event propagation
	 */
	function stopPropagation( event )
	{
		event.stopImmediatePropagation();
		return false;
	}


	/**
	 * Functions defined in Engine/MapEngine/Pet.js
	 */
	PetInformations.reqPetFeed    = function reqPetFeed(){};
	PetInformations.reqPetAction  = function reqPetAction(){};
	PetInformations.reqNameEdit   = function reqNameEdit(){};
	PetInformations.reqUnEquipPet = function reqUnEquipPet(){};
	PetInformations.reqBackToEgg  = function reqBackToEgg(){};
	PetInformations.onConfigUpdate = function onConfigUpdate(/* type, value*/){};


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(PetInformations);
});
