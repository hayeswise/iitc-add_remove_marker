// ==UserScript==
// @id             iitc-plugin-add-remove-marker@hayeswise
// @name           IITC plugin: Add and Remove Marker
// @category       Layer
// @version        1.2016.12.15
// @namespace      https://github.com/hayeswise/iitc-addremovemarker
// @description    Adds an Add Marker and Remove Marker control to the toolbox.
// @updateURL      https://github.com/hayeswise/iitc-addremovemarker/raw/master/wise-addRemoveMarker.user.js
// @downloadURL	   https://github.com/hayeswise/iitc-addremovemarker/raw/master/wise-addRemoveMarker.user.js
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @author         Hayeswise
// @grant          none
// ==/UserScript==
// MIT License, Copyright (c) 2016 Brian Hayes ("Hayeswise")
// For more information, visit https://github.com/hayeswise/iitc-addremovemarker

//
// Standard IITC wrapper pattern (and JavaScript encapsulation pattern).
// See last three lines of this file where it is used.
//
function wrapper(plugin_info) {
    // Polyfill Array.find if not available
    // Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
    if (!Array.prototype.find) {
        Object.defineProperty(Array.prototype, 'find', {
            value: function(predicate) {
                'use strict';
                if (this === null) {
                    throw new TypeError('Array.prototype.find called on null or undefined');
                }
                if (typeof predicate !== 'function') {
                    throw new TypeError('predicate must be a function');
                }
                var list = Object(this);
                var length = list.length >>> 0;
                var thisArg = arguments[1];
                var value;

                for (var i = 0; i < length; i++) {
                    value = list[i];
                    if (predicate.call(thisArg, value, i, list)) {
                        return value;
                    }
                }
                return undefined;
            }
        });
    }

    // In case IITC is not available yet, define the base plugin object
    if (typeof window.plugin !== "function") {
        window.plugin = function () {};
    }
    // Base context/namespace for plugin
    window.plugin.addRemoveMarker = function () {};
    var self = window.plugin.addRemoveMarker;
    var namespace = "plugin.addRemoveMarker";

    // Plugin level properties
    self.portalDataInPortalDetails = null;

    //
    // Adds a layer item (e.g., a marker) to the map.  Copied from plugin.drawTools.import.
    // @param item An object contain data for the layer.
    // @returns A Leaflet layer object.
    //
    self.addItem = function(item) {
        var fname = namespace + ".addItem";
        var layer = null;
        var extraOpt = {};
        if (item.color) extraOpt.color = item.color;

        switch(item.type) {
            case 'polyline':
                layer = L.geodesicPolyline(item.latLngs, L.extend({},window.plugin.drawTools.lineOptions,extraOpt));
                break;
            case 'polygon':
                layer = L.geodesicPolygon(item.latLngs, L.extend({},window.plugin.drawTools.polygonOptions,extraOpt));
                break;
            case 'circle':
                layer = L.geodesicCircle(item.latLng, item.radius, L.extend({},window.plugin.drawTools.polygonOptions,extraOpt));
                break;
            case 'marker':
                var extraMarkerOpt = {};
                if (item.color) extraMarkerOpt.icon = window.plugin.drawTools.getMarkerIcon(item.color);
                layer = L.marker(item.latLng, L.extend({},window.plugin.drawTools.markerOptions,extraMarkerOpt));
                window.registerMarkerForOMS(layer);
                break;
            default:
                console.warn('unknown layer type "'+item.type+'" when loading draw tools layer');
                break;
        }
        if (layer) {
            window.plugin.drawTools.drawnItems.addLayer(layer);
			//runHooks('pluginDrawTools', {event: 'import'});
			runHooks('pluginDrawTools', {
    			event: 'layerCreated',
    			layer: layer
    		}); // Per draw-tools line #665 the map.on('draw:created', ...) function
        }

        return layer;
    };
    //
    // Adds a portal marker (map pin) if the selected portal is not already marked.
    // @returns a Leaflet layer object corresponding to the added portal marker
    //
    self.addMarker = function () {
    	var fname = namespace + ".addMarker";
    	var count = 0,
    	data = [], // For layer data
		isMarked,
    	item,
    	layer = null,
    	portalDetails,
    	title;
    	if (!self.portalDataInPortalDetails) {
    		alert("Select a portal to load the portal details before attempting to add a marker.");
			return null;
    	}
		isMarked = self.isMarked(self.portalDataInPortalDetails.portalDetails);
		title = (self.portalDataInPortalDetails && self.portalDataInPortalDetails.portalDetails.title) ? self.portalDataInPortalDetails.portalDetails.title : "[NO PORTAL DATA]";
    	console.log(fname + ": guid:=" + self.portalDataInPortalDetails.guid + ", title:=" + title + ", have portal details=" + !!self.portalDataInPortalDetails + ", isMarked=" + isMarked);
		if (!isMarked) {
    		portalDetails = self.portalDataInPortalDetails.portalDetails;
    		item = {
    			type: 'marker',
    			latLng: {
    				lat: portalDetails.latE6 / 1E6,
    				lng: portalDetails.lngE6 / 1E6
    			},
    		};
    		layer = self.addItem(item);  // calls runhooks
    	}
    	if (layer !== null) {
    		console.log(fname + ": calling window.plugin.drawTools.save();");
    		window.plugin.drawTools.save();
    	}
    	return layer;
    };
    //
    // Save the portal details.
    //
    // @param data Object containing the guid, portal object, portalData object, and a portalDetails object.
    //
    self.checkPortalDetailsUpdated = function (data) {
        var fname = "plugin.addRemoveMarker.checkPortalDetailsUpdated";
        var title;
        self.portalDataInPortalDetails = data;
        title = data.portalData.title ? data.portalData.title : "[NO PORTAL DATA FOR portalDetailsUpdated RUNHOOK]";
        console.log(fname + "(data.guid:=" + data.guid + ", data.portalData.title:=" + title + ")");
    };
    //
    // If the portal is already marked on the map, return true; otherwise,
    // return false.
    //
    self.isMarked = function (portalDetails) {
        var fname = namespace + ".isMarked";
        var theLayers; // Leaflet Layer[]
        theLayers = window.plugin.drawTools.drawnItems.getLayers();
        index = theLayers.findIndex(function(layer, i, array) {
            var foundMarker = false,
                item = {};
            if (layer instanceof L.Marker) {
                item.latLng = layer.getLatLng();
//				console.log (fname + ": layer.getLatLng()=" + JSON.stringify(item.latLng) + "portalDetails.latE6=" + portalDetails.latE6 + ", portalDetails.lngE6=" + portalDetails.lngE6);
                foundMarker = ((item.latLng.lat == portalDetails.latE6 / 1E6) &&
                               (item.latLng.lng == portalDetails.lngE6 / 1E6));
//				console.log (fname + ": foundMarker=" + foundMarker + ", layer.getLatLng()=" + JSON.stringify(item.latLng) + "portalDetails.latE6=" + portalDetails.latE6 + ", portalDetails.lngE6=" + portalDetails.lngE6);
            }
            return foundMarker;
        });
        return (index != -1);
    };
    //
    // Removes the marker (map pin) on the portal shown in the sidebar portal details.
	// Only one marker is removed at a time.  If for some reason multiple markers have
	// been put at the same location, multiple removes will need to be done.
    //
    self.removeMarker = function () {
        var fname = namespace + ".removeMarker";
        var count = 0,
            data = [], // For layer data
            maker = null, //Leaflet Layer()
            portalDetails,
            refreshLayers = false,
            title;
        // 1. Get the marker data. In this case, the poiMarker.checkPortalDetailLoaded() hook
        //    will have saved it when it was loaded into the sidebar portal details area.
        if (!self.portalDataInPortalDetails) {
            alert("Select a portal to load the portal details before attempting to remove a marker.");
            return;
        }
        title = (self.portalDataInPortalDetails && self.portalDataInPortalDetails.portalDetails.title) ? self.portalDataInPortalDetails.portalDetails.title : "[NO PORTAL DATA]";
        console.log(fname + ": guid:=" + self.portalDataInPortalDetails.guid + ", title:=" + title + ", have portal details=" + !!self.portalDataInPortalDetails);
        portalDetails = self.portalDataInPortalDetails.portalDetails;
        // 2. Find the first marker with the same latitude and longitude.
        marker = window.plugin.drawTools.drawnItems.getLayers().find (function(layer) {
            var latLng;
            if (layer instanceof L.Marker) {
                latLng = layer.getLatLng();
                return (latLng.lat == portalDetails.latE6 / 1E6) &&
                    (latLng.lng == portalDetails.lngE6 / 1E6);
            } else {
                return false;
            }
        });
        // 3. If marker found, remove the marker, save, run draw hooks, and notify the ingress planner if it's being used.
        if (marker) { // if not undefined
            console.log(fname + ": Removing marker for portal " + title);
            window.plugin.drawTools.drawnItems.removeLayer(marker);
            runHooks('pluginDrawTools',{event:'layersDeleted'}); // Per draw-tools line #670 in the map.on('draw:deleted', ...) function
            console.log(fname + ": calling window.plugin.drawTools.save();");
            window.plugin.drawTools.save();
        } else {
            console.log(fname + ": Portal marker not found. Portal title: " + title);
        }
    };
    //
    // Setup function called by IITC.
    //
    self.setup = function init() {
        var fname = namespace + ".addRemoveMarker.setup";
        var controlsHTML;
        if (window.plugin.drawTools === undefined) {
            alert('IITC plugin "Add and Remove Marker" requires IITC plugin "draw tools".');
            return;
        }
        // Link to Google Material icons.
        $("head").append('<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family\=Material+Icons">');
        // Add toolbox controls.
        controlsHTML = '<div><span id="arm-controls"style="display:block;color:#03fe03;">' +
            '<a id="arm-addMarker" onclick="window.plugin.addRemoveMarker.addMarker();false;" title="Click to add a portal marker.">' +
            '<i class="material-icons" style="font-size:16px;color:#ffce00;">add_location</i> Add Marker</a>' +
            ' &nbsp;<a id="arm-removeMarker" onclick="window.plugin.addRemoveMarker.removeMarker();false;" title="Click to remove the portal marker.">' +
            '<i class="material-icons" style="font-size:16px;color:#ffce00;-webkit-transform: rotate(180deg);-moz-transform: rotate(180deg);-ms-transform: rotate(1805deg);-o-transform: rotate(180deg);transform: rotate(180deg);">format_color_reset</i>' +
            ' Remove Marker</a>' +
            '</span></div>';
        $("#toolbox").append(controlsHTML);
        // Add hook for portal details updated.
        window.addHook('portalDetailsUpdated', self.checkPortalDetailsUpdated);
        console.log(fname + ": Done.");
        delete self.setup; // Delete setup to ensure init can't be run again.
    };
    self.setup.info = plugin_info;
    // IITC plugin setup
    if (window.iitcLoaded && typeof self.setup === "function") {
        self.setup();
    } else if (window.bootPlugins) {
        window.bootPlugins.push(self.setup);
    } else {
        window.bootPlugins = [self.setup];
    }
}

//
// Add as script
//
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
var script = document.createElement("script");
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
