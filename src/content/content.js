/**
 * @license
 * Copyright (c) 2015 WF Team.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/**
 * @fileoverview Content script that the extension injects in all web pages.
 */
(function() {
	// Listen to the onLoaded event and attach a callback to it.
	//TODO: this is tricky, we might miss some pages since onLoad event might not be triggered.
	jQuery(window).load(function() {
		// See: http://stackoverflow.com/a/7083802
		setTimeout(function() {
			chrome.runtime.sendMessage({event : "onLoaded"}, function(response) {
				console.log(response.msg);
			});
		}, 100);
	});

	// Listener for messages sent from the background script.
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		var cur_url = window.location.href;
		switch (request) {
		case 'suspendTab':
			var new_url = generateSuspendedUrl(cur_url);
	        window.location.replace(new_url);
			break;
		case 'reloadTab':
			var new_url = getSuspendedUrl(cur_url);
			console.log(new_url);
	        window.location.replace(new_url);
			break;
		default:
			break;
		}
	});

	/**
	 * Construct the URL that is displayed when a tab is suspended.
	 *
	 * The MIT License
	 * Copyright (c) 2015 Dean Oemcke
	 * Source: https://github.com/deanoemcke/thegreatsuspender
	 * We acknowledge the author.
	 */
	function generateSuspendedUrl(tabUrl, useBlank) {
	    var args = '#uri=' + tabUrl;
	    if (tabUrl.indexOf('suspended.html') >= 0) {
	    	return tabUrl;
	    }
	    return chrome.extension.getURL('suspended.html' + args);
	}


	/**
	 * Obtain the original URL from the suspended URL.
	 *
	 * The MIT License
	 * Copyright (c) 2015 Dean Oemcke
	 * Source: https://github.com/deanoemcke/thegreatsuspender
	 * We acknowledge the author.
	 */
	function getSuspendedUrl(url) {
	    return url.substring(url.indexOf('#uri=') + 5)
	}
})()
