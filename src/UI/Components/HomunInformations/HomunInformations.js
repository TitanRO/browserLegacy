/**
 * UI/Components/HomunInformations/HomunInformations.js
 *
 * Display homunculus informations
 *
 * @author IssID
 */
define(function (require) {
    'use strict';


    /**
     * Dependencies
     */
    var DB = require('DB/DBManager');
    var Client = require('Core/Client');
    var Preferences = require('Core/Preferences');
    var Renderer = require('Renderer/Renderer');
    var EntityManager = require('Renderer/EntityManager');
    var UIManager = require('UI/UIManager');
    var UIComponent = require('UI/UIComponent');
    var SkillListMH = require('UI/Components/SkillListMH/SkillListMH');
    var htmlText = require('text!./HomunInformations.html');
    var cssText = require('text!./HomunInformations.css');
    var DOM = require('Utils/DOM');
    var Session = require('Engine/SessionStorage');
    var AIDriver = require('Core/AIDriver');
    var Configs = require('Core/Configs');
    var PACKETVER = require('Network/PacketVerManager');

    var autoFeedInterval;
    var autoFeedIntervalMs = 1000 * 60 * 1; // feed every 1 minutes when auto feed is enabled
    var autoFeedPercent = 30;

    /**
     * Create Component
     */
    var HomunInformations = new UIComponent('HomunInformations', htmlText, cssText);

    /**
     * @var {Preferences} Window preferences (localStorage)
     */
    var _preferences = Preferences.get('HomunInformations', {
        x: 100,
        y: 200,
        show: false,
        autoFeed: 0,
    }, 1.0);

    /**
     * Initialize component
     */
    HomunInformations.init = function init() {
        this.draggable(this.ui.querySelector('.content'));

        this.ui.querySelector('.base').addEventListener('mousedown', stopPropagation);
        this.ui.querySelector('.close').addEventListener('click', onClose);
        this.ui.querySelector('.modify').addEventListener('click', onChangeName);
        this.ui.querySelector('.feed').addEventListener('click', onFeed);
        this.ui.querySelector('.del').addEventListener('click', onDelete);
        this.ui.querySelector('.homun_auto_feed').addEventListener('click', homunToggleAutoFeed);

        if (!_preferences.show) {
            DOM.hide(this.ui);
        }

        DOM.setCss(this.ui, {
            top: Math.min(Math.max(0, _preferences.y), Renderer.height - this.ui.offsetHeight),
            left: Math.min(Math.max(0, _preferences.x), Renderer.width - this.ui.offsetWidth)
        });

        this.ui.querySelector('.skill').addEventListener('mousedown', function () {
            SkillListMH.homunculus.toggle()
        });

        // If no aggressive level defined, default to 1
        // otherwise toggle and untoggle to remain the same
        this.toggleAggressive();
        this.toggleAggressive();
    };

    HomunInformations.onAppend = function onAppend() {
        Client.loadFile(DB.INTERFACE_PATH + 'checkbox_' + (_preferences.autoFeed ? '1' : '0') + '.bmp', function (data) {
            HomunInformations.ui.querySelector('.homun_auto_feed').style.backgroundImage = 'url(' + data + ')';
        });

        if (PACKETVER.value < 20170920) {
            if (Configs.get('enableHomunAutoFeed', false)) {
                // added support to autofeed for older clients with setInterval
                HomunInformations.startAutoFeed();
            } else {
                HomunInformations.ui.querySelector('.feeding').style.display = 'none';
            }
        }
    }

    // feed homunculus every 1 minutes when enableHomunAutoFeed is enabled
    HomunInformations.startAutoFeed = function startAutoFeed() {
        window.clearInterval(autoFeedInterval);
        // feed every 1 minutes (default value). No zero value
        autoFeedInterval = window.setInterval(autoFeedCheck, Number(Configs.get('homunAutoFeedTimeMs')) || autoFeedIntervalMs);
        autoFeedCheck();
    }

    HomunInformations.stopAutoFeed = function stopAutoFeed() {
        window.clearInterval(autoFeedInterval);
    }

    /**
     * Checks if homun should be fed or not
     * - feed when hunger drops below 31 (default value)
     * - feed should restore about 10 hunger
     * - 1 hunger is lost every 60 seconds
     *
     * @return {void}
     */
    function autoFeedCheck() {
        // check is feature enabled (ui toggeled)
        if (_preferences.autoFeed != 1) return;

        // check current player
        var player = Session.Entity;
        if (!player) return;
        if (player.life.hp <= 0) return;

        // check current homunculus
        if (!Session.homunId) return;
        var entity = EntityManager.get(Session.homunId);
        if (!entity) return;
        if (entity.life.hp <= 0) return;
        // get the auto feed break point from the config or default
        if (entity.life.hunger > Number(Configs.get('homunAutoFeedPercent', autoFeedPercent))) return;
        // hunger is now at 30, so feed +10 points
        HomunInformations.sendHomunFeed();
    }

    /**
     * feed homunculus
     */
    function onFeed() {
        HomunInformations.reqHomunFeed();
    }

    /**
     * delete homunculus
     */
    function onDelete() {
        HomunInformations.reqDeleteHomun();
        return true;
    }


    /**
     * Once remove from body, save user preferences
     */
    HomunInformations.onRemove = function onRemove() {
        // Save preferences
        _preferences.show = DOM.isVisible(this.ui);
        _preferences.y = parseInt(this.ui.style.top, 10);
        _preferences.x = parseInt(this.ui.style.left, 10);
        _preferences.save();
        HomunInformations.stopAutoFeed();
        this.stopAI();
    };


    /**
     * Process shortcut
     *
     * @param {object} key
     */
    HomunInformations.onShortCut = function onShortCut(key) {
        // Not in body
        if (!this.ui) {
            return;
        }

        switch (key.cmd) {
            case 'TOGGLE':
                if (Session.homunId) {
                    DOM.toggleDisplay(this.ui);
                    if (DOM.isVisible(this.ui)) {
                        this.focus();
                    }
                    if (!DOM.isVisible(this.ui)) {
                        DOM.hide(SkillListMH.homunculus.ui);
                    }
                } else {
                    DOM.hide(SkillListMH.homunculus.ui);
                    DOM.hide(this.ui);
                }
                break;
            case 'AGGRESSIVE':
                this.toggleAggressive();
                break;
        }
    };


    /**
     * Update UI
     *
     * @param {object} homunculus info
     */
    HomunInformations.setInformations = function setInformations(info) {
        this.ui.querySelector('.name').value = info.szName;
        this.ui.querySelector('.level').textContent = info.nLevel;

        this.ui.querySelector('.stats .atk').textContent = info.atk;
        this.ui.querySelector('.stats .Matk').textContent = info.Matk;
        this.ui.querySelector('.stats .hit').textContent = info.hit;
        this.ui.querySelector('.stats .critical').textContent = info.critical;
        this.ui.querySelector('.stats .def').textContent = info.def;
        this.ui.querySelector('.stats .Mdef').textContent = info.Mdef;
        this.ui.querySelector('.stats .flee').textContent = info.flee;
        this.ui.querySelector('.stats .aspd').textContent = Math.floor(200 - info.aspd / 10);

        this.setHpSpBar('hp', info.hp, info.maxHP);
        this.setHpSpBar('sp', info.sp, info.maxSP);

        this.setExp(info.exp, info.maxEXP);
        this.setHunger(info.nFullness);
        this.setIntimacy(info.nRelationship);

        if (info.bModified < 5) {
            this.ui.querySelector('.name, .modify').classList.remove('disabled').setAttribute('disabled', false);
        } else {
            this.ui.querySelector('.name, .modify').classList.add('disabled').setAttribute('disabled', true);
        }

        SkillListMH.homunculus.setPoints(info.SKPoint);
    };


    /**
     * Set hp and sp bar (menu)
     *
     * @param type
     * @param val
     * @param val2
     */
    HomunInformations.setHpSpBar = function setHpSpBar(type, val, val2) {
        var perc = Math.floor(val * 100 / val2);
        var color = perc < 25 ? 'red' : 'blue';
        this.ui.querySelector('.' + type + '_value').textContent = val;
        this.ui.querySelector('.' + type + '_max_value').textContent = val2;
        this.ui.querySelector('.' + type + '_perc').textContent = perc + '%';

        if (perc <= 0) {
            this.ui.querySelector('.' + type + '_bar div').style.backgroundImage = 'none';
        }

        Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze' + color + '_left.bmp', function (url) {
            this.ui.querySelector('.' + type + '_bar_left').style.backgroundImage = 'url(' + url + ')';
        }.bind(this));

        Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze' + color + '_mid.bmp', function (url) {
            var el = this.ui.querySelector('.' + type + '_bar_middle');
            el.style.backgroundImage = 'url(' + url + ')';
            el.style.width = Math.floor(Math.min(perc, 100) * 0.75) + 'px';
        }.bind(this));

        Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze' + color + '_right.bmp', function (url) {
            var el = this.ui.querySelector('.' + type + '_bar_right');
            el.style.backgroundImage = 'url(' + url + ')';
            el.style.left = Math.floor(Math.min(perc, 100) * 1.27) + 'px';
        }.bind(this));

        this.ui.querySelector('.' + type + '2').textContent = val + '/' + val2;
    }


    /**
     * Set intimacy
     *
     * @param {number} intimacy
     */
    HomunInformations.setIntimacy = function setIntimacy(val) {
        if (!this.ui) {
            return;
        }

        this.ui.querySelector('.intimacy').textContent = DB.getMessage(
            val < 100 ? 672 :
                val < 250 ? 673 :
                    val < 600 ? 669 :
                        val < 900 ? 674 :
                            675
        );
    };


    /**
     * Set exp value
     *
     * @param exp
     * @param maxEXP
     */
    HomunInformations.setExp = function setExp(exp, maxEXP) {
        if (!this.ui) {
            return;
        }

        var canvasExp = this.ui.querySelector('.block2 canvas.life.title_exp');
        var ctx = canvasExp.getContext('2d');

        var width = 60, height = 5;
        var exp_per = exp / maxEXP;

        // // border
        // ctx.fillStyle = '#10189c';
        // ctx.fillRect( 0, 0, width, height );

        // empty
        ctx.fillStyle = '#424242';
        ctx.fillRect(1, 1, width - 2, height - 2);

        ctx.fillStyle = '#205cc3';
        ctx.fillRect(1, 1, Math.round((width - 2) * exp_per), 3);

        this.ui.querySelector('.exp').textContent = exp + '/' + maxEXP;
    }


    /**
     * Set hunger value
     *
     * @param {number} hunger
     */
    HomunInformations.setHunger = function setHunger(val) {
        if (!this.ui) {
            return;
        }

        var canvasHunger = this.ui.querySelector('.block2 canvas.life.title_hunger');
        var ctx = canvasHunger.getContext('2d');

        var width = 60, height = 5;
        var hunger_per = val / 100;

        // // border
        // ctx.fillStyle = '#10189c';
        // ctx.fillRect( 0, 0, width, height );

        // empty
        ctx.fillStyle = '#424242';
        ctx.fillRect(1, 1, width - 2, height - 2);

        ctx.fillStyle = (hunger_per < 0.25) ? '#ff1e00' : '#205cc3';
        ctx.fillRect(1, 1, Math.round((width - 2) * hunger_per), 3);

        this.ui.querySelector('.hunger').textContent = val + '/' + 100;
    };

    HomunInformations.toggleAggressive = function toggleAggressive() {
        let agr = localStorage.getItem('HOM_AGGRESSIVE') == 0 ? 1 : 0;
        localStorage.setItem('HOM_AGGRESSIVE', agr);
    };

    HomunInformations.startAI = function startAI() {
        this.stopAI();
        AIDriver.homunculus.reset();
        this.AILoop = setInterval(function () {
            if (Session.homunId) {
                var entity = EntityManager.get(Session.homunId);
                if (entity) {
                    AIDriver.homunculus.exec('AI(' + Session.homunId + ')')
                }
            }
        }, 100);
    };

    HomunInformations.stopAI = function stopAI() {
        if (this.AILoop) {
            clearInterval(this.AILoop);
        }
    };

    HomunInformations.resetAI = function resetAI() {
        this.stopAI();
        this.startAI();
    };

    HomunInformations.setFeedConfig = function setFeedConfig(flag) {
        _preferences.autoFeed = flag;
        _preferences.save();
        // server sent this info before of homun
        if (HomunInformations.ui) {
            Client.loadFile(DB.INTERFACE_PATH + 'checkbox_' + (_preferences.autoFeed ? '1' : '0') + '.bmp', function (data) {
                HomunInformations.ui.querySelector('.homun_auto_feed').style.backgroundImage = 'url(' + data + ')';
            });
        }
        autoFeedCheck();
    }

    /**
     * Toggle AutoFeed
     */
    function homunToggleAutoFeed() {
        HomunInformations.setFeedConfig(_preferences.autoFeed == 1 ? 0 : 1);
        if (PACKETVER.value < 20170920) return;
        HomunInformations.onConfigUpdate(3, !_preferences.autoFeed ? 1 : 0);
    }

    /**
     * Request to modify homun's name
     */
    function onChangeName() {
        var input = HomunInformations.ui.querySelector('.name');
        HomunInformations.reqNameEdit(input.value);
    }


    /**
     * Closing window
     */
    function onClose() {
        HomunInformations.ui.style.display = 'none';
        SkillListMH.homunculus.ui.style.display = 'none';
    }


    /**
     * Stop event propagation
     */
    function stopPropagation(event) {
        event.stopImmediatePropagation();
        return false;
    }


    /**
     * Functions defined in Engine/MapEngine/Homun.js
     */
    HomunInformations.reqHomunFeed = function reqHomunFeed() { };
    HomunInformations.reqNameEdit = function reqNameEdit() { };
    HomunInformations.reqAttack = function reqAttack() { };
    HomunInformations.reqMoveTo = function reqMoveTo() { };
    HomunInformations.reqMoveToOwner = function reqMoveToOwner() { };

    HomunInformations.reqHomunAction = function reqHomunAction() { };
    HomunInformations.onConfigUpdate = function onConfigUpdate(/* type, value*/) { };


    /**
     * Create component and export it
     */
    return UIManager.addComponent(HomunInformations);
});
