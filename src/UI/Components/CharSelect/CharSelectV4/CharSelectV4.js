/**
 * UI/Components/CharSelect/CharSelect.js
 *
 * Chararacter Selection windows
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
    'use strict';


    /**
     * Dependencies
     */
    var DB                 = require('DB/DBManager');
    var DOM                = require('Utils/DOM');
    var MonsterTable       = require('DB/Monsters/MonsterTable');
    var Preferences        = require('Core/Preferences');
    var KEYS               = require('Controls/KeyEventHandler');
    var Renderer           = require('Renderer/Renderer');
    var Entity             = require('Renderer/Entity/Entity');
    var SpriteRenderer     = require('Renderer/SpriteRenderer');
    var Camera             = require('Renderer/Camera');
    var UIManager          = require('UI/UIManager');
    var UIComponent        = require('UI/UIComponent');
    var htmlText           = require('text!./CharSelectV4.html');
    var cssText            = require('text!./CharSelectV4.css');
    var Client             = require('Core/Client');


    /**
     * Create Chararacter Selection namespace
     */
    var CharSelectV4 = new UIComponent( 'CharSelectV4', htmlText, cssText );


    function qs(selector)
    {
        return DOM.qs(CharSelectV4.ui, selector);
    }


    function qsa(selector)
    {
        return DOM.qsa(CharSelectV4.ui, selector);
    }


    function setText(el, value)
    {
        if (el) {
            el.textContent = value;
        }
    }


    /**
     * @var {Preferences} save preferences for the last index
     */
    var _preferences = Preferences.get('CharSelectV4', {
        index: 0
    }, 1.0 );


    /**
     * @var {number} max slots
     */
    var _maxSlots = 15;


    /**
     * var {Array} list of characters
     */
    var _list = [];


    /**
     * @var {Array} list of characters (index by slot)
     */
    var _slots = [];


    /**
     * @var {Array} list of entities (index by slot)
     */
    var _entitySlots = [];


    /**
     * @var {number} selector index
     */
    var _index = 0;


    /**
     * @var {Array} canvas context
     */
    var _ctx = [];


    /**
     * var {number} sex
     */
    var _sex = 0;

    /**
     * var for background change
     */
    var img = 0;
    var _curindex = 0;
    var shouldRunBackgroundChange = false;

    let countdownInterval; // Variable to hold the interval

    /**
     * var {boolean} disable input
     */
    var _disable_UI = false;

    /**
     * Initialize UI
     */
    CharSelectV4.init = function Init()
    {
        var okBtn = qs('.ok');
        var cancelBtn = qs('.cancel');
        var deleteBtn = qs('.delete');
        var cancelDeleteBtn = qs('.canceldelete');
        var finalDeleteBtn = qs('.finaldelete');

        if (okBtn) {
            okBtn.addEventListener('click', connect);
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', cancel);
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', reserve);
        }
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', removedelete);
        }
        if (finalDeleteBtn) {
            finalDeleteBtn.addEventListener('click', suppress);
        }

        var slot;
        for (var s = 0; s < 15; ++s) {
            slot = qs('#slot' + s);
            if (slot) {
                slot.addEventListener('mousedown', genericCanvasDown(s));
            }
        }

        qsa('canvas').forEach(function(canvas) {
            canvas.addEventListener('dblclick', function() {
                if (_slots[_index]) {
                    connect();
                }
                else {
                    create();
                }
            });
            _ctx.push(canvas.getContext('2d'));
        });

    };


    /**
     * Once append to body
     */
    CharSelectV4.onAppend = function onAppend()
    {
        //_index = _preferences.index;
        if (CharSelectV4.ui) {
            startCountdownInterval();
        }

        moveCursorTo(_index);

        Renderer.render(render);
    };


    /**
     * Stop rendering
     */
    CharSelectV4.onRemove = function onRemove()
    {
        _preferences.index = _index;
        _preferences.save();

        Renderer.stop();
    };


    /**
     * Bind Key events
     *
     * @param {object} event
     */
    CharSelectV4.onKeyDown = function onKeyDown( event )
    {
        switch (event.which) {
            case KEYS.ESCAPE:
                cancel();
                break;

            case KEYS.LEFT:
                moveCursorTo(_index-1 > (_list.length - 1) ? (_list.length - 1) : (_index-1 < 0 ? 0: _index-1));
                break;

            case KEYS.RIGHT:
                moveCursorTo(_index+1 > (_list.length - 1) ? (_list.length - 1) : (_index+1 < 0 ? 0: _index+1));
                break;

            case KEYS.SUPR:
                if (_slots[_index]) {
                    suppress();
                }
                break;

            case KEYS.ENTER:
                if (_slots[_index]) {
                    connect();
                }
                else {
                    create();
                }
                break;

            default:
                return true;
        }

        event.stopImmediatePropagation();
        return false;
    };


    /**
     * Add players to window
     *
     * @param {object} pkt - packet structure
     */
    CharSelectV4.setInfo = function setInfo( pkt )
    {
        _maxSlots           = Math.floor((pkt.TotalSlotNum + pkt.PremiumStartSlot) || 15); // default 9 ?
        _sex                = pkt.sex;
        _slots.length       = 0;
        _entitySlots.length = 0;
        _list.length        = 0;

        if (pkt.charInfo) {
            var i, count = pkt.charInfo.length;
            for (i = 0; i < count; ++i) {
                CharSelectV4.addCharacter( pkt.charInfo[i] );
            }
            updateCharSlot();
        }

        moveCursorTo( _index );
    };

    /**
     * Format delay duration
     */
    function formatDuration(seconds) {
		const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        // Use the msgstringtable
        let formattedDuration = DB.getMessage(3349)
        .replace('%d', `${hours}` )
        .replace('%d', `${minutes}`)
        .replace('%d', `${remainingSeconds}`);

        return formattedDuration;
    }

    /**
     * Countdown for delay in deletion
     */
    function updateAllVisibleCountdowns() {
        if (CharSelectV4.ui) {
            qsa('.timedelete:not(.hidden)').forEach(function(countdownDiv) {
                const deleteReservedDuration = parseInt(countdownDiv.dataset.duration, 10);
                const updatedDuration = Math.max(0, deleteReservedDuration - 1);

                countdownDiv.textContent = formatDuration(updatedDuration);
                if (updatedDuration > 0) {
                    countdownDiv.style.color = "red";
                } else {
                    countdownDiv.style.color = "blue";
                }

                countdownDiv.dataset.duration = updatedDuration.toString();
            });
        }
    }

    /**
    * Start the countdown update interval only when in CharSelectV4 UI
    */
    function startCountdownInterval() {
        if (!countdownInterval) {
            countdownInterval = setInterval(updateAllVisibleCountdowns, 1000);
        }
    }

    /**
     * Stop the countdown update interval
     */
    function stopCountdownInterval() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    /**
     * Result of Request in Deleting the Character
     * 
     * @param {object} pkt - packet structure
     */
    CharSelectV4.reqdeleteAnswer = function ReqDelAnswer ( pkt )
    {
        this.on('keydown');
		var deleteReservedDate = pkt.DeleteReservedDate;
        var result = typeof( pkt.Result ) === 'undefined' ? -1 : pkt.Result;
        var info = _slots[_index];

        switch (result) {
            case 0: // 0: An unknown error has occurred.
                return;

            case 1: // 1: none/success
                var now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
                info.DeleteDate = deleteReservedDate + now;
                requestdelete(_index, deleteReservedDate);
                break;

            case 3: // 3: A database error occurred.
                return;

            case 4: // 4: To delete a character you must withdraw from the guild.
                UIManager.showMessageBox( DB.getMessage(1818), 'ok' );
                break;
            case 5: // 5: To delete a character you must withdraw from the party.
                UIManager.showMessageBox( DB.getMessage(1819), 'ok' );
                break;
            
            default:
                return;
        }
    }
    
    /**
     * When successfully requested for character deletion
     * Update UI and add timer
     */
    function requestdelete ( index, timer )
    {
        // Make it sit
        _entitySlots[index].action = 2;
        //render();

        const countdown = qs('.timedelete.slot' + index);
        if (countdown) {
            countdown.setAttribute('data-duration', timer);
            countdown.classList.remove('hidden');
            countdown.style.display = "block";
        }

        DOM.hide(qs('.delete'));
        DOM.show(qs('.canceldelete'));
        DOM.show(qs('.finaldelete'));
    }

    /**
     * Cancel reservation of character for deletion
     * Update UI and remove timer
     */
    function removedelete ()
    {
        if (_slots[_index]) {
            
            // Delete here as well? Though server should tell us this
            _slots[_index].DeleteDate = 0;

            // Make it stand
            _entitySlots[_index].action = 0;
            render();

            const countdown = qs('.timedelete.slot' + _index);
            if (countdown) {
                countdown.setAttribute('data-duration', 0);
                countdown.classList.add('hidden');
                countdown.style.display = "none";
            }

            DOM.hide(qs('.canceldelete'));
            DOM.hide(qs('.finaldelete'));
            DOM.show(qs('.delete'));

            CharSelectV4.onCancelDeleteRequest(_slots[_index].GID);
        }
    }

    /**
     * Answer from server to delete a character
     *
     * @param {number} error id
     */
    CharSelectV4.deleteAnswer = function DeleteAnswer( error )
    {
        this.on('keydown');

        switch (error) {
            // Do nothing, just re-set the keydown
            case -1:
            case -2:
                return;

            // Success (clean up character)
            case 1:
                delete _slots[_index];
                delete _entitySlots[_index];

                if (_preferences.index === _index)
                    _preferences.index = 0;

                var i = 0;
                var count = _list.length;

                while (i < count) {
                    if (_list[i].CharNum === _index) {
                        _list.splice( i, 1 );
                        --count;
                    }
                    else {
                        i++;
                    }
                }

                moveCursorTo( _index );
                return;

            default: // Others error ?
            case 0:
            case 2: // 2: Due to system settings can not be deleted.
            case 6: // 6: Name does not match.
                UIManager.showMessageBox( DB.getMessage(1821), 'ok' );
                return;
            case 3: // 3: A database error occurred.
                UIManager.showMessageBox( DB.getMessage(1817), 'ok' );
                return;
            case 4: // 4: Deleting not yet possible time.
                UIManager.showMessageBox( DB.getMessage(1820), 'ok' );
                return;
            case 5: // 5: Date of birth do not match.
                UIManager.showMessageBox( DB.getMessage(1822), 'ok' );
                return;
            case 7: // 7: Character Deletion has failed because you have entered an incorrect e-mail address.
                UIManager.showMessageBox( DB.getMessage(301), 'ok' );
                return;
        }
    };


    /**
     * Adding a Character to the list
     *
     * @param {object} character data
     */
    CharSelectV4.addCharacter = function addCharacter( character )
    {
        if (!('sex' in character) || character.sex === 99) {
            character.sex = _sex;
        }

        _list.push( character );
        _slots[ character.CharNum ] = character;
        
        _entitySlots[ character.CharNum ] = new Entity();
        _entitySlots[ character.CharNum ].set( character );
        _entitySlots[ character.CharNum ].hideShadow = true;
        updateCharSlot();
    };
    

    /**
     * Disable or Enable the UI.
     *
     * @param {boolean}
     */
    CharSelectV4.setUIEnabled = function setUIEnabled( value )
    {
        _disable_UI = !value;
    }

    /**
     * Callback to use
     */
    CharSelectV4.onExitRequest    = function onExitRequest(){};
    CharSelectV4.onDeleteRequest  = function onDeleteRequest(){};
    CharSelectV4.onDeleteReqDelay = function onDeleteReqDelay(){};
    CharSelectV4.onCreateRequest  = function onCreateRequest(){};
    CharSelectV4.onConnectRequest = function onConnectRequest(){};
    CharSelectV4.onCancelDeleteRequest = function onCancelDeleteRequest(){};


    /**
     * Generic method to handle mousedown on arrow
     *
     * @param {number} value to move
     */
    function genericCanvasDown( value )
    {
        return function( event ) {
            moveCursorTo( value );
            event.stopImmediatePropagation();
            return false;
        };
    }


    /**
     * Press "cancel" or ESCAPE key
     */
    function cancel()
    {
        if (_disable_UI === false) {
            UIManager.showPromptBox( DB.getMessage(17), 'ok', 'cancel', function(){
                CharSelectV4.onExitRequest();
                updateCharSlot();
            }, null);
            stopCountdownInterval();
        }
    }


    /**
     * Jumping to Character creation window
     */
    function create()
    {
        if (_disable_UI === false) {
            CharSelectV4.onCreateRequest( _index );
        }
    }


    /**
     * Select Player, connect
     */
    function connect() {
        if (_disable_UI === false) {
            if ((_slots[_index]) && (!_slots[_index].DeleteDate)) {
                _preferences.index = _index;
                _preferences.save();
                CharSelectV4.onConnectRequest( _slots[_index] );
                stopCountdownInterval();
            }
        }
    }

    /**
     * Request to delete a character
     */
    function reserve() {
        if (_disable_UI === false) {
            if (_slots[_index]) {
                CharSelectV4.off('keydown');
                CharSelectV4.onDeleteReqDelay( _slots[_index].GID );
            }
        }
    }

    /**
     * Delete a character
     */
    function suppress() {
        if (_disable_UI === false) {
            if (_slots[_index]) {
                CharSelectV4.off('keydown');
                CharSelectV4.onDeleteRequest( _slots[_index].GID );
            }
        }
    }


    /**
     * Move cursor, update window value
     *
     * @param {number} index
     */
    function moveCursorTo( index )
    {
        var charinfo = qs('.charinfo');
        var deleteBtn = qs('.delete');
        var cancelDeleteBtn = qs('.canceldelete');
        var finalDeleteBtn = qs('.finaldelete');
        var okBtn = qs('.ok');

        var entity = _slots[_index];
        var prevIndex = _index;
        shouldRunBackgroundChange = false;

        if (entity) {
            Client.loadFile( DB.INTERFACE_PATH + "select_character_ver3/img_slot_normal.bmp", function(dataURI) {
                DOM.setCss(qs('#slot' + prevIndex), 'backgroundImage', 'url(' + dataURI + ')');
            });
        }

        var slotIndex = _index = index > _maxSlots ? _maxSlots : (index < 0 ? 0: index);

        entity = _slots[_index];
        if (!entity) {
            if (charinfo) {
                DOM.qsa(charinfo, 'div').forEach(function(div) {
                    DOM.empty(div);
                });
            }
            DOM.hide(deleteBtn);
            DOM.hide(cancelDeleteBtn);
            DOM.hide(finalDeleteBtn);
            DOM.hide(okBtn);
            var countdown = qs('.timedelete.slot' + _index);
            if (countdown) {
                countdown.setAttribute('data-duration', 0);
                countdown.classList.add('hidden');
                countdown.style.display = "none";
            }
            return;
        } else {
            _curindex = slotIndex;
            shouldRunBackgroundChange = true;
        }

        if (shouldRunBackgroundChange === true) {
            changeBackgroundEverySecond();
        }

        var info = _slots[_index];
        if (info.DeleteDate) {
            DOM.hide(deleteBtn);
            DOM.show(cancelDeleteBtn);
            DOM.show(finalDeleteBtn);
        } else {
            DOM.hide(cancelDeleteBtn);
            DOM.hide(finalDeleteBtn);
            DOM.show(deleteBtn);
        }

        DOM.show(okBtn);
        
        setText(DOM.qs(charinfo, '.map'), DB.getMapName(info.lastMap, '') || '');
        setText(DOM.qs(charinfo, '.job'), MonsterTable[info.job] || '');
        setText(DOM.qs(charinfo, '.lvl'), info.level);
        setText(DOM.qs(charinfo, '.exp'), info.exp);
        setText(DOM.qs(charinfo, '.hp'), info.hp);
        setText(DOM.qs(charinfo, '.sp'), info.sp);
        setText(DOM.qs(charinfo, '.str'), info.Str);
        setText(DOM.qs(charinfo, '.agi'), info.Agi);
        setText(DOM.qs(charinfo, '.vit'), info.Vit);
        setText(DOM.qs(charinfo, '.int'), info.Int);
        setText(DOM.qs(charinfo, '.dex'), info.Dex);
        setText(DOM.qs(charinfo, '.luk'), info.Luk);
    }

    function changeBackgroundEverySecond() {
        if (CharSelectV4.ui) {
            var backgroundchange = qs('#slot' + _curindex);
            if (backgroundchange && shouldRunBackgroundChange === true) {
                Client.loadFile( DB.INTERFACE_PATH + "select_character_ver3/img_slot_select"+img+".bmp", function(dataURI) {
                    DOM.setCss(backgroundchange, {
                        backgroundImage: 'url(' + dataURI + ')',
                        width: '157px',
                        height: '197px',
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat'
                    });
                });

                img = (img + 1) % 8;
            }
        }
    }

    setInterval(changeBackgroundEverySecond, 150);

    function updateCharSlot(){
        var charCanvases = qsa('.char_canvas');
        var jobIcons = qsa('.job_icon');

        for (let i = 0; i < _maxSlots; ++i) {
            var canvas = charCanvases[i];
            var nameEl = canvas ? DOM.qs(canvas, '.name') : null;
            if (nameEl) {
                nameEl.innerHTML = _slots[i] !== undefined ? _slots[i].name : "";
            }
            if(_slots[i] === undefined){
                const slotNum = i;
                var jobIcon = jobIcons[slotNum];
                if (jobIcon) {
                    DOM.setCss(jobIcon, 'backgroundImage', '');
                }
                var slotEl = qs('#slot' + slotNum);
                if (slotEl) {
                    Client.loadFile( DB.INTERFACE_PATH + "select_character_ver3/img_slot2_normal.bmp", function(dataURI) {
                        DOM.setCss(qs('#slot' + slotNum), 'backgroundImage', 'url(' + dataURI + ')');
                    });
                }
                const countdown = qs('.timedelete.slot' + slotNum);
                if (countdown) {
                    countdown.setAttribute('data-duration', 0);
                    countdown.classList.add('hidden');
                    countdown.style.display = "none";
                }
            }else{
                Client.loadFile( DB.INTERFACE_PATH + "select_character_ver3/img_slot_normal.bmp", function(dataURI) {
                    DOM.setCss(qs('#slot' + i), 'backgroundImage', 'url(' + dataURI + ')');
                });
                
                var slotJobIcon = jobIcons[i];
                
                Client.loadFile( DB.INTERFACE_PATH + "renewalparty/icon_jobs_"+_slots[i].job+".bmp", function(dataURI) {
                    DOM.setCss(slotJobIcon, 'backgroundImage', 'url(' + dataURI + ')');
                });

                if (_slots[i].DeleteDate) {
                    const slotNum = i;
                    const countdown = qs('.timedelete.slot' + slotNum);
                    if (countdown) {
                        countdown.setAttribute('data-duration', _slots[i].DeleteDate);
                        countdown.classList.remove('hidden');
                        countdown.style.display = "block";
                    }
                }
            }
        }
    }


    /**
     * Render sprites to canvas
     */
    function render()
    {
        var i, count, idx;

        Camera.direction = 4;
        idx              = Math.floor(_index / _maxSlots) * _maxSlots;
        count            = _ctx.length;

        for (i = 0; i < count; ++i) {
            _ctx[i].clearRect(0, 0, _ctx[i].canvas.width, _ctx[i].canvas.height);

            if (_entitySlots[idx+i]) {
                SpriteRenderer.bind2DContext(_ctx[i], 78, 157);
                if (_slots[i].DeleteDate)   // Pending for Deletion Characters are sitting
                    _entitySlots[idx+i].action  = 2;
                _entitySlots[idx+i].renderEntity();
            }
        }
    }


    /**
     * Create componentand export it
     */
    return UIManager.addComponent(CharSelectV4);
});
