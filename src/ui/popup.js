/* Copyright © 2010-2012 HTTPS Everywhere authors. All rights reserved.
 * Use of this source code is governed by a GPL v2+ license that can be
 * found in the LICENSE file. */
"use strict";

// load content of popup
document.addEventListener("DOMContentLoaded", function() {
	var basicStats = document.getElementById("BasicStats");
	var options = document.getElementById("Options");

	// get the extension's current version.
	var the_manifest = chrome.runtime.getManifest();
	$("#currentversion")[0].innerText = the_manifest.version;

	// set the title
	document.title = the_manifest.name;
	$('h1').append(document.title);

	// toggle option for whether we send or not the stats
	getOption_('sendStats', false, function(item) {
		var sendCheckbox = document.getElementById('send-data-checkbox');
		sendCheckbox.addEventListener('click', toggleSendData, false);
		var sendDataEnabled = item.sendStats;
		console.log("Checkbox state: " + sendDataEnabled);
		if (sendDataEnabled) {
			sendCheckbox.setAttribute('checked', '');
		}
	});

	$("#close_all")[0].addEventListener('click', function() {
		chrome.tabs.query({'pinned': false, 'active': false}, function (tabs) {
			var tabids = [];
			for (var i in tabs) {
				tabids.push(tabs[i].id);
			}
			chrome.tabs.remove(tabids);
		});
	});
});

// update stats
chrome.runtime.sendMessage({
	action: "stats"
}, function(response) {
	$("#created").html(response.created)
	$("#destroyed").html(response.removed)
	$("#ratio").html(response.ratio)
});

function toggleSendData() {
	getOption_('sendStats', false, function(item) {
		setOption_('sendStats', !item.sendStats);
	});
}

function getOption_(opt, defaultOpt, callback) {
	var details = {};
	details[opt] = defaultOpt;
	return chrome.storage.sync.get(details, callback);
}

function setOption_(opt, value) {
	var details = {};
	details[opt] = value;
	return chrome.storage.sync.set(details);
}
