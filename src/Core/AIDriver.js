define(['Renderer/EntityManager', 'Renderer/Renderer', 'Vendors/fengari-web', 'Renderer/Entity/Entity'], function (EntityManager, Renderer, fengari, Entity) {
    'use strict';

    var Session = require('Engine/SessionStorage');
    var Network = require('Network/NetworkManager');
    var PACKET = require('Network/PacketStructure');
	var Configs = require('Core/Configs');

    function AIDriver() {
    }

    AIDriver.init = function init() {
		var code = `package.path = package.path .. '${Configs.get('remoteClient')}'`;
		
		if(Session.homCustomAI){
			code += `
				dofile ("./AI/USER_AI/AI.lua")
			`;
		} else {
			code += `
				dofile ("./AI/AI.lua")
			`;
		}
		
		code +=`
            function TraceAI (string)
                return js.global:TraceAI(string)
            end
            function MoveToOwner (id) 
                return js.global:MoveToOwner(id)
            end
            function Move (id,x,y) 
                return js.global:Move(id,x,y)
            end
            function Attack (GID, targetGID) 
                return js.global:Attack(GID, targetGID)
            end
            function GetV (V_, id) 
                p = Split(js.global:GetV(V_, id), ",")
                if (V_ == V_MOTION or V_ == V_OWNER or V_ == V_HOMUNTYPE or V_ == V_TARGET or V_ == V_ATTACKRANGE) then
                    return tonumber(p[1])
                end
                if (V_ == V_HP or V_ == V_SP or V_ == V_MAXHP or V_ == V_MAXSP) then
                    return tonumber(p[1])
                end
                if (V_ == V_POSITION) then
                    return tonumber(p[1]), tonumber(p[2])
                end
                return tonumber(p[1]), tonumber(p[2]), tonumber(p[3]), tonumber(p[4])
            end
            function GetActors () 
                actors = js.global:GetActors()
                res = {}
                for i,v in ipairs(actors) do
                    res[i] = tonumber(v)
                end
                return res
            end
            function GetTick () 
                return js.global:GetTick()
            end
            function GetMsg (id) 
                res = {}
                for i,v in ipairs(Split(js.global:GetMsg(id), ",")) do
                    res[i] = tonumber(v)
                end
                return res
            end
            function GetResMsg (id)
                -- print('GetResMsg', id)
                return {0}
            end
            function SkillObject (id,level,skill,target) 
                print('SkillObject', id, level, skill, target)
            end
            function SkillGround (id,level,skill,x,y) 
                print('SkillGround', id, level, skill, x, y)
            end
            function IsMonster (id) 
                return js.global:IsMonster(id)
            end
            
            
            -----------------------------------------
            function Split(s, delimiter)
                result = {};
                for match in (s..delimiter):gmatch("(.-)"..delimiter) do
                    table.insert(result, match);
                end
                return result;
            end
        `;
		AIDriver.exec(code);

    }

    var msg = {};

    AIDriver.setmsg = function setmsg(homId, str) {
        msg[homId] = str;
    }

    window.GetMsg = function GetMsg(id) {
        if (id in msg) {
            let res = msg[id];
            delete msg[id];
            return res;
        }
        return '';
    }

    window.IsMonster = function IsMonster(id) {
        if (id < 1 || typeof (id) !== 'number') {
            return 0;
        }

        var entity = EntityManager.get(Number(id));

        if (entity.objecttype === entity.TYPE_MOB || entity.objecttype === entity.TYPE_NPC_ABR || entity.objecttype === entity.TYPE_NPC_BIONIC) {
            return 1;
        }
        return 0;
    }

    window.TraceAI = function TraceAI(str) {
        console.warn('TraceAI', str)
    }

    window.GetTick = function GetTick() {
        return Renderer.tick;
    }

    window.Move = function Move(id, x, y) {
        var pkt = new PACKET.CZ.REQUEST_MOVENPC();
        pkt.GID = id;
        pkt.dest[0] = x;
        pkt.dest[1] = y;
        Network.sendPacket(pkt);
    }

    window.Attack = function Attack(GID, targetGID) {
        var pkt = new PACKET.CZ.REQUEST_ACTNPC();
        pkt.GID = GID;
        pkt.targetGID = targetGID;
        pkt.action = 0;
        Network.sendPacket(pkt);
    }

    window.MoveToOwner = function MoveToOwner(gid) {
        var pkt = new PACKET.CZ.REQUEST_MOVETOOWNER();
        pkt.GID = gid;
        Network.sendPacket(pkt);
    }

    window.status = null;
    window.GetActors = function () {
        AIDriver.exec('js.global.status = MyState')
        var res = [0]
        EntityManager.forEach((item) => {
            res.push(item.GID)
        });

        // aggressive logic
        if (res.length > 3) {
            if (localStorage.getItem('AGGRESSIVE') == 1) {
                res.forEach((item) => {
                    if (item != 0 && item != Session.AID && item != Session.homunId) {
                        var entity = EntityManager.get(Number(item))
                        if (entity && (entity.objecttype === Entity.TYPE_MOB || entity.objecttype === Entity.TYPE_NPC_ABR || entity.objecttype === Entity.TYPE_NPC_BIONIC)) {
                            if (status == 0) { //idle = 0
                                // attak
                                AIDriver.setmsg(Session.homunId, '3,'+ item);
                            }
                        }
                    }
                })
            } else {
                AIDriver.setmsg(Session.homunId, status);
            }
        }
        return res;
    }

    window.GetV = function GetV(V_, id) {
        var entity = EntityManager.get(Number(id));

        switch (V_) {
            case 0: // V_OWNER ok
                return Session.AID;

            case 1: // V_POSITION ok
                // console.warn('V_POSITION', id, entity)
                if (entity !== null) {
                    return entity.position[0] + ',' + entity.position[1];
                }
                return '-1,-1'

            case 2: // V_TYPE
                console.warn("V_TYPE ", id, entity);
                return 0;

            case 3: // V_MOTION ok
                if (id < 1000) {
                    var avtors = window.GetActors();
                    return EntityManager.get(Number(avtors[id])).action;
                }
                return entity.action;

            case 4: // V_ATTACKRANGE ok
                // Returns the attack range (Not implemented yet; temporarily set as 1 cell)
                if(entity){
					return entity.attack_range || 1;
				}
                return 1;

            case 5: // V_TARGET ok
                if (id < 1 || typeof (id) !== 'number') {
                    return 0;
                }
                return entity.targetGID;

            case 6: // V_SKILLATTACKRANGE
                // Returns the skill attack range (Not implemented yet)
                if(entity){
					return entity.attack_range || 1;
				}
                return 1;

            case 7: // V_HOMUNTYPE ok
                if (entity === null) {
                    return 0;
                }
                return Number((entity._job + '').substring(1));

            case 8: // V_HP
                return entity.life.hp;

            case 9: // V_SP
                return entity.life.sp;

            case 10: // V_MAXHP
                return entity.life.hp_max;

            case 11: // V_MAXSP
                return entity.life.sp_max;

            case 12: // V_MERTYPE
                console.warn("V_MERTYPE ", id, entity)
                return 0;

            default:
                console.error("unknown V_ ", V_, entity)
                return 0;
        }
    }

    AIDriver.exec = function exec(code) {
        try {
			fengari.load(code)();
        } catch (e) {
            console.error('AI_error: ', e);
        }
    }
	
	AIDriver.reset = function reset(){
		
		this.init();
	}

    AIDriver.init();

    return AIDriver;
});
