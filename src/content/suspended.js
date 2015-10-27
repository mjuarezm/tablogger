/**
 * @license MIT
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
 * @fileoverview Content script to be injected to suspended tabs.
 */
(function() {
    // Send message containing tab info to the backgorund script.
    chrome.runtime.sendMessage({
        action: 'tabinfo'
    }, function(response) {
        var titleEl = document.getElementById('title');
        var title = response.title.indexOf('<') < 0 ? response.title : htmlEncode(response.title);
        titleEl.innerHTML = title;
        document.title = response.title;
        generateFaviconUri(response.favicon, function(fav) {
            setFavicon(fav);
        });
    });


    /**
     * Set the favicon to the page.
     *
     * The MIT License
     * Copyright (c) 2015 Dean Oemcke
     * Source: https://github.com/deanoemcke/thegreatsuspender
     * We acknowledge the author.
     */
    function setFavicon(favicon) {
        document.getElementById('favicon').setAttribute('href', favicon);
    }


    /**
     * Generate a faded favicon to display when suspended.
     *
     * The MIT License
     * Copyright (c) 2015 Dean Oemcke
     * Source: https://github.com/deanoemcke/thegreatsuspender
     * We acknowledge the author.
     */
    function generateFaviconUri(url, callback) {
        var img = new Image(),
            boxSize = 9;
        img.onload = function() {
            var canvas, context;
            canvas = window.document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            context = canvas.getContext('2d');
            context.globalAlpha = 0.5;
            context.drawImage(img, 0, 0);
            callback(canvas.toDataURL());
        };
        img.src = url || chrome.extension.getURL('img/default.ico');
    }
})()