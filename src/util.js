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
 * @fileoverview This module offers a set of general purpose methods.
 */
var util = (function() {

    /* Private module configuration variables. */

    var extension = '.log';


    /* Public namespace */
    return {
        /* Module methods. */

        /**
         * Send and HTTP request to a web server.
         */
        sendRequest: function(dest, body, method, cbk) {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    cbk();
                }
            }
            xhr.open(method, dest, true);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.send(body);
        },


        /**
         * Encryption function from JSBN crypto library.
         *
         * Taken from: http://cryptojs.altervista.org/publickey/doc/doc_rsa_pidcrypt.html
         * Copyright (c) 2005  Tom Wu. All Rights Reserved. See LICENSE file for details.
         */
        encrypt: function(ua) {
            var rsa = new RSAKey();
            rsa.setPublic(tablogs.N, tablogs.e);
            var res = rsa.encrypt(ua);
            return this.hex2b64(res);
        },


        /**
         * Converts from hex string to base64, from JSBN crypto library.
         *
         * Copyright (c) 2005  Tom Wu. All Rights Reserved. See LICENSE file for details.
         */
        hex2b64: function(h) {
            var b64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var b64padchar = "=";
            var i;
            var c;
            var ret = "";
            for (i = 0; i + 3 <= h.length; i += 3) {
                c = parseInt(h.substring(i, i + 3), 16);
                ret += b64map.charAt(c >> 6) + b64map.charAt(c & 63);
            }
            if (i + 1 == h.length) {
                c = parseInt(h.substring(i, i + 1), 16);
                ret += b64map.charAt(c << 2);
            } else if (i + 2 == h.length) {
                c = parseInt(h.substring(i, i + 2), 16);
                ret += b64map.charAt(c >> 2) + b64map.charAt((c & 3) << 4);
            }
            while ((ret.length & 3) > 0) ret += b64padchar;
            return ret;
        },


        /**
         * Get a list of bytes from a string.
         *
         * From: https://jsfiddle.net/magikMaker/7bjaT/
         * We acknowledge @magikMakerfor for the jsFiddle.
         */
        base64EncodeUrl: function(str) {
            return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=/g, '');
        },


        /**
         * Get a list of bytes from a string.
         *
         * From: http://codereview.stackexchange.com/a/3589
         * We acknowledge @Mike Samuel for the answer.
         */
        getIntBytes: function(x, i) {
            var bytes = [];
            do {
                bytes[--i] = x & 0xFF;
                x = x >> 8;
            } while (i)
            return bytes;
        },


        /**
         * Error handler callback function.
         */
        handleError: function(e) {
            console.log('Error', e);
        },



        /**
         * Generate a unique ID of the extension using the crypto standard API for web.
         * For more info see: https://developer.mozilla.org/en-US/docs/Web/API/RandomSource/getRandomValues
         * This is a modified version of boofa and ripper234 answers in: https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
         * We acknowledge the authors.
         */
        getID: function() {
            var buf = new Uint16Array(8);
            window.crypto.getRandomValues(buf);
            var S4 = function(num) {
                var ret = num.toString(16);
                while (ret.length < 4) {
                    ret = "0" + ret;
                }
                return ret;
            };
            return (S4(buf[0]) + S4(buf[1]) + "-" + S4(buf[2]) + "-" + S4(buf[3]) + "-" + S4(buf[4]) + "-" + S4(buf[5]) + S4(buf[6]) + S4(buf[7]));
        },


        /**
         * Initialize or retrive from local storage the ID of the extension.
         */
        initializeID: function() {
            var idfname = "ID";
            var _this = this;
            filesystem.exists(idfname, function(exists) {
                // read file
                if (exists) {
                    filesystem.read(idfname, function(id) {
                        if (tablogs.DEBUG) {
                            console.log("Extension has found the installation ID: " + id);
                        }
                        tablogs.RANDOMID = id;
                    });
                } else {
                    tablogs.RANDOMID = _this.getID();
                    if (tablogs.DEBUG) {
                        console.log("Extension has generated the installation ID: " + tablogs.RANDOMID);
                    }
                    filesystem.write(idfname, tablogs.RANDOMID);
                }
            })
        },


        /**
         * Return domain from URL.
         */
        getDomain: function(url_str) {
            var loc = document.createElement('a');
            loc.href = url_str;
            return loc.hostname.slice(0,4) == 'www.' ? loc.hostname.slice(4) : loc.hostname;
        },


        /**
         * Check whether a tab is suspended or not.
         *
         * The MIT License
         * Copyright (c) 2015 Dean Oemcke
         * Source: https://github.com/deanoemcke/thegreatsuspender
         * We acknowledge the author.
         */
        isSuspended: function(tab) {
            return tab.url.indexOf('suspended.html') >= 0;
        }
    }
})()

// Export to be used in tests
if (typeof exports !== 'undefined') { exports.util = util}