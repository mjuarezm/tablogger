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
var tablogs = (function () {

    /* Private module configuration variables. */

    // Maximum number of lines that can be logged to local storage.
    var MAX_LINES = 300000;

    // Number of bytes requested for storage quota.
    var REQUESTED_BYTES = 1024 * 1024 * 10;

    // Default number of minutes after which an inactive tab is put to sleep.
    var DEFAULT_TAB_TIME = 20;

    // Default number of tabs after for which the memory saving is enabled.
    var DEFAULT_NUM_TABS = 10;

    // Minimum idle time required for tab to be put put to sleep (in minutes).
    var DEFAULT_MIN_TIME = 5;

    // Maximum number of tabs that are kept for user stats.
    var MAX_NUM_TABS = 100;

    // Default list of special pages. These pages are treated as exceptions (e.g., won't be put to sleep).
    var DEFAULT_URL_SPECIAL = ['youtube.com', 'play.spotify.com'];

    // Message to be displayed right after installation of the tablogger extension.
    var POPUP_MSG = "Do you allow tablogger extension to send tab usage statistics " +
        "for research purposes? These statistics DO NOT include any" +
        "private data such as URLs, and are sent and stored encrypted.";

    // Encoding of event names for transmission over the wire.
    var EVENT = {
        'onCreated': 0x0,
        'onLoaded': 0x1,
        'onUpdated': 0x2,
        'onRemoved': 0x3,
        'onReplaced': 0x4
    };

    // Maximum time offset (im ms) between two consecutive events.
    var MAX_OFFET = 67108863;  // approx. 18 hours

    // Maximum tab id number in a session.
    var MAX_TABID = 262143;


    /* Main entry of the module. */
    main();


    /* Declaration of private functions. */

    /**
     * Main module function.
     */
    function main() {
        // Request for local storage quota.
        requestStorageQuota();

        // Ask for consent if we're running for the first time.
        checkFirstRun();

        // Initialize open tabs.
        initializeTabs();

        // Set listener for content scripts.
        setMessageListener();

        // Load previous records.
        loadPreviousRecords();

        // Remove suspended tab from history
        setHistoryListener();

        // Periodically check whether a tab needs to go to sleep.
        setInterval(putOldTabsToSleep, DEFAULT_MIN_TIME * 1000 * 60);

    }


    /**
     * Check if the extension is running for the first time and ask for consent if so.
     */
    function checkFirstRun() {
        chrome.storage.sync.get({
            'firstRun': true
        }, function (item) {
            if (item.firstRun) {
                // In case it's the first run, popup a dialog to ask for user consent.
                chrome.storage.sync.set({
                    'sendStats': setSendStats(POPUP_MSG),
                    'numTabs': DEFAULT_NUM_TABS,
                    'minTime': DEFAULT_TAB_TIME,
                    'exceptionList': DEFAULT_URL_SPECIAL,
                    'firstRun': false
                });
            }
        });
    }


    /**
     * Initialize the tab tracker object with the current open tabs.
     */
    function initializeTabs() {
        chrome.tabs.query({}, function (tabs) {
            // For each tab returned by Chrome tab API, register a tab
            // object initialized to current time and suspended flag off.
            for (var i = 0; i < tabs.length; i++) {
                tablogs.TABS[tabs[i].id] = {
                    'timestamp': Date.now(),
                    'suspended': false
                };
            }
        });
    }


    /**
     * Load queued records from a previous session.
     */
    function loadPreviousRecords() {
        chrome.storage.sync.get({
            'tempRecords': []
        }, function (item) {
            if (item.tempRecords) {
                tablogs.TEMP_RECORDS = item.tempRecords;
            }
        });
    }


    /**
     * Request local storage quota.
     */
    function requestStorageQuota() {
        filesystem.reqQuota(REQUESTED_BYTES, function () {
            // Initialize extension installation id.
            util.initializeID();
        });
    }


    /**
     * Remove suspended tab from history.
     */
    function setHistoryListener() {
        chrome.history.onVisited.addListener(function (result) {
            var tabid_index_in_url = result.title.indexOf('chrome-extension://' + chrome.runtime.id);
            var index_suspended_in_url = result.title.indexOf('SuspendedTab');
            if (index_suspended_in_url != -1 || tabid_index_in_url != -1) {
                // Remove URL from browsing history if the URL
                // contains the tab id or the suspended string:
                chrome.history.deleteUrl({
                    'url': result.url
                });
            }
        });
    }


    /**
     * Set listener for requests originating at content scripts.
     */
    function setMessageListener() {
        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            switch (request.action) {

                case 'stats':
                    sendResponse({
                        created: stats.getCreated(),
                        removed: stats.getDestroyed(),
                        ratio: stats.getRatio(),
                        open: stats.getNumTabs(),
                        lifetime: stats.getTabLifetime()
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
        filesystem.read(tablogs.FILENAME, function (txt) {
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
     * Put idle tabs to sleep.
     */
    function putOldTabsToSleep() {
        chrome.storage.sync.get({
            'numTabs': DEFAULT_NUM_TABS,
            'minTime': DEFAULT_TAB_TIME,
            'exceptionList': DEFAULT_URL_SPECIAL
        }, function (item) {
            chrome.tabs.query({}, function (tabs) {

                // Add tab to list of tabs analysed for user stats.
                if (tablogs.STATS['numTabs'].length > MAX_NUM_TABS) {
                    // If number of tabs in stats object exceeds MAX_NUM_TABS,
                    // pop oldest inserted element to the list before pushing a new tab.
                    tablogs.STATS['numTabs'] = tablogs.STATS['numTabs'].slice(1);
                }
                tablogs.STATS['numTabs'].push(tabs.length);

                // For each of the tabs returned by tabs Chrome API:
                for (var i = 0; i < tabs.length; i++) {
                    var tab = tabs[i];
                    // If tab is neither special, nor active, nor pinned...
                    if ((!tab.active) && (!tab.pinned) && (tab.id in tablogs.TABS)) {
                        // Calculate the time that has been open.
                        var timeOpen = Date.now() - tablogs.TABS[tab.id]['timestamp'];

                        // If idle time and number of tabs are larger than imposed by user...
                        if (timeOpen > item.minTime * 1000 * 60 && tabs.length > item.numTabs) {

                           // ... and the tab url is not in the list of special tabs...
                            if (item.exceptionList.indexOf(util.getDomain(tab.url)) == -1) {

                                // ...and the tab has not been suspended already...
                                var tab_has_suspended = tablogs.TABS[tab.id].hasOwnProperty('suspended');
                                var suspended_value = tablogs.TABS[tab.id]['suspended'];
                                if (!(tab_has_suspended && suspended_value)) {
                                    storeTabInfo(tab, function () {

                                        // SUSPEND TAB!
                                        chrome.tabs.sendMessage(tab.id, {
                                            action: 'suspendTab'
                                        }, {});
                                    });
                                }
                            }
                        }

                    }
                }
            });
        });
    }


    /**
     * Store tab info to be resumed upon activation.
     */
    function storeTabInfo(tab, cbk) {
        tablogs.TABS[tab.id]['title'] = tab.title;
        tablogs.TABS[tab.id]['favicon'] = 'chrome://favicon/' + tab.url;
        tablogs.TABS[tab.id]['suspended'] = true;
        cbk();
    }


    /**
     * Encode tab stats to fit 6 Bytes
     */
    function encodeAttributes(tabid, name, offset, bg) {
        /* Encoding format (6 Bytes)
         * +-----------------+------------------+----------------+------------+
         * | tabid (18 bits) | offset (26 bits) | event (3 bits) | bg (1 bit) |
         * +-----------------+------------------+----------------+------------+
         */
        if (offset > MAX_OFFET) {
            offset = 0;
        }
        if (tabid > MAX_TABID) {
            tabid = 0;
        }
        event_bits = EVENT[name] << 0x1 | + bg;
        offset_bits = offset << 0x3 | event_bits;
        tab_bits = tabid << 0x1E | offset_bits;
        return util.getIntBytes(tab_bits, 6);
    }


    /* Public namespace. */
    return {

        /* Module properties. */

        // Set for debugging purposes.
        DEBUG: false,

        // Random ID that uniquely identifies this instance of the extension
        RANDOMID: null,

        // Name of the log that keeps track of recorded events.
        FILENAME: "history.log",

        // Max bytes that can be encoded in base64 as a message to be encrypted
        MAX_SIZE_BASE64: 240,

        // Whether we log the tab 'onActivate' events.
        LOG_ACTIVATED: false,

        // Object that keeps track of currently open tabs.
        TABS: {},

        // Last time a tab event was triggered.
        LAST_TS: Date.now(),

        // Temporary records
        TEMP_RECORDS: [],

        // Stats object
        STATS: {
            'numTabs': [],
            'tabLifetime': []
        },

        // Web server URL
        SERVER_URL: "https://tablog-webfpext.rhcloud.com",

        // RSA public key modulus
        N: '00dd6e8d6f48d3f54ebce516b04de8b97dd873bcbdc54add8f0400607f614fa0ae6' +
        'd6d7378bf238b02f5879b9509770a8e8e062d0757c12273e595983f662398ae357d' +
        '6d62e2aab3cd213413c15dee196ccea7dae0fd97a46665c87e6906cf85e700ca423' +
        'e1ff601085c573e22c3b8ac6d0946c266094da3018492c095a6eec8eb18d81bfacc' +
        '8cba6adb0c19a114a04fe07ac57af22d45f19bd6bbdb7066d5bfde19818033a0ce8' +
        '9af0e38b01c91461182ab2f9ec2008eefec49555e957772932ea980d01219b0b78f' +
        '9130f2b51d7879018588f2ae89345c061fd10ef164348bfe3a9e4bbccd2a65a8adb' +
        '4abc8f2d85c8506e92e10562ee092591bc17a1697e4eb',

        // RSA public key exponent
        e: '10001',


        /* Module methods. */

        /**
         * Reset the array that keeps stored records.
         */
        resetTmp: function () {
            this.TEMP_RECORDS = [];
        },


        /**
         * Send tab usage statistics in a POST HTTPS request to the web server.
         */
        postToServer: function (batch) {
            var version = chrome.app.getDetails().version;
            var extidSHA256 = Sha256.hash(this.RANDOMID);
            var request = "id=" + extidSHA256 + "&batch=" + batch + "&version=" + version;
            util.sendRequest(this.SERVER_URL, request, "POST", function () {
                // Reset storage
                tablogs.resetTmp();
                resetFile();
            });
        },


        /**
         * Push record to local storage and send it to the web server.
         */
        pushRecord: function (tabId, name, ts, bg) {
            // Push to temporary object;
            this.TEMP_RECORDS = this.TEMP_RECORDS.concat(encodeAttributes(tabId, name, ts, bg));
            // Copy temp records object to Chrome's storage API.
            chrome.storage.local.set({
                'tempRecords': this.TEMP_RECORDS
            });
            // Copy temp records object to local storage.
            window.localStorage.setItem('tmpRecords', this.TEMP_RECORDS);
            // Send stats to server if we have filled a batch of records.
            if (this.TEMP_RECORDS.length >= this.MAX_SIZE_BASE64) {
                var sl = this.TEMP_RECORDS.slice(0, this.MAX_SIZE_BASE64);
                this.TEMP_RECORDS = this.TEMP_RECORDS.slice(this.MAX_SIZE_BASE64);
                chrome.storage.sync.get({
                    'sendStats': false
                }, function (item) {
                    if (item.sendStats) {
                        // Encrypt
                        var encrypted = util.encrypt(new Uint8Array(sl));

                        // Encode and post to server.
                        tablogs.postToServer(util.base64EncodeUrl(encrypted));

                    }
                });
            }
        }
    }

})()
