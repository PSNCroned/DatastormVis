//Import modules
var express = require("express");
var app = express();
var server = require("http").Server(app);
var io = require("socket.io").listen(server);
var bodyParser = require("body-parser");
var fs = require("fs");
var path = require("path");
var proj4 = require("proj4");
var async = require("async");
var ip = require("ip");

//Set hosting port to command line argument or default 1080
var PORT = process.argv[2] || 1080;

//List of layers
var layerList = [];

//Set the /public directory as a directory for statically served files
app.use('/public', express.static(__dirname + '/public'))

//For parsing post data
app.use(bodyParser.urlencoded({extended: true}));

//Set view engine to ejs
app.set("view engine", "ejs");

//Run server
server.listen(PORT, function () {
	console.log("Listening on port " + PORT);
});

//Handle get requests
app.get("/", function (req, res) {
	//Render index.ejs in /views with ip and port of server
	res.render(__dirname + "/views/index", {ip: ip.address(), port: PORT});
});

app.post("/input", function (req, res) {
	//when actor receives input
	var data = JSON.parse(req.body.data);
	var config = JSON.parse(req.body.config);

	//process data and config
	parseData(data, config, function (err) {
		if (err)
			console.log(err);
		else {
			console.log("Saved " + config.label + " data");
			layerList.push(config.label);
			getLayerList(function (layers) {
				io.sockets.emit("updated", layers);
			});
		}
	});

	//Only for when not connected to actor and reading data from local file
	/*
	var dir = __dirname + "/data_raw/";
	fs.readdir(dir, function (err, folders) {
		cycleFolders(dir, folders, function () {
			console.log("All new data processed!");
			io.sockets.emit("updated", folders);
		});
	});
	*/
});

//For when the actor verfies if the server is running
app.get("/ping", function (req, res) {
	res.send("true");
});

//Converts coordinates from epsg3086 to epsg4326
var convertCoords = function (coords) {
	var epsg3086 = "+proj=aea +lat_1=24 +lat_2=31.5 +lat_0=24 +lon_0=-84 +x_0=400000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=m +no_defs";
	var epsg4326 = "EPSG:4326";

	return proj4(epsg3086, epsg4326, coords)
};

//just for placeholder data input
var cycleFolders = function (dir, folders, cb) {
	if (folders.length) {
		var folder = folders[0];

		var parse = function (csv, json) {
			parseData(
				csv,
				json,
				function (err) {
					if (err)
						console.log(err);
					else {
						console.log("Saved " + folder + " data");
						cycleFolders(dir, folders.slice(1, folders.length), cb);
					}
				}
			);
		};

		switch (folder) {
			case "flood":
				async.series({

					csv: function (cb) {
						fs.readFile(
							dir + folder + "/flooded_cells.csv", "utf8", cb
						);
					},

					json: function (cb) {
						fs.readFile(
							dir + folder + "/context.json", "utf8", cb
						);
					}

				}, function (err, res) {
					if (err)
						console.log("Error loading flood files: " + err);
					else
						parse(res.csv, JSON.parse(res.json));
				});
				break;
			case "rain":
				var fileReaders = {};
				fs.readFile(dir + folder + "/config.json", "utf8", function (err, json) {
					json = JSON.parse(json);

					for (var i = 0; i < json.res.time.stepAmt; i++) {
						fileReaders["csv_" + i] = (function (i) {
							return function (cb) {
								fs.readFile(
									dir + folder + "/rain_" + i + ".csv", "utf8", cb
								);
							};
						})(i);
					}

					async.series(fileReaders, function (err, res) {
						if (err)
							console.log("Error loading rain files: " + err);
						else {
							var csvList = [];
							for (i = 0; i < json.res.time.stepAmt; i++) {
								csvList.push(res["csv_" + i]);
							}
							parse(csvList, json);
						}
					});
				});
				break;
			case "wind":
				var fileReaders = {};
				fs.readFile(dir + folder + "/config.json", "utf8", function (err, json) {
					json = JSON.parse(json);

					for (var i = 0; i < json.res.time.stepAmt; i++) {
						fileReaders["csv_u_" + i] = (function (i) {
							return function (cb) {
								fs.readFile(
									dir + folder + "/U_" + i + ".csv", "utf8", cb
								);
							};
						})(i);

						fileReaders["csv_v_" + i] = (function (i) {
							return function (cb) {
								fs.readFile(
									dir + folder + "/V_" + i + ".csv", "utf8", cb
								);
							};
						})(i);
					}

					async.series(fileReaders, function (err, res) {
						if (err)
							console.log("Error loading wind files: " + err);
						else {
							var csvList = [];
							for (i = 0; i < json.res.time.stepAmt; i++) {
								csvList.push([res["csv_u_" + i], res["csv_v_" + i]]);
							}
							parse(csvList, json);
						}
					});
				});
				break;
		}
	}
	else
		cb();
};

