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


    /**
     * Parse a key envelope.
     *
     * Taken from: https://www.pidder.de/pidcrypt/?page=demo_rsa-encryption
     * We acknowledge the pidCrypt library authors.
     */
    function certParser(cert) {
        var lines = cert.split('\n');
        var read = false;
        var b64 = false;
        var end = false;
        var flag = '';
        var retObj = {};
        retObj.info = '';
        retObj.salt = '';
        retObj.iv;
        retObj.b64 = '';
        retObj.aes = false;
        retObj.mode = '';
        retObj.bits = 0;
        for (var i = 0; i < lines.length; i++) {
            flag = lines[i].substr(0, 9);
            if (i == 1 && flag != 'Proc-Type' && flag.indexOf('M') == 0) //unencrypted cert?
                b64 = true;
            switch (flag) {
                case '-----BEGI':
                    read = true;
                    break;
                case 'Proc-Type':
                    if (read)
                        retObj.info = lines[i];
                    break;
                case 'DEK-Info:':
                    if (read) {
                        var tmp = lines[i].split(',');
                        var dek = tmp[0].split(': ');
                        var aes = dek[1].split('-');
                        retObj.aes = (aes[0] == 'AES') ? true : false;
                        retObj.mode = aes[2];
                        retObj.bits = parseInt(aes[1]);
                        retObj.salt = tmp[1].substr(0, 16);
                        retObj.iv = tmp[1];
                    }
                    break;
                case '':
                    if (read)
                        b64 = true;
                    break;
                case '-----END ':
                    if (read) {
                        b64 = false;
                        read = false;
                    }
                    break;
                default:
                    if (read && b64)
                        retObj.b64 += pidCryptUtil.stripLineFeeds(lines[i]);
            }
        }
        return retObj;
    }

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
         * Encryption function using the pidCrytp library.
         *
         * Taken from: http://cryptojs.altervista.org/publickey/doc/doc_rsa_pidcrypt.html
         * We acknowledge the pidCrypt library authors.
         */
        encrypt: function(plaintext) {
            var params = certParser(pub_key);
            var key = pidCryptUtil.decodeBase64(params.b64);

            // new RSA instance
            var rsa = new pidCrypt.RSA();

            // ASN1 parsing
            var asn = pidCrypt.ASN1.decode(pidCryptUtil.toByteArray(key));
            var tree = asn.toHexTree();

            // setting the public key for encryption with retrieved ASN.1 tree
            rsa.setPublicKeyFromASN(tree);

            /*** encrypt */
            var crypted = rsa.encrypt(plaintext);
            var fromHex = pidCryptUtil.encodeBase64(pidCryptUtil.convertFromHex(crypted));
            return pidCryptUtil.fragment(fromHex, 64);
        },


        /**
         * Encode a list of bytes as a base64 string.
         *
         * From: http://codereview.stackexchange.com/a/3589
         * We acknowledge @Mike Samuel for the answer.
         */
        pack: function(bytes) {
            return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));
        },


        /**
         * Get a list of bytes from a string.
         *
         * From: http://codereview.stackexchange.com/a/3589
         * We acknowledge @Mike Samuel for the answer.
         */
        getIntBytes: function(x) {
            var bytes = [];
            var i = 5;
            do {
                bytes[--i] = x & (255);
                x = x >> 8;
            } while (i)
            return bytes;
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
                while(ret.length < 4){
                    ret = "0"+ret;
                }
                return ret;
            };
            return (S4(buf[0])+S4(buf[1])+"-"+S4(buf[2])+"-"+S4(buf[3])+"-"+S4(buf[4])+"-"+S4(buf[5])+S4(buf[6])+S4(buf[7]));
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
