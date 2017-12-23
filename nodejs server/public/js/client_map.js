//leaflet.js map
var map = L.map("map").setView([27.715,  -83.83], 6);

//Time scrubber object
var date = {
	start: Infinity,
	end: 0,
	minRes: Infinity
};

//Layers and settings
var layers = {};
var settings = {};
var gSettings = {
	hover: "none"
};

//When data for a layer is received, add its elements to the leaflet.js map using geojson
//and set default styles
var setLayerData = function (data) {
	console.log("----------------");
	console.log(data.config.label);
	console.log(data);
	
	var start, end, offset = 0;
	var config = data.config;
	data = data.data;
	
	var layerObj = layers[config.label];
	layerObj.features = {};
	layerObj.type = config.visType;
	layerObj.stepSize = config.time.stepSize * config.time.unit;
	
	//Add metadata to layer as a tooltip
	if (config.metadata) {
		layerObj.layer.bindTooltip(JSON.stringify(config.metadata)).addTo(map);
	}
	
	start = new Date(config.time.start);
	end = new Date(config.time.end);
	
	//Adjust time scrubber if necessary
	if (config.time.stepSize < date.minRes) {
		date.minRes = config.time.stepSize;
	}
	
	if (start.getTime() < date.start) {
		date.start = start.getTime();
		$("#startTime").text(config.time.start);
		$("#timeSlide").attr("max", parseInt((date.end - date.start) / (3600000 * date.minRes)));
	}
	else {
		offset = parseInt((start.getTime() - date.start) / (3600000 * date.minRes));
	}

	if (end.getTime() > date.end) {
		date.end = end.getTime();
		$("#endTime").text(config.time.end);
		$("#timeSlide").attr("max", parseInt((date.end - date.start) / (3600000 * date.minRes)));
	}
	
	//Add to group if one is specified
	if (config.group != "none") {
		updateGroups(config.group, config.label);
	}
	
	//Check visualization type
	switch (config.visType) {
		case "area":
			//Add default style of none set yet
			if (!layerObj.style) {
				settings[config.label] = {
					stroke: true,
					color: "#0000ff",
					group: config.group || ""
				};
				
				//Must be called after settings[config.label].group is set
				genSettingHtml(config.label);
				
				layerObj.style = function () {
					return settings[config.label];
				};
			}
			
			//Add geojson elements to leaflet.js layer
			data.forEach(function (x) {
				x.time = x.time + offset;
				if (!layerObj.features[x.time]) {
					layerObj.features[x.time] = [];
				}
				
				layerObj.features[x.time].push({
					type: "Feature",
					properties: {
						label: config.label
					},
					geometry: {
						type: "Polygon",
						coordinates: [[
							x.coords[0],
							x.coords[1],
							x.coords[2],
							x.coords[3],
							x.coords[0]
						]]
					},
				});
			});
			break;
			
		case "area_value":
			if (!layerObj.style) {
				settings[config.label] = {
					stroke: false,
					color: "#006600",
					weight: 3,
					group: config.group || ""
				};
				
				//Must be called after settings[config.label].group is set
				genSettingHtml(config.label);
				
				layerObj.style = function (feature) {
					return {
						stroke: settings[config.label].stroke,
						fillColor: settings[config.label].color,
						fillOpacity: feature.properties.value * settings[config.label].weight * (settings[config.label].group_opacity || 1)
					}
				};
			}
				
			data.forEach(function (x) {
				x.time = x.time + offset;
				if (!layerObj.features[x.time]) {
					layerObj.features[x.time] = [];
				}
				
				layerObj.features[x.time].push({
					type: "Feature",
					geometry: {
						type: "Polygon",
						coordinates: [[
							x.coords[0],
							x.coords[1],
							x.coords[2],
							x.coords[3],
							x.coords[0]
						]]
					},
					properties: {
						value: x.value,
						label: config.label
					}
				});
			});
			break;
			
		case "vector":
			if (!layerObj.style) {
				settings[config.label] = {
					color: "#ff0000",
					weight: 1,
					group: config.group || ""
				};
				
				//Must be called after settings[config.label].group is set
				genSettingHtml(config.label);
				
				layerObj.style = function (feature) {
					if (feature.properties.line) {
						return {
							color: settings[config.label].color,
							weight: 1 * settings[config.label].weight
						}
					}
					else {
						return {
							color: settings[config.label].color,
							weight: 3 * settings[config.label].weight
						}
					}
				};
			}
			
			data.forEach(function (x) {
				x.time = x.time + offset;
				if (!layerObj.features[x.time]) {
					layerObj.features[x.time] = [];
				}
				
				//Vectors are composed of two elements each: a line to show magnitude and
				//a point to show direction
				layerObj.features[x.time].push(
					{
						type: "Feature",
						geometry: {
							type: "LineString",
							coordinates: [
								[x.base.x, x.base.y],
								[x.base.x + (x.vec.x / 20), x.base.y + (x.vec.y / 20)]
							]
						},
						properties: {
							label: config.label,
							line: true
						}
					},
					{
						type: "Feature",
						geometry: {
							type: "LineString",
							coordinates: [
								[x.base.x + (x.vec.x / 20), x.base.y + (x.vec.y / 20)],
								[x.base.x + (x.vec.x / 20), x.base.y + (x.vec.y / 20)]
							]
						},
						properties: {
							label: config.label
						}
					},
					
				);
			});
			break;
				
		//Other planned visualization types
		case "graph":
			break;
		case "trajectory":
			break;
	}
	
	layers[config.label] = layerObj;
};

