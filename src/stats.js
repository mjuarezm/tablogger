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
 * @fileoverview Provides methods to get statistics from the data to be displayed to the user.
 */
var stats = (function() {

    /* Public namespace */
    return {

        /* Module properties. */

        records: {
            tabIds: [],
            names: [],
            tss: [],
            urls: []
        },

        /* Module methods. */

        /**
         * Return the total number of tabs that have been created.
         */
        getCreated: function() {
            var numCreated = 0;
            for (var i = 0; i < this.records.names.length; ++i) {
                if (this.records.names[i] == 'onCreated') {
                    numCreated += 1;
                }
            }
            return numCreated;
        },


        /**
         * Return the total number of tabs that have been destroyed.
         */
        getDestroyed: function() {
            var numDestroyed = 0;
            for (var i = 0; i < this.records.names.length; ++i) {
                if (this.records.names[i] == 'onRemoved') {
                    numDestroyed += 1;
                }
            }
            return numDestroyed;
        },


        /**
         * Return the ratio created vs destroyed
         * TODO
         */
        getRatio: function() {
            var numCreated = this.getCreated();
            if (numCreated == 0) {
                return "NA";
            }
            var r = this.getDestroyed() * 1.0 / numCreated;
            return +r.toFixed(2);
        },


        /**
         * Return average number of tabs.
         */
        getNumTabs: function() {
            var avg = util.avg(tablogs.NUM_TABS);
            return +avg.toFixed(2) == -1 ? "NA" : avg;
        },


        /**
         * Return average tab lifetime.
         */
        getTabLifetime: function() {
            var avg = util.avg(tablogs.TAB_LIFETIMES);
            return +avg.toFixed(2) == -1 ? "NA" : avg / 1000.0;
        },


        /**
         * Return minim time between opening two consecutive tabs
         * TODO
         */
        getMinOpenTime: function() {
            return 0;
        },


        /**
         * Update the statistics.
         */
        parseHistoryUpdate: function() {
            var _this = this;
            this.records = {
                tabIds: [],
                names: [],
                tss: [],
                urls: []
            };
            filesystem.read(tablogs.FILENAME, function(contents) {
                var lines = contents.split("\n");
                for (var i = 0; i < lines.length - 1; ++i) {
                    var elements = lines[i].split(",");
                    _this.records.tabIds.push(elements[0]);
                    _this.records.names.push(elements[1]);
                    _this.records.tss.push(elements[2]);
                    _this.records.urls.push(elements[3]);
                }
            });
        }
    }
})()