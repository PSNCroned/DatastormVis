//Toggle CSS of layer options and add/remove it from rendering
var toggleLayer = function (el) {
	var layer = el.data("layer");
	var selected = el.hasClass("sel");
	
	el.toggleClass("sel");
	
	if (!selected) {
		getLayer(layer);
	}
	else {
		removeLayer(layer);
	}
	
};

//Expand setting sections
$(".expand_head").click(function () {
	$(this).parent().find(".inner_expand").slideToggle({duration: 200});
});

//When a layer name is toggled
$("body").on("click", ".optTop", function () {
	var type = $(this).parent().parent().parent().attr("id");
	var label = $(this).parent().data("layer") || $(this).parent().data("group");
	
	switch (type) {
		case "layers":
			toggleLayer($(this).parent());
			break;
		case "groups":
			$(this).parent().toggleClass("sel");
			
			if ($(this).parent().find(".setting").length <= 1) {
				genSettingHtml(label, true);
			}
			break;
	}
	
	$(this).parent().find(".settings").slideToggle({duration: 200});
	$(this).find(".triToggle").toggle();
});

//When time scrubber is moved
$("#time_scrub .slider").on("input", function (e) {
	$("#curTime .hour").text(e.target.value * date.minRes);
	renderLayers(e.target.value * date.minRes);
});

//When layers are reordered
$(".inner_expand").sortable({
	containment: "parent",
	update: function () {
		renderLayers($("#time_scrub .slider").val());
	}
});

//Show/hide right panel
$("#rightSlide").click(function () {
	if (parseInt($(this).data("visible"))) {
		$(this).data("visible", "0");
		$(this).text("◀");
		$("#controls").animate({right: "-20%"});
		$("#right_panel").animate({right: "-20%"});
	}
	else {
		$(this).data("visible", "1");
		$(this).text("▶");
		$("#controls").animate({right: "0px"});
		$("#right_panel").animate({right: "0px"});
	}
});

//Show/hide bottom panel
$("#downSlide").click(function () {
	if (parseInt($(this).data("visible"))) {
		$(this).data("visible", "0");
		$(this).text("▲");
		$("#time_scrub").animate({bottom: "-10%"});
		$("#bottom_panel").animate({bottom: "-10%"});
		$("#controls").animate({height: "100%"});
		$("#right_panel").animate({height: "100%"});
	}
	else {
		$(this).data("visible", "1");
		$(this).text("▼");
		$("#time_scrub").animate({bottom: "0px"});
		$("#bottom_panel").animate({bottom: "0px"});
		$("#controls").animate({height: "90%"});
		$("#right_panel").animate({height: "90%"});
	}
});

//When a layer/group setting is changed
$("body").on("change", ".settings input", function () {
	var label = $(this).parent().parent().parent().data("layer") || $(this).parent().parent().parent().data("group");
	var setting = $(this).data("setting");
	var value = $(this).val();
	
	if (setting == "color" && value.length == 6 && value.indexOf("#") != 0) {
		value = "#" + value;
	}
	else if ($(this).attr("type") == "checkBox") {
		value = $(this).is(":checked");
	}
	else if (setting == "group") {
		updateGroups(value, label, true);
	}
	
	updateStyle(label, setting, value);
});

//When a global setting is changed
$("body").on("change", ".gSetting select, .gSetting input", function () {
	var setting = $(this).data("setting");
	var value = $(this).val();
	
	switch (setting) {
		case "hover":
			gSettings.hover = value;
			break;
	}
});

//Generate the setting html when a layer is toggled
var genSettingHtml = function (label, isGroup) {
	if (!isGroup) {
		$(".option[data-layer='" + label + "'] .settings")
			.html(settingTemplates(label));
		
		//Since the setting html was added after jscolor was
		//initialized, we must manually have it check for new
		//elements with the .jscolor class
		jscolor.installByClassName("jscolor");
	}
	else {
		$(".option[data-group='" + label + "'] .settings")[0].innerHTML += groupSettingTemplate();
	}
};

//Update the html display of the groups
var updateGroups = function (group, layer, add) {
	var oldGroup = settings[layer].group;
	
	if (group) {
		var groupSelector = "[data-group='" + group + "']";

		if ($("#groups .inner_expand " + groupSelector).length) {
			$(groupSelector + " [data-setting='layers']").append($("<div class='gLayer'>" + layer + "</div>"));
		}
		else {
			var option = $(optionTemplates.group(group));
			$("#groups .inner_expand").append(option);
			option.find("[data-setting='layers']").append($("<div class='gLayer'>" + layer + "</div>"));
		}
	}
	
	if (oldGroup) {
		$("[data-group='" + oldGroup + "'] .gLayer:contains('" + layer + "')").remove();
		if (!$("[data-group='" + oldGroup + "'] .gLayer").length)
			$("[data-group='" + oldGroup + "']").remove();
	}
};

//Allow for layer style changes on hover
var onEachFeature = function (feature, layer) {
	layer.on({
		mouseover: function (e) {
			var feature = e.target.feature;
			var layer = layers[feature.properties.label].layer;
			
			if (gSettings.hover == "layer") {
				layer.setStyle({stroke: true, color: "black", weight: 3});
			}
			else if (gSettings.hover == "element") {
				e.target.setStyle({stroke: true, color: "black", weight: 3});
			}
		},
		mouseout: function (e) {
			var feature = e.target.feature;
			var layer = layers[feature.properties.label].layer;
			
			layer.setStyle(settings[feature.properties.label]);
		}
	});
};