//convert data from csv to json to be read by client
var parseData = function (csv, json, cb) {
	console.log(json.label + " : " + json.visType);
	var data = [], config, saveFiles = false;

	json.label = json.label.toLowerCase();
	config = {
		label: json.label,
		visType: json.visType,
		group: json.group || "none",
		metadata: json.metadata
	};

	switch (json.visType) {
		case "area":
			csv = csv.split("\n");

			config.time = {
				stepSize: json.time.step_size,
				unit: json.time.unit,
				start: json.time.begin,
				end: json.time.end
			};

			var dims = csv[0].split(",");
			var bounds, dims, topLeft, topRight, botLeft, botRight;

			csv.splice(0, 1);

			csv.forEach(function (tile) {
				tile = tile.split(",");

				bounds = [
					parseInt(json.map_statistics.west),
					parseInt(json.map_statistics.north)
				];

				dims = [
					parseInt(json.map_statistics.ewres),
					parseInt(json.map_statistics.nsres)
				];

				topLeft = convertCoords([
					parseInt(tile[1]) * dims[0] + bounds[0],
					-1 * (parseInt(tile[2]) * dims[1]) + bounds[1]
				]);

				topRight = convertCoords([
					(parseInt(tile[1]) + 1) * dims[0] + bounds[0],
					-1 * (parseInt(tile[2]) * dims[1]) + bounds[1]
				]);

				botRight = convertCoords([
					(parseInt(tile[1]) + 1) * dims[0] + bounds[0],
					-1 * ((parseInt(tile[2]) + 1) * dims[1]) + bounds[1]
				]);

				botLeft = convertCoords([
					parseInt(tile[1]) * dims[0] + bounds[0],
					-1 * ((parseInt(tile[2]) + 1) * dims[1]) + bounds[1]
				]);

				data.push({
					time: parseInt(tile[0] - 1),
					coords: [
						topLeft,
						topRight,
						botRight,
						botLeft
					]
				});
			});

			saveFiles = true;
			break;
		case "area_value":
			var bounds = json.res.space.bound;
			var step = parseFloat(json.res.space.step);
			var timeStep = parseInt(json.res.time.stepSize);
			var topLeft, topRight, botRight, botLeft, rows;

			config.time = {
				stepSize: json.res.time.stepSize,
				unit: json.res.time.unit,
				start: json.res.time.begin,
				end: json.res.time.end
			};

			csv.forEach(function (csv, index) {
				rows = csv.split("\n");

				rows.forEach(function (row, i) {
					row = row.split(",");

					row.forEach(function (cell, j) {

						cell = parseFloat(cell);

						if (cell > 0) {
							topLeft = [
								j * step + bounds.lon_min,
								-1 * (i * step) + bounds.lat_max
							];

							topRight = [
								(j + 1) * step + bounds.lon_min,
								-1 * (i * step) + bounds.lat_max
							];

							botRight = [
								(j + 1) * step + bounds.lon_min,
								-1 * ((i + 1) * step) + bounds.lat_max
							];

							botLeft = [
								j * step + bounds.lon_min,
								-1 * ((i + 1) * step) + bounds.lat_max
							];

							data.push({
								time: index,
								coords: [
									topLeft,
									topRight,
									botRight,
									botLeft
								],
								value: cell
							});
						}
					});
				});
			});

			saveFiles = true;
			break;
		case "vector":
			var bounds = json.res.space.bound;
			var step = parseFloat(json.res.space.step);
			var timeStep = parseInt(json.res.time.stepSize);
			var csv_u, csv_v, width, height, pos;

			config.time = {
				stepSize: json.res.time.stepSize,
				unit: json.res.time.unit,
				start: json.res.time.begin,
				end: json.res.time.end
			};

			csv.forEach(function (csv, index) {
				csv_u = csv[0].split("\n");
				csv_v = csv[1].split("\n");

				width = csv_u[0].split(",").length;
				height = csv_u.length;

				for (var i = 0; i < height; i++) {

					for (var j = 0; j < width; j++) {
						pos = {
							x: j * step + bounds.lon_min,
							y: -1 * (i * step) + bounds.lat_max
						};

						data.push({
							base: pos,
							vec: {
								x: parseFloat(csv_u[i].split(",")[j]),
								y: parseFloat(csv_v[i].split(",")[j])
							},
							time: index
						});
					}
				}
			});

			saveFiles = true;
			break;
		default:
			console.log(json.visType + " is not a valid vis type");
			cb();
	}

	if (saveFiles) {
		async.series([
			function (cb) {
				fs.exists(__dirname + "/data/" + json.label, function (exists) {
					if (!exists)
						fs.mkdir(__dirname + "/data/" + json.label, cb);
					else
						cb();
				});
			},

			function (cb) {
				fs.writeFile(
					__dirname + "/data/" + json.label + "/data.json", JSON.stringify(data),
					cb
				);
			},

			function (cb) {
				fs.writeFile(
					__dirname + "/data/" + json.label + "/config.json", JSON.stringify(config),
					cb
				);
			}
		], function (err) {
			if (err)
				console.log("Error saving " + json.label + " data: " + err);
			else {
				cb();
			}
		});
	}
};

//Get layer data from db
var getLayer = function (name, cb) {
	name = name.toLowerCase();

	fs.readFile(__dirname + "/data/" + name + "/data.json", "utf8", function (err, data) {
		if (err) {
			console.log("Error loading " + name + " data csv");
			cb({});
		}
		else {
			fs.readFile(__dirname + "/data/" + name + "/config.json", "utf8", function (err, config) {
				if (err) {
					console.log("Error loading " + name + " config");
					cb({});
				}
				else {
					cb({data: JSON.parse(data), config: JSON.parse(config)});
				}
			});

		}
	});
};

//returns an array of all of the layers
var getLayerList = function (cb) {
	return layerList;

	//Only for when not connected to actor and reading data from local file
	/*fs.readdir(__dirname + "/data/", function (err, layers) {
		if (err) {
			cb([]);
		}
		else {
			console.log(layers);
			cb(layers);
		}
	});*/
};

//Handle socket connections
io.on("connection", function (socket) {
	var sid = socket.id;

	socket.emit("connected");

	getLayerList(function (layers) {
		socket.emit("layerList", layers);
	});

	socket.on("getLayer", function (layerName) {
		getLayer(layerName, function (data) {
			socket.emit("data", data);
		});
	});

	socket.on("disconnect", function () {
		//
	});
});

//Prevent server from crashing on errors
process.on("uncaughtException", function (err) {
	console.log(err);
});
