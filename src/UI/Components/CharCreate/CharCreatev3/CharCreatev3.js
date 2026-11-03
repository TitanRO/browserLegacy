/**
 * UI/Components/CharCreatev3/CharCreatev3.js
 *
 * Chararacter Creation windows
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
	var DB           	   = require('DB/DBManager');
	var DOM                = require('Utils/DOM');
	var Renderer           = require('Renderer/Renderer');
	var KEYS               = require('Controls/KeyEventHandler');
	var Entity             = require('Renderer/Entity/Entity');
	var SpriteRenderer     = require('Renderer/SpriteRenderer');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var htmlText           = require('text!./CharCreatev3.html');
	var cssText            = require('text!./CharCreatev3.css');
	var Client             = require('Core/Client');


	/**
	 * Create Chararacter Selection namespace
	 */
	var CharCreatev3 = new UIComponent( 'CharCreatev3', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(CharCreatev3.ui, selector);
	}


	function setFormattedText(el, value)
	{
		DOM.setFormattedText(el, value, DB.getItemInfo.bind(DB));
	}


	const TYPE = {
		RACE:			1,
		GENDER:			2,
		HEAD:			3,
		HEADPALETTE:	4,
		DIRECTION:		5,
		DEFAULT:		-1
	};
	
	const GENDER = {
		FEMALE: 0,
		MALE: 1
	};
	
	const RACE = {
		HUMAN: 0,
		DORAM: 4218
	};
	
	const DIRECTION = {
		LEFT: 1,
		RIGHT: -1
	};
	
	const VALUE = {
		INCREASE: 1,
		DECREASE: -1
	};
	
	const CAP = {
		[RACE.HUMAN]: {
			HEAD: {
				MIN: 1,
				MAX: 29 //42 later value
			},
			HEADPALETTE:{
				MIN: 0,
				MAX: 8
			}
		},
		[RACE.DORAM]: {
			HEAD: {
				MIN: 1,
				MAX: 6 //10 later value
			},
			HEADPALETTE:{
				MIN: 0,
				MAX: 7
			}
		}
	};
	
	const RACE_MARK = DB.INTERFACE_PATH + "make_character/select_mark_cha_create.bmp";


	/**
	 * @var {boolean} account sex
	 */
	var _accountSex = 0;


	/**
	 * @var {object} chargen info
	 */
	var _human = {
		entity: new Entity(),
		ctx:    null,
		render: false,
		tick:   0
	};

	/**
	 * @var {object} doram info
	 */
	var _doram = {
		entity: new Entity(),
		ctx:    null,
		render: false,
		tick:   0
	};

	/**
	 * @var {object} model info
	 */
	var _model = {
		entity: new Entity(),
		ctx:    null,
		render: false,
		tick:   0
	};

	/**
	 * Initialize UI
	 */
	CharCreatev3.init = function init()
	{

		_human.ctx = qs('#canvas_human').getContext('2d');
		_doram.ctx = qs('#canvas_doram').getContext('2d');
		_model.ctx = qs('#canvas_model').getContext('2d');

		// Setup GUI
		DOM.setCss(this.ui, {
			top: (Renderer.height-342)/2 + 'px',
			left: (Renderer.width-576)/2 + 'px'
		});

		this.draggable();

		// Update cursor
		const radioInputs = document.querySelectorAll('input[type="radio"]');
		const labels = document.querySelectorAll('label');

		radioInputs.forEach(input => {
		    input.classList.add('event_add_cursor');
		});

		labels.forEach(label => {
		    label.classList.add('event_add_cursor');
		});

		// Bind Events
		
		qs('.race_select #human').addEventListener('click', function(){ updateCharacter(TYPE.RACE, RACE.HUMAN); });
		qs('.race_select #doram').addEventListener('click', function(){ updateCharacter(TYPE.RACE, RACE.DORAM); });
		
		qs('#style .rot_left').addEventListener('click', function(){ updateCharacter(TYPE.DIRECTION, DIRECTION.LEFT); });
		qs('#style .rot_right').addEventListener('click', function(){ updateCharacter(TYPE.DIRECTION, DIRECTION.RIGHT); });
		
		qs('#style .gender .button.male').addEventListener('click', function(){ updateCharacter(TYPE.GENDER, GENDER.MALE); });
		qs('#style .gender .button.female').addEventListener('click', function(){ updateCharacter(TYPE.GENDER, GENDER.FEMALE); });

		qs('#style .hairstyle .left').addEventListener('click', function(){ updateCharacter(TYPE.HEAD, VALUE.DECREASE); });
		qs('#style .hairstyle .right').addEventListener('click', function(){ updateCharacter(TYPE.HEAD, VALUE.INCREASE); });
		
		qs('#style .haircolor .left').addEventListener('click', function(){ updateCharacter(TYPE.HEADPALETTE, VALUE.DECREASE); });
		qs('#style .haircolor .right').addEventListener('click', function(){ updateCharacter(TYPE.HEADPALETTE, VALUE.INCREASE); });
		

		qs('#char_name').addEventListener('click', function(event){
			this.focus();
			event.stopImmediatePropagation();
		});

		qs('.button.close').addEventListener('click', cancel);
		qs('.button.make').addEventListener('click', create);

		/* Msgstring Texts */
		setFormattedText(qs('.race_select .human .title'), DB.getMessage( 3017 - 1) );
		setFormattedText(qs('.race_select .human .desc'), DB.getMessage( 3021 - 1) );
		setFormattedText(qs('.race_select .human .jobs'), DB.getMessage( 3018 - 1) );

		setFormattedText(qs('.race_select .doram .title'), DB.getMessage( 3019 - 1) );
		setFormattedText(qs('.race_select .doram .desc'), DB.getMessage( 3022 - 1) );
		setFormattedText(qs('.race_select .doram .jobs'), DB.getMessage( 3020 - 1) );
	};

	/**
	 * Setter for AccountSex
	 *
	 * @param {number} sex
	 */
	CharCreatev3.setAccountSex = function setAccountSex( sex )
	{
		_accountSex = sex;
	};

	/**
	 * Once add to HTML, start rendering
	 */
	CharCreatev3.onAppend = function onAppend()
	{
		_human.entity.set({
			sex:	_accountSex,
			job:    RACE.HUMAN,
			head:   1,
			action: 0,
			direction: 5
		});
		_human.render = true;

		_doram.entity.set({
			sex:	_accountSex,
			job:	RACE.DORAM,
			head:	1,
			action:	0,
			direction: 5
		});
		_doram.render = true;

		_model.entity.set({
			sex:	GENDER.MALE,
			job:    RACE.HUMAN,
			head:   1,
			headpalette: 0,
			action: 0,
			direction: 4
		});
		_model.render = true;

		var nameInput = qs('#char_name');
		if (nameInput) {
			nameInput.value = '';
			nameInput.focus();
		}

		// Set default race and gender
		setDefault();
		Renderer.render(render);
		
	};

	/**
	 * Remove component from HTML
	 * Stop rendering
	 */
	CharCreatev3.onRemove = function onRemove()
	{
		Renderer.stop(render);
	};


	/**
	 * Key Handler
	 *
	 * @param {object} event
	 * @return {boolean}
	 */
	CharCreatev3.onKeyDown = function onKeyDown( event )
	{
		if (event.which === KEYS.ESCAPE) {
			event.stopImmediatePropagation();
			cancel();
			return false;
		}

		return true;
	};


	/**
	 * Update model race
	 */
	function updateRace (){
		var select = qs('.race_select .race input.radio:checked');
		var type = TYPE.RACE;
		var race = RACE.HUMAN;
		var marker = DB.INTERFACE_PATH + "make_character/select_mark_cha_create.bmp";

		if (select && select.id === "human") {
			Client.loadFile( marker, function(dataURI) {
				DOM.setCss(qs('.race_select .human label'), 'backgroundImage', 'url(' + dataURI + ')');
            });
			DOM.setCss(qs('.race_select .doram label'), 'backgroundImage', 'none');
			race = RACE.HUMAN;
		}
		
		if (select && select.id === "doram") {
			DOM.setCss(qs('.race_select .human label'), 'backgroundImage', 'none');
			Client.loadFile( marker, function(dataURI) {
				DOM.setCss(qs('.race_select .doram label'), 'backgroundImage', 'url(' + dataURI + ')');
            });
			race = RACE.DORAM;
		}

		updateCharacter( type, race);
	};


	/**
	 * Send back informations to send the packet
	 */
	function create()
	{
		var nameInput = qs('#char_name');

		CharCreatev3.onCharCreationRequest(
			nameInput ? nameInput.value : '',
			1,
			1,
			1,
			1,
			1,
			1,
			_model.entity.head,
			_model.entity.headpalette,
			_model.entity.job,
			_model.entity.sex
		);
	}

	function setDefault()
	{
		updateCharacter(TYPE.DEFAULT,0);
	}

	/**
	 * Exit the window
	 */
	function cancel()
	{
		setDefault();
		CharCreatev3.onExitRequest();
	}


	/**
	 * Update character hairstyle and haircolor
	 *
	 * @param {string} type (head or headpalette)
	 * @param {number} value
	 */
	function updateCharacter( type, value )
	{
		switch (type) {
			case TYPE.GENDER:
				_model.entity.sex = value;
				
				if(_model.entity.sex == GENDER.MALE){
					Client.loadFile( DB.INTERFACE_PATH + "make_character/btn_gender_m_press.bmp", function(dataURI) {
						DOM.setCss(qs('#male_container'), 'backgroundImage', 'url(' + dataURI + ')');
					});
					Client.loadFile( DB.INTERFACE_PATH + "make_character/btn_gender_f_out.bmp", function(dataURI) {
						DOM.setCss(qs('#female_container'), 'backgroundImage', 'url(' + dataURI + ')');
					});
				} else {
					Client.loadFile( DB.INTERFACE_PATH + "make_character/btn_gender_m_out.bmp", function(dataURI) {
						DOM.setCss(qs('#male_container'), 'backgroundImage', 'url(' + dataURI + ')');
					});
					Client.loadFile( DB.INTERFACE_PATH + "make_character/btn_gender_f_press.bmp", function(dataURI) {
						DOM.setCss(qs('#female_container'), 'backgroundImage', 'url(' + dataURI + ')');
					});
				}
				break;

			case TYPE.RACE:
				_model.entity.job = value;
				_model.entity.head = 1;	// Need to reset head as well
				
				if (_model.entity.job === RACE.HUMAN) {
					Client.loadFile( RACE_MARK, function(dataURI) {
						DOM.setCss(qs('.race_select .human label'), 'backgroundImage', 'url(' + dataURI + ')');
					});
					DOM.setCss(qs('.race_select .doram label'), 'backgroundImage', 'none');
				} else {
					DOM.setCss(qs('.race_select .human label'), 'backgroundImage', 'none');
					Client.loadFile( RACE_MARK, function(dataURI) {
						DOM.setCss(qs('.race_select .doram label'), 'backgroundImage', 'url(' + dataURI + ')');
					});
				}
				
				break;

			case TYPE.DIRECTION:
				_model.entity.direction += value;
				break;

			case TYPE.HEAD:
				var tmpval = _model.entity.head+value;
				if (tmpval > CAP[_model.entity.job].HEAD.MAX) tmpval = CAP[_model.entity.job].HEAD.MIN;
				if (tmpval < CAP[_model.entity.job].HEAD.MIN) tmpval = CAP[_model.entity.job].HEAD.MAX;
				_model.entity.head = tmpval;
				break;

			case TYPE.HEADPALETTE:
				var tmpval = _model.entity.headpalette+value;
				if (tmpval > CAP[_model.entity.job].HEADPALETTE.MAX) tmpval = CAP[_model.entity.job].HEADPALETTE.MIN;
				if (tmpval < CAP[_model.entity.job].HEADPALETTE.MIN) tmpval = CAP[_model.entity.job].HEADPALETTE.MAX;
				_model.entity.headpalette = tmpval;
				break;

			case TYPE.DEFAULT:
				updateCharacter(TYPE.RACE, RACE.HUMAN);
				updateCharacter(TYPE.GENDER, GENDER.MALE);
				_model.entity.headpalette = 0;
				break;

		}
	}

	/**
	 * Rendering the Character
	 */
	function render( tick )
	{

		if (_model.entity.job === RACE.HUMAN) {
			if (_human.tick + 500 < tick) {
				_human.entity.set({
					action: 1,
					direction: 5
				});
				_human.tick = tick;
			}
		}

		// Rendering
		SpriteRenderer.bind2DContext(_human.ctx, 32, 115);
		_human.ctx.clearRect(0, 0, _human.ctx.canvas.width, _human.ctx.canvas.height );
		_human.entity.renderEntity();

		if (_model.entity.job === RACE.DORAM) {
			if (_doram.tick + 500 < tick) {
				_doram.entity.set({
					action: 1,
					direction: 5
				});
				_doram.tick = tick;
			}
		}

		// Rendering
		SpriteRenderer.bind2DContext(_doram.ctx, 32, 115);
		_doram.ctx.clearRect(0, 0, _doram.ctx.canvas.width, _doram.ctx.canvas.height );
		_doram.entity.renderEntity();

		// Render the model
		SpriteRenderer.bind2DContext(_model.ctx, 32, 115);
		_model.ctx.clearRect(0, 0, _model.ctx.canvas.width, _model.ctx.canvas.height );
		_model.entity.renderEntity();
	
		// Need this to persist, rendering resets them?
		var nameInput = qs('#char_name');
		if (nameInput) {
			nameInput.focus();
		}
	}


	/**
	 * Callback to define
	 */
	CharCreatev3.onExitRequest = function OnExitRequest(){};


	/**
	 * Abstract callback to define
	 */
	CharCreatev3.onCharCreationRequest = function OnCharCreationRequest(){};

	/**
	 * Create componentand export it
	 */
	return UIManager.addComponent(CharCreatev3);
});
