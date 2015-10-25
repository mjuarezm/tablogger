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
 * @fileoverview This is a modified version encapsulated in a module of:
 *
 * http://www.html5rocks.com/en/tutorials/file/filesystem/
 * We acknowledge the authors.
 */
var filesystem = (function() {
    // Get HTML5 filesystem API
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

    // Filesystem
    var fs = null;

    // Error handler
    function errorHandler(e) {
        console.log("ERROR " + e.name + ": " + e.message);
    }

    /* Public namespace */
    return {
        /* Module methods. */

        /**
         * Request filesystem quota.
         */
        reqQuota: function(reqBytes, cbk) {
            var _this = this;
            navigator.webkitPersistentStorage.requestQuota(reqBytes, function(grantedBytes) {
                window.requestFileSystem(PERSISTENT, grantedBytes, function(gb) {
                    _this.initFS(gb, cbk);
                }, util.handleError);
            }, errorHandler);
        },


        /**
         * Initialize HTML5 filesystem.
         */
        initFS: function(grantedBytes, cbk) {
            window.requestFileSystem(window.PERSISTENT, grantedBytes, function(filesystem) {
                fs = filesystem;
                cbk();
            }, errorHandler);
        },


        /**
         * Write to file
         */
        write: function(filename, text) {
            if (fs) {
                fs.root.getFile(filename, {
                    create: true
                }, function(fileEntry) {
                    fileEntry.isFile = true;
                    fileEntry.name = filename;
                    fileEntry.fullPath = '/' + filename;
                    fileEntry.createWriter(function(fileWriter) {
                        fileWriter.seek(fileWriter.length);
                        fileWriter.write(new Blob([text], {
                            type: 'text/plain'
                        }));
                    });
                }, errorHandler);
            } else {
                console.log("Filesystem not ready.")
            }
        },


        /**
         * Check whether the file exists in the filesystem or not.
         */
        exists: function(filename, cbk) {
            if (fs) {
                fs.root.getFile(filename, {}, function() {
                    cbk(true);
                }, function() {
                    cbk(false);
                });
            } else {
                console.log("Filesystem not ready.")
            }
        },


        /**
         * Read from file.
         */
        read: function(filename, cbk) {
            if (fs) {
                fs.root.getFile(filename, {}, function(fileEntry) {
                    fileEntry.file(function(file) {
                        var reader = new FileReader();
                        reader.onloadend = function(e) {
                            cbk(this.result);
                        };
                        reader.readAsText(file);
                    }, util.handleError);

                }, errorHandler);
            } else {
                console.log("Filesystem not ready.")
            }
        },


        /**
         * Remove file.
         */
        remove: function(filename, cbk) {
            if (fs) {
                fs.root.getFile(filename, {
                    create: false
                }, function(fileEntry) {
                    fileEntry.remove(cbk, errorHandler);
                }, errorHandler);
            } else {
                console.log("Filesystem not ready.")
            }
        }
    }
})()
