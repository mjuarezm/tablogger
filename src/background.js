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

    // Default number of minutes after which an inactive tab is put to sleep.
    var DEFAULT_TAB_TIME = 20;

    // Default number of tabs after for which the memory saving is enabled
    var DEFAULT_NUM_TABS = 10;

    // Min time to put tabs to sleep
    var DEFAULT_MIN_TIME = 5;

    // Default list of special pages
    var DEFAULT_URL_SPECIAL = ['youtube.com', 'play.spotify.com'];

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

        // Remove suspended tab from history
        setHistoryListener();

        // Perdiocally check wheter a tab needs to go to sleep.
        setInterval(putOldTabsToSleep, DEFAULT_MIN_TIME * 1000 * 60);

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
                    'sendStats': window.confirm(POPUP_MSG),
                    'numTabs': DEFAULT_NUM_TABS,
                    'minTime': DEFAULT_TAB_TIME,
                    'exceptionList': DEFAULT_URL_SPECIAL,
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
     * Remove suspended tab from history.
     */
    function setHistoryListener(){
        chrome.history.onVisited.addListener(function (result) {
            if (result.title.indexOf('SuspendedTab') != -1 || result.title.indexOf('chrome-extension://' + chrome.runtime.id) != -1) {
                chrome.history.deleteUrl({'url': result.url});
            }
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
                        ratio: stats.getRatio(),
                        open: stats.getNumTabs(),
                        lifetime: stats.getTabLifetime()
                    });
                    break;

                case 'tabinfo':
                    console.log('tabinfo', tablogs.TABS[sender.tab.id]);
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
        chrome.storage.sync.get({
            'numTabs': DEFAULT_NUM_TABS,
            'minTime': DEFAULT_TAB_TIME,
            'exceptionList': DEFAULT_URL_SPECIAL
        }, function(item) {
            chrome.tabs.query({}, function(tabs) {
                if (tablogs.NUM_TABS.length > 100) {
                    tablogs.NUM_TABS = tablogs.NUM_TABS.slice(1);
                }
                tablogs.NUM_TABS.push(tabs.length);                            
                for (var i = 0; i < tabs.length; i++) {
                    var tab = tabs[i];
                    if ((!tab.active) && (!tab.pinned) && (tab.id in tablogs.TABS)) {
                        var timeOpen = Date.now() - tablogs.TABS[tab.id]['timestamp'];
                        if (timeOpen > item.minTime * 1000 * 60 && Object.keys(tablogs.TABS).length > item.numTabs) {
                            if (item.exceptionList.indexOf(util.getDomain(tab.url)) == -1) {
                                if (!(tablogs.TABS[tab.id].hasOwnProperty('suspended') && tablogs.TABS[tab.id]['suspended'])) {
                                    storeTabInfo(tab, function() {
                                        chrome.tabs.sendMessage(tab.id, {action: 'suspendTab'}, {});
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
     * Encode tab stats to fit 5 Bytes
     */
    function encodeAttributes(tabid, name, offset) {
        /* Format of encoding (5 Bytes)
         * +-----------------+------------------+----------------+
         * | tabid (2 Bytes) | offset (22 bits) | event (2 bits) |
         * +-----------------+------------------+----------------+
         */
        if (offset > MAX_OFFET) {
            offset = 0;
        }
        if (tabid > MAX_TABID) {
            tabid = 0;
        }
        low = offset << 0x2 | EVENT[name];
        return util.getIntBytes(tabid, 2).concat(util.getIntBytes(low, 3));
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

        // Max bytes that can be encoded in base64 as a message to be encrypted
        MAX_SIZE_BASE64: 240,

        // Whether we log the tab 'onActivate' events.
        LOG_ACTIVATED: false,

        // Object that keeps track of currently open tabs.
        TABS: {},

        // Last time a tab event was triggered.
        LAST_TS: Date.now(),

        // Num tabs
        NUM_TABS: [],

        // Tab lifetimes
        TAB_LIFETIMES: [],

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
        resetTmp: function() {
            this.TEMP_RECORDS = [];
        },


        /**
         * Send tab usage statistics in a POST HTTPS request to the web server.
         */
        postToServer: function(batch) {
            var extidSHA256 = Sha256.hash(this.RANDOMID);
            var request = "id=" + extidSHA256 + "&batch=" + batch;
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
            this.TEMP_RECORDS = this.TEMP_RECORDS.concat(encodeAttributes(tabId, name, ts));
            // Copy object to local storage.
            chrome.storage.sync.set({
                'tempRecords': this.TEMP_RECORDS
            });
            // Send stats to server if we have filled a batch of records.
            if (this.TEMP_RECORDS.length >= this.MAX_SIZE_BASE64) {
                var sl = this.TEMP_RECORDS.slice(0, this.MAX_SIZE_BASE64);
                this.TEMP_RECORDS = this.TEMP_RECORDS.slice(this.MAX_SIZE_BASE64);
                chrome.storage.sync.get({
                    'sendStats': false
                }, function(item) {
                    // Encrypt
                    var encrypted = util.encrypt(new Uint8Array(sl));
                    // Encode and post to server.
                    tablogs.postToServer(util.base64EncodeUrl(encrypted));
                });
            }
        }
    }

})()