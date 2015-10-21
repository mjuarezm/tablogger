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
 * @fileoverview Main module of the tablogger extension.
 */
var tablogs = (function() {

    /* Private module configuration variables. */

    // Maximum number of lines logged in local storage.
    var MAX_LINES = 300000;

    // Number of bytes of quota for storage.
    var REQUESTED_BYTES = 1024 * 1024 * 10;

    // Seconds after which an inactive tab is put to sleep.
    var TAB_TIME = 90000;

    // Message to be displayed once after installation.
    var POPUP_MSG = "Do you allow this extenstion to send tab usage statistics " +
        "for research purposes? These statistics DO NOT include any" +
        "private data such as URLs, and are sent and stored encrypted.";

    // Encoding of event names for transmission.
    var EVENT = {
        'onCreated': 0x0,
        'onLoaded': 0x1,
        'onUpdated': 0x2,
        'onRemoved': 0x3
    };

    // Maximum time offset (im ms) between two consecutive events.
    var MAX_OFFET = 4194303;

    // Maximum tab id number in a session.
    var MAX_TABID = 65535;


    /* Main entry of the module. */
    main();


    /* Declaration of private functions. */

    /**
     * Main module function.
     */
    function main() {
        // Request for local storage.
        requestStorageQuota();

        // Ask for consent if we run for the first time.
        checkFirstRun();

        // Initialize open tabs.
        initializeTabs();

        // Set listener for content scripts.
        setMessageListener();

        // Load previous records.
        loadPreviousRecords();

        // Perdiocally check wheter a tab needs to go to sleep.
        setInterval(putOldTabsToSleep, TAB_TIME);
    }


    /**
     * Check if the extension is running for the first time and ask for consent if so.
     */
    function checkFirstRun() {
        chrome.storage.sync.get({
            'firstRun': true
        }, function(item) {
            if (item.firstRun) {
                // In case it is the first run, popup a dialog to ask for user consent.
                chrome.storage.sync.set({
                    'sendStats': window.confirm(POPUP_MSG)
                });
                chrome.storage.sync.set({
                    'firstRun': false
                });
            }
        });
    }


    /**
     * Initialize the tab tracker object with the currently open ones.
     */
    function initializeTabs() {
        chrome.tabs.query({}, function(tabs) {
            for (var i in tabs) {
                var tab = tabs[i];
                if (!tab.active && !tab.pinned) {
                    tablogs.TABS[tab.id] = {
                        'timestamp': Date.now()
                    };
                }
            }
        });
    }


    /**
     * Load queued records from a previous session.
     */
    function loadPreviousRecords() {
        chrome.storage.sync.get({
            'tempRecords': []
        }, function(item) {
            if (item.tempRecords) {
                tablogs.TEMP_RECORDS = item.tempRecords;
            }
        });
    }


    /**
     * Request local storage quota.
     */
    function requestStorageQuota() {
        filesystem.reqQuota(REQUESTED_BYTES, function() {
            // Initialize installation id.
            util.initializeID();
        });
    }


    /**
     * Set listener for requests originating at content scripts.
     */
    function setMessageListener() {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            switch (request.action) {

                case 'stats':
                    sendResponse({
                        created: stats.getCreated(),
                        removed: stats.getDestroyed(),
                        ratio: stats.getRatio()
                    });
                    break;

                case 'tabinfo':
                    sendResponse(tablogs.TABS[sender.tab.id]);
                    break;

                default:
                    break;
            }
        });
    }


    /**
     * Initialize the array of tabs with the currently open ones.
     *
     * TODO: we need to test quota overflow.
     */
    function resetFile() {
        filesystem.read(tablogs.FILENAME, function(txt) {
            var lines = txt.split('\n');
            if (tablogs.DEBUG) {
                console.log("Number of lines in history: " + lines.length);
            }
            if (lines.length > MAX_LINES) {
                filesystem.remove(tablogs.FILENAME);
            }
        });
    }


    /**
     * Put old tabs to sleep.
     */
    function putOldTabsToSleep() {
        chrome.tabs.query({}, function(tabs) {
            for (var i in tabs) {
                var tab = tabs[i];
                if (!tab.active && !tab.pinned && tab.id in tablogs.TABS) {
                    var lastTs = tablogs.TABS[tab.id]['timestamp'];
                    if (Date.now() - lastTs > TAB_TIME) {
                        storeTabInfo(tab);
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'suspendTab'
                        }, {});
                    }
                }
            }
        });
    }


    /**
     * Store tab info to be resumed upon activation.
     */
    function storeTabInfo(tab) {
        tablogs.TABS[tab.id]['title'] = tab.title;
        tablogs.TABS[tab.id]['favicon'] = 'chrome://favicon/' + tab.url;
        tablogs.TABS[tab.id]['suspended'] = true;
    }


    /**
     * Encode tab stats to fit 5 Bytes
     */
    function encodeAttributes(tabid, name, offset) {
        if (offset > MAX_OFFET) {
            offset = 0;
        }
        if (tabid > MAX_TABID) {
            tabid = 0;
        }
        low = offset << 0x2 | EVENT[name];
        return util.pack(util.getIntBytes(tabid << 0x18 | low));
    }


    /* Public namespace */
    return {

        /* Module properties. */

        // Set for debugging the extension
        DEBUG: false,

        // Random ID that uniquely indetifies this instance of the extension
        RANDOMID: null,

        // Name of the log that keeps track of recorded events.
        FILENAME: "history.log",

        // Maximum number of bytes that can be encrypted in one RSA 2048 batch.
        MAX_MSG_SIZE: 245,

        // Size of an encoded event record in bytes.
        RECORD_SIZE: 5,

        // Maximum number of records that the extension can send in one batch.
        MAX_RECORDS: 49,

        // Whether we log the tab 'onActivate' events.
        LOG_ACTIVATED: false,

        // Object that keeps track of currently open tabs.
        TABS: {},

        // Last time a tab event was triggered.
        LAST_TS: Date.now(),

        // Web server URL
        SERVER_URL: "https://tablog-webfpext.rhcloud.com",


        /* Module methods. */

        /**
         * Reset the array that keeps stored records.
         */
        resetTmp: function() {
            this.TEMP_RECORDS = [];
        },


        /**
         * Send tab usage statistics in a POST HTTPS request to the web server.
         */
        postToServer: function(batch) {
            var request = "id=" + pidCrypt.SHA256(this.RANDOMID) + "&batch=" + batch;
            util.sendRequest(this.SERVER_URL, request, "POST", function() {
                // Reset storage
                tablogs.resetTmp();
                resetFile();
            });
        },


        /**
         * Push record to local storage and send it to the web server.
         */
        pushRecord: function(tabId, name, ts) {
            // Push to temporary object;
            this.TEMP_RECORDS.push(encodeAttributes(tabId, name, ts));
            // Copy object to local storage.
            chrome.storage.sync.set({
                'tempRecords': this.TEMP_RECORDS
            });
            // Send stats to server if we have filled a batch of records.
            if (this.TEMP_RECORDS.length * this.RECORD_SIZE >= this.MAX_MSG_SIZE) {
                chrome.storage.sync.get({
                    'sendStats': false
                }, function(item) {
                    // Get slice of bytes
                    var sl = tablogs.TEMP_RECORDS.slice(0, tablogs.MAX_RECORDS);
                    // Encrypt
                    var encrypted = util.encrypt(sl.join(''));
                    // Encode and post to server.
                    tablogs.postToServer(util.base64EncodeUrl(encrypted));
                });
            }
        }
    }

})()