//Render each leaflet.js layer in the user's specified order
var renderLayers = function (time) {
	$("#layers .option").each(function () {
		var layerObj;
		var layer = $(this).data("layer");
		
		if (layer in layers) {
			layerObj = layers[layer];
			layerObj.layer.clearLayers();

			if ($("[data-layer='" + layer + "']").hasClass("sel")) {
				var features = [];
				for (var t in layerObj.features) {
					t = parseInt(t);
					if (t * layerObj.stepSize <= time && t * layerObj.stepSize > time - layerObj.stepSize) {
						layerObj.features[t].forEach(function (f) {
							features.push(f);
						});
					}
				}
				layerObj.layer.addData(features);
				layerObj.layer.setStyle(layerObj.style);
			}
		}
	});
};

var removeLayer = function (layer) {
	renderLayers($("#time_scrub .slider").val());
};

//Converts from EPSG:3086 (NAD83) to EPSG:4326 (WGS84)
var convertCoords = function (coords) {
	var epsg3086 = "+proj=aea +lat_1=24 +lat_2=31.5 +lat_0=24 +lon_0=-84 +x_0=400000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=m +no_defs";
	var epsg4326 = "EPSG:4326";
	
	return proj4(epsg3086, epsg4326, coords)
};

//Update style of a layer
var updateStyle = function (layer, style, value) {
	console.log("update: " + layer + " " + style + " " + value);
	
	if (layer in settings) {
		if (typeof style == "object")
			settings[layer] = style;
		else
			settings[layer][style] = value;

		layers[layer].layer.setStyle(layers[layer].style);
	}
	else {
		var layerList = $(".gLayer");
		var groupTag = $("#groups .optionText:contains('" + layer + "')");
		if (groupTag.length) {
			layerList.each(function () {
				layer = $(this).text();
				settings[layer]["group_" + style] = value;
				layers[layer].layer.setStyle(layers[layer].style);
			});
		}
	}
};


//Add a tile layer to map that uses a Mapbox map

L.tileLayer("https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}", {
	maxZoom: 15,
	id: "mapbox.light",
	accessToken: "pk.eyJ1IjoiZW5lc3RlciIsImEiOiJjajdqYXQ3cjUwYnFoMnFycmttZjVuZ21yIn0.8qGVqFrfmcdPx9nUpt00xw"
}).addTo(map);
