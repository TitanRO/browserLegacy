/**
 * UI/Components/WorldMap/WorldMap.js
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author IssID
 */
define(function (require) {
    'use strict';

    const DB = require('DB/DBManager');
    const Client = require('Core/Client');
    const Configs = require('Core/Configs');
    const Preferences = require('Core/Preferences');
    const Renderer = require('Renderer/Renderer');
    const MapRenderer = require('Renderer/MapRenderer');
    const UIManager = require('UI/UIManager');
    const UIComponent = require('UI/UIComponent');
    const Session = require('Engine/SessionStorage');
    const MAPS = require('DB/Map/WorldMap');
    const htmlText = require('text!./WorldMap.html');
    const cssText = require('text!./WorldMap.css');
    const DOM = require('Utils/DOM');

    /**
     * Create Component
     */
    const WorldMap = new UIComponent('WorldMap', htmlText, cssText);

    /**
     * @type {Preferences} window preferences
     */
    const _preferences = Preferences.get('WorldMap', {
        x: 0,
        y: 0,
        width: Renderer.width,
        height: Renderer.height,
        show: false,
    }, 1.0);

    // Party member store
    let _partyMembersByMap = {};

    // Sizing params
    const C_TITLEBARHEIGHT = 17;
    const C_BASEWIDTH = 1280;
    const C_BASEHEIGHT = 1024;
    const C_ASPECTX = 5;
    const C_ASPECTY = 4;
    const C_DIALOG_BASEWIDTH = 512;
    const C_DIALOG_BASEHEIGHT = 512;
    const C_DIALOG_ASPECTX = 1;
    const C_DIALOG_ASPECTY = 1;
    const C_DIALOGPADDING = 20;

    /**
     * Initialize UI
     */
    WorldMap.init = function init () {
        this.ui.querySelector('.titlebar .base').addEventListener('mousedown', stopPropagation);
        this.ui.querySelector('.titlebar select').addEventListener('change', onSelect);
        this.ui.querySelector('.titlebar .togglemaps').addEventListener('click', onToggleMaps);
        this.ui.querySelector('.titlebar .close').addEventListener('click', onClose);

        // worldmap dialog
        this.ui.querySelector('.map .content').addEventListener('click', onWorldMapClick);
        this.ui.querySelector('#dialog-map-view-backdrop').addEventListener('click', onWorldMapDialogClick);
    };


    /**
     * Create WorldMap list of maps (select Element)
     */
    function setMapList () {
        WorldMap.ui.querySelector('#WorldMaps').innerHTML = (function () {
            let list = '';
            for (const map of MAPS) {
                // Episode check
                if (WorldMap.settings.episode >= map.ep_from && WorldMap.settings.episode < map.ep_to) {
                    list += '<option value="' + map.id + '">' + map.name + '</option>';
                }
            }
            return list;
        })();
    }


    function onSelect () {
        selectMap(WorldMap.ui.querySelector('.titlebar select').value);
    }


    /**
     * Select world map
     *
     * @param {string} name eg. `"worldmap_localizing1"`
     */
    function selectMap (name = 'worldmap') {
        // load map image asset and render it
        Client.loadFile(DB.INTERFACE_PATH + name + '.bmp', (data) => {
            // find map data by name and render it
            for (const map of MAPS) {
                if (map.id === name) {
                    createWorldMapView(map, data);
                    resizeMap();
                    break;
                }
            }
        });
    }


    /**
     * Resize world map
     */
    function resizeMap () {

        const mapContainer = WorldMap.ui.querySelector('.map-view');

        const currentwidth = Renderer.width;
        const currentheight = Renderer.height - C_TITLEBARHEIGHT;

        const xmult = currentwidth / C_BASEWIDTH;
        const ymult = currentheight / C_BASEHEIGHT;

        let mult = xmult;
        if (currentwidth / C_ASPECTX > currentheight / C_ASPECTY) {
            mult = ymult;
        }

        mapContainer.style.width = (C_BASEWIDTH * mult) + 'px';
        mapContainer.style.height = (C_BASEHEIGHT * mult) + 'px';

        const dialogImg = WorldMap.ui.querySelector('#img-map-view');
        let d_width = C_DIALOG_BASEWIDTH;
        let d_height = C_DIALOG_BASEHEIGHT;
        if (currentwidth < C_DIALOG_BASEWIDTH + C_DIALOGPADDING || currentheight < C_DIALOG_BASEHEIGHT + C_DIALOGPADDING) {
            const d_xmult = (currentwidth - C_DIALOGPADDING) / C_DIALOG_BASEWIDTH;
            const d_ymult = (currentheight - C_DIALOGPADDING) / C_DIALOG_BASEHEIGHT;

            let mult = d_xmult;
            if (currentwidth / C_DIALOG_ASPECTX > currentheight / C_DIALOG_ASPECTY) {
                mult = d_ymult;
            }

            d_width = C_DIALOG_BASEWIDTH * mult;
            d_height = C_DIALOG_BASEHEIGHT * mult;
        }
        dialogImg.style.width = (d_width) + 'px';
        dialogImg.style.height = (d_height) + 'px';
    }


    /**
     * When worldmap container is clicked
     * @param {*} e
     */
    function onWorldMapClick (e) {
        // event delegation from .section
        const section = e.target.closest('.section');
        if (!section) return;

		const overlay = WorldMap.ui.querySelector('#dialog-map-view-backdrop');
        if (overlay == null) return;
        const dialog = WorldMap.ui.querySelector('#dialog-map-view');
        if (dialog == null) return;
        WorldMap.ui.querySelector('#dialog-map-view .mapname').textContent = section.getAttribute('data-name');
        WorldMap.ui.querySelector('#dialog-map-view .mapid').textContent = section.id;

        overlay.classList.add("show");

        const img = dialog.querySelector('#img-map-view');
        img.style.backgroundImage = '';

        // loader (now text)
        const loader = img.querySelector('#loader');
        loader.innerText = `Loading ${section.id}...`;

        // load the image
        Client.loadFile(`${DB.INTERFACE_PATH}map/${section.id}.bmp`, (data) => {
            // img.src = data;

            loader.innerText = '';
            img.style.backgroundImage = `url(${data})`;
            img.style.backgroundSize = 'cover';

            // try to adjust purple color transparency
            img.onload = () => {
                adjustImageTransparency(img);
                img.onload = null; // only run once
            }
        });

        // display party member list on map
        let memberList = '';
        if (Array.isArray(_partyMembersByMap[section.id])) {
            _partyMembersByMap[section.id].forEach((member) => {
                memberList += member.Name + '<br/>';
            });
        }
        WorldMap.ui.querySelector('#dialog-map-view .memberlist').textContent = memberList;
    }


    /**
     * When the user clicks outside of the dialog, close it
     *
     * @param {*} e
     * @returns
     */
    function onWorldMapDialogClick (e) {
        const dialog = WorldMap.ui.querySelector('#dialog-map-view');
        if (dialog == null) {
            return;
        }

        const dialogDimensions = dialog.getBoundingClientRect();
        if (
            e.clientX < dialogDimensions.left ||
            e.clientX > dialogDimensions.right ||
            e.clientY < dialogDimensions.top ||
            e.clientY > dialogDimensions.bottom
        ) {
            closeMapDialog();
            return;
        }
        // close button
        if (e.target.id === 'dialog-close') {
            closeMapDialog();
            return;
        }
    }


    function closeMapDialog () {
        // Remove image (causes fps drop)
        WorldMap.ui.querySelector('#img-map-view').setAttribute('src', '');
        const dialog = WorldMap.ui.querySelector('#dialog-map-view-backdrop');
        if (dialog) {
			dialog.classList.remove("show");
        }
    }


    /**
     * Create the .worldmap container and loop through all the maps
     * and render them to the container.
     *
     * @param {WorldMap} map world map data
     * @param {string} imgData world map image data as a base64
     */
    function createWorldMapView (map, imgData) {
        const container = WorldMap.ui.querySelector('.map .content');
        const worldmap = document.createElement('div');
        const currentMap = MapRenderer.currentMap.replace(/\.gat$/i, '');

        worldmap.className = 'worldmap';

        // set loaded worldmap background image
        // worldmap.style.backgroundImage = `url(${imgData}`);
        const mapView = document.createElement('div');
        mapView.id = map.id;
        mapView.className = 'map-view';
        mapView.style.backgroundImage = `url(${imgData})`;
        mapView.setAttribute('data-name', map.name);
        worldmap.appendChild(mapView);

        // output <div id="worldmap_localizing1" class="map-view" data-name="Eastern Kingdoms"></div>
        for (const section of map.maps) {

            //Episode & custom add/remove check
            if (((WorldMap.settings.episode >= section.ep_from && WorldMap.settings.episode < section.ep_to) || WorldMap.settings.add.includes(section.id)) && !WorldMap.settings.remove.includes(section.id)) {
                const el = document.createElement('div');
                const el_mapid = document.createElement('div');
                const el_mapname = document.createElement('div');

                el.id = section.id;

                if (currentMap == section.id) {
                    el.className = 'section currentmap';
                } else {
                    el.className = 'section';
                }

                el.style.top = `${section.top / C_BASEHEIGHT * 100}%`;
                el.style.left = `${section.left / C_BASEWIDTH * 100}%`;
                el.style.width = `${section.width / C_BASEWIDTH * 100}%`;
                el.style.height = `${section.height / C_BASEHEIGHT * 100}%`;
                el.setAttribute('data-name', section.name);
                el.title = section.name;

                el_mapname.className = 'mapname';
                el_mapname.innerHTML = section.name;

                el_mapid.className = 'mapid';
                el_mapid.innerHTML = section.id;

                el.appendChild(el_mapname);
                el.appendChild(el_mapid);
                mapView.appendChild(el);
            }
        }
        // airplanes, currently only in the worldmap
        // do secondary assets loading to load the airplane image
        // and then create element and append it to the DOM
        if (map.id === 'worldmap') {
            loadAirplane(mapView);
        }
        worldmap.appendChild(mapView);
        container.innerHTML = '';
        container.appendChild(worldmap);
    }


    /**
     * Load airplane image and append it to the DOM (.map-view element)
     *
     * @param {HTMLElement} mapView target where to append to
     */
    function loadAirplane (mapView) {
        Client.loadFile(DB.INTERFACE_PATH + 'worldview_interface/wv_airplen32.bmp', (data) => {
            const airplane = document.createElement('img');
            airplane.id = 'midgard-airplane';
            airplane.className = 'airplane';
            airplane.src = data;
            // update it's position and angle
            setAirplanePosition(airplane);
            mapView.appendChild(airplane);
        });
    }


    /**
     * Refresh airplane position
     *
     * @param {HTMLElement} airplane optional. if not provided, will use .worldmap #midgard-airplane
     *
     * @todo use server time and set position and angle
     */
    function setAirplanePosition (airplane) {
        const el = airplane || document.querySelector('.worldmap #midgard-airplane');
        el.style.top = '35%';
        el.style.left = '35%';
        el.style.transform = `rotate(75deg)`;
    }


    /**
     * helper function to convert purple (255,0,255) color to transparent from image.
     *
     * Note: will not work on local files, needs to be hosted on
     * server for CORS (See: 'getImageData' on 'CanvasRenderingContext2D':
     * The canvas has been tainted by cross-origin data)
     *
     * @param {HTMLImageElement} img source image element
     *
     * @example
     const img = document.querySelector('img');
         img.src = `textures/map/${e.target.id}.bmp`;
         img.onload = () => adjustImageTransparency(img);
     */
    function adjustImageTransparency (img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || img.clientWidth;
        canvas.height = img.height || img.clientHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // iterate over all pixels
        // in the image data and turn purple pixels transparent
        let i = 0, n = imgData.data.length, red, green, blue, isPurple = false;

        for (; i < n; i += 4) {
            red = imgData.data[i];
            green = imgData.data[i + 1];
            blue = imgData.data[i + 2];

            // with exact color
            isPurple = (red === 255 && blue === 255) && green === 0;
            // with some tolerance
            // let isPurple = (red >= 150 && blue >= 150) && green < 150;

            if (isPurple) {
                imgData.data[i + 3] = 0; // Set alpha channel to 0 for transparency
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // replace the existing source image with the new one
        img.src = canvas.toDataURL();
    }


    /**
     * Apply preferences once append to body
     */
    WorldMap.onAppend = function onAppend () {
        // Apply preferences
        if (!_preferences.show) {
            DOM.hide(this.ui);
        }

        // settings
        this.settings = { episode: 98, add: [], remove: [] };
        const conf = Configs.get('worldMapSettings', { episode: 98, add: [], remove: [] });

        // Prevent stupidity
        if ('episode' in conf) {
            this.settings.episode = conf.episode;
        }

        if ('add' in conf && Array.isArray(conf.add)) {
            this.settings.add = conf.add;
        }

        if ('remove' in conf && Array.isArray(conf.remove)) {
            this.settings.remove = conf.remove;
        }

        console.log('%c[WoldMap] Episode: ', 'color:#007000', this.settings.episode);
        if (this.settings.add.length > 0) {
            console.log('%c[WoldMap] Add Maps: ', 'color:#007000', this.settings.add);
        }
        if (this.settings.remove.length > 0) {
            console.log('%c[WoldMap] Remove Maps: ', 'color:#007000', this.settings.remove);
        }

        // set maps
        setMapList();

        // resize map container & add sections
        selectMap();

        DOM.setCss(this.ui, {
            top: 0,
            left: 0,
        });
    };

    WorldMap.onRemove = function onRemove () {
        // Save preferences
        _preferences.show = DOM.isVisible(this.ui);
        _preferences.y = 0;
        _preferences.x = 0;
        _preferences.width = 0;
        _preferences.height = 0;
        _preferences.save();
    };

    /**
     * Show/Hide UI
     */
    WorldMap.toggle = function toggle () {
        DOM.toggleDisplay(this.ui);

        if (DOM.isVisible(this.ui)) {
            this.focus();
        } else {
            closeMapDialog();
        }
    };

    /**
     * Process shortcut
     *
     * @param {object} key
     */
    WorldMap.onShortCut = function onShortCut (key) {
        switch (key.cmd) {
            case 'TOGGLE':
                DOM.toggleDisplay(this.ui);
                break;
        }
    };

    /**
     * Resize UI
     */
    WorldMap.onResize = function () {
        resizeMap();
    };

    /**
     * Update party members on map
     *
     * @param {object} pkt
     */
    WorldMap.updatePartyMembers = function updatePartyMembers (pkt) {
        _partyMembersByMap = {};
        pkt.groupInfo.forEach((member) => {
            if (member.AID !== Session.AID && member.state === 0) {
                const mapId = member.mapName.replace(/\.gat$/i, '');
                if (!_partyMembersByMap[mapId]) {
                    _partyMembersByMap[mapId] = [];
                }
                _partyMembersByMap[mapId].push({ AID: member.AID, Name: member.characterName });
            }
        });

        Array.from(WorldMap.ui.querySelectorAll('.worldmap .section')).forEach(function(el) { el.classList.remove('membersonmap'); });
        for (const [mapId, members] of Object.entries(_partyMembersByMap)) {
            var sectionEl = WorldMap.ui.querySelector('.worldmap .section#' + mapId);
            if (sectionEl) sectionEl.classList.add('membersonmap');
        }
    };


    /**
     * Toggle all maps
     */
    function onToggleMaps () {
        if (WorldMap.showAllMaps) {
            Array.from(WorldMap.ui.querySelectorAll('.worldmap .section')).forEach(function(el) { el.classList.remove('allmapvisible'); });
            WorldMap.showAllMaps = false;
        } else {
            Array.from(WorldMap.ui.querySelectorAll('.worldmap .section')).forEach(function(el) { el.classList.add('allmapvisible'); });
            WorldMap.showAllMaps = true;
        }
    }


    /**
     * Stop event propagation
     * @param {object} event
     */
    function stopPropagation (event) {
        event.stopImmediatePropagation();
        return false;
    }


    /**
     * Closing window
     */
    function onClose () {
        DOM.hide(WorldMap.ui);
    }


    /**
     * Create component and export it
     */
    return UIManager.addComponent(WorldMap);
});
