/**
 * UI/Components/PartyFriends/PartyHelper.js
 *
 * Helper for the PartyFriends window child (to manage party creation, invitation and updating settings).
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
	var UIManager      = require('UI/UIManager');
	var UIComponent    = require('UI/UIComponent');
	var htmlText       = require('text!./PartyHelper.html');
	var cssText        = require('text!./PartyHelper.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var PartyHelper = new UIComponent('PartyHelper', htmlText, cssText );


	/**
	 * @enum Window type constant
	 */
	PartyHelper.Type = {
		CREATE: 0,
		SETUP:  1,
		INVITE: 2
	};


	/**
	 * @var {number} type
	 */
	var _type = PartyHelper.Type.CREATE;


	/**
	 * Initialize the component (event listener, etc.)
	 */
	PartyHelper.init = function init()
	{
		// Avoid drag drop problems
		this.ui.querySelector('.base').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		DOM.addDelegatedEvent(this.ui, 'mousedown', '.off', function(){
			if (PartyHelper.ui.querySelector('.content').classList.contains('disabled')) {
				return;
			}

			var off, on, tmp;

			// Swap elements
			on  = this.parentNode.getElementsByClassName('on')[0];
			off = this;

			on.className =  'off';
			off.className = 'on';

			tmp = on.style.backgroundImage;
			on.style.backgroundImage = off.style.backgroundImage;
			off.style.backgroundImage = tmp;
		});

		DOM.addDelegatedEvent(this.ui, 'click', '.cancel, .close', this.remove.bind(this));
		this.ui.querySelector('.ok').addEventListener('click', onValidate);

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Once append to the DOM, start to position the UI
	 */
	PartyHelper.onAppend = function onAppend()
	{
		var base = UIManager.getComponent('PartyFriends').ui;

		this.ui.querySelector('.setup, .create, .invite').style.display = 'none';
		this.ui.querySelector('.name').value = '';

		DOM.setCss(this.ui, {
			top:  base.style.top,
			left: parseInt(base.style.left, 10) + base.offsetWidth + 10
		});
	};


	/**
	 * Removing the UI from window, save preferences
	 */
	PartyHelper.onRemove = function onRemove()
	{
		this.ui.querySelector('.setup, .create, .invite').style.display = 'none';
		this.ui.querySelector('.name').value = '';
	};


	/**
	 * Initilize type
	 *
	 * @param {number} set window mode
	 */
	PartyHelper.setType = function setType( type )
	{
		this.ui.querySelector('.content').classList.remove('disabled');

		switch (type) {
			case PartyHelper.Type.CREATE:
				this.ui.querySelector('.setup, .invite').style.display = 'none';
				this.ui.querySelector('.create').style.display = '';
				break;

			case PartyHelper.Type.INVITE:
				this.ui.querySelector('.setup, .create').style.display = 'none';
				this.ui.querySelector('.invite').style.display = '';
				break;

			case PartyHelper.Type.SETUP:
				this.ui.querySelector('.create .invite').style.display = 'none';
				this.ui.querySelector('.setup').style.display = '';
				break;
		}

		_type = type;
	};


	/**
	 * Set party settings
	 *
	 * @param {object} options
	 * @param {boolean} is editable ?
	 */
	PartyHelper.setOptions = function setOptions( options, editable )
	{
		function swap(off) {
			var on, tmp;
			on = off.parentNode.querySelector('.on');

			on.className  = 'off';
			off.className = 'on';

			tmp = on.style.backgroundImage;
			on.style.backgroundImage = off.style.backgroundImage;
			off.style.backgroundImage = tmp;
		}

		var list = ['exp_share', 'item_share', 'item_sharing_type'];
		var i, count = list.length;
		var element;

		for (i = 0; i < count; ++i) {
			if (options[list[i]] === undefined)
				continue;

			element = this.ui.querySelector('.' + list[i]).querySelector('.off');

			if (options[list[i]] == element.dataset.value) {
				swap(element);
			}
		}

		if (!editable) {
			this.ui.querySelector('.content').classList.add('disabled');
		}
		else {
			this.ui.querySelector('.content').classList.remove('disabled');
		}
	};


	/**
	 * Get window mode
	 *
	 */
	PartyHelper.getType = function getType()
	{
		return _type;
	};


	/**
	 * Validate the form
	 */
	function onValidate()
	{
		var name, PartyFriends;

		PartyFriends = UIManager.getComponent('PartyFriends');

		switch (_type) {
			case PartyHelper.Type.CREATE:
				name = PartyHelper.ui.querySelector('.content .name').value;
				if (name.length) {
					PartyFriends.onRequestPartyCreation(
						name,
						+PartyHelper.ui.querySelector('.item_share .on').getAttribute('data-value'),
						+PartyHelper.ui.querySelector('.item_sharing_type .on').getAttribute('data-value')
					);
				}
				break;

			case PartyHelper.Type.INVITE:
				name = PartyHelper.ui.querySelector('.content .name').value;
				if (name.length) {
					PartyFriends.onRequestAddingMember(0, name);
				}
				break;

			case PartyHelper.Type.SETUP:
				PartyFriends.onRequestSettingUpdate(
					+PartyHelper.ui.querySelector('.exp_share .on').getAttribute('data-value'),
					+PartyHelper.ui.querySelector('.item_share .on').getAttribute('data-value'),
					+PartyHelper.ui.querySelector('.item_sharing_type .on').getAttribute('data-value')
				);
				break;
		}

		PartyHelper.remove();
	}


	/**
	 * Callbacks to use
	 */
	PartyHelper.onCreate      = function onCreate(){};
	PartyHelper.onInvite      = function onInvite(){};
	PartyHelper.onSetupUpdate = function onSetUpUpdate(){};


	/**
	 * Export
	 */
	return UIManager.addComponent(PartyHelper);
});
