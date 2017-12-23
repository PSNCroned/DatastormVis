//Templates for layer/group dropdowns
var optionTemplates = {
	"layer": function (label) {
		return "<div class='option' data-layer='" + label + "'><span class='optTop'>"
			+ "<span class='optionText'>" + label + "</span>" +
			"<span class='triToggle closed'>◀</span>\
			<span class='triToggle open'>▼</span></span>\
			<form class='settings'></form>\
		</div>"
	},
	"group": function (label) {
		return "<div class='option' data-group='" + label + "'><span class='optTop'>"
			+ "<span class='optionText'>" + label + "</span>" +
			"<span class='triToggle closed'>◀</span>\
			<span class='triToggle open'>▼</span></span>\
			<form class='settings'>\
				<div class='settingLabel'>Layers</div>\
				<div class='setting' data-setting='layers'></div>\
			</form>\
		</div>"
	}
};

//Templates for settings of layers (based on layer type)
var settingTemplates = function (layer) {
	var res = "<div class='settingLabel'>Color</div><input class='jscolor' data-setting='color' value='" + settings[layer].color + "' />";
	
	switch (layers[layer].type) {
		case "area":
			res += "<div class='setting'><div class='settingLabel'>Border</div><input type='checkBox' data-setting='stroke' " + (settings[layer].stroke ? "checked" : "") + " /></div>";
			break;
		case "area_value":
			res += "<div class='setting'><div class='settingLabel'>Border</div><input type='checkBox' data-setting='stroke' " + (settings[layer].stroke ? "checked" : "") + " /></div>";
			res += "<div class='setting'><div class='settingLabel'>Opacity Weight</div><input type='number' data-setting='weight' value='" + settings[layer].weight + "' /></div>";
			break;
		case "vector":
			res += "<div class='setting'><div class='settingLabel'>Line Weight</div><input type='number' data-setting='weight' value='" + settings[layer].weight + "' /></div>";
			break;
	}
	
	res += "<div class='setting'><div class='settingLabel'>Group</div><input type='text' data-setting='group' value='" + settings[layer].group + "' /></div>";
	
	return res;
};

//Templates for gorups settings
var groupSettingTemplate = function () {
	return "\
	<div class='setting'><div class='settingLabel'>Opacity Percent</div><input type='number' data-setting='opacity' value='1.0' /></div>\
	<div class='setting'><div class='settingLabel'>Aggregate</div><input type='checkBox' data-setting='aggregate') /></div>\
	";
};