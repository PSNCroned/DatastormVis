var updated = {};

//Get data by layer name
var getLayer = function (layer) {
	if (updated[layer]) {
		socket.emit("getLayer", layer);
	}
	else {
		renderLayers($("#time_scrub .slider").val());
	}
};

//Detect a successful initial socket connection
socket.on("connected", function () {
	console.log("Connected to socket server");
});

//When list of layers is received
socket.on("layerList", function (list) {
	$("#layers .inner_expand").html("");

	var option;
	list.forEach(function (layer) {
		if (!(layer in updated)) {
			//Tell user that layer has been updated
			updated[layer] = true;

			//Add settings form for layer
			option = $(optionTemplates.layer(layer));
			$("#layers .inner_expand").append(option);

			//Set default color of layer
			settings[layer] = {
				color: "0000ff"
			};

			layers[layer] = {
				features: [],
				layer: L.geoJSON([], {onEachFeature: onEachFeature}).addTo(map),
				style: null,
				type: null
			};
		}
	});
});

//When layer data is recieved
socket.on("data", function (data) {
	updated[data.config.label] = false;
	setLayerData(data);
	renderLayers($("#time_scrub .slider").val());
});

//When the data is updated on the server
socket.on("updated", function (list) {
	list.forEach(function (label) {
		updated[label] = true;
	});
});
