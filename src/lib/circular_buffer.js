'use strict';

var MAX_BUFFER_SIZE = 1000;

/**
 * A buffer that accepts objects fed in via calls to its push() method. The buffer stores the object and calls
 * a provided addFunction, storing up to maxBufferSize objects. When objects have to be removed from the buffer to
 * make room for more, it will remove the oldest objects and call the 'remove' function with the removed objects.
 * @param addFunction
 * @param removeFunction
 * @param maxBufferSize The maximum buffer size.
 * @constructor
 */
function CircularBuffer(addFunction, removeFunction, maxBufferSize) {
    this._addFunction = addFunction;
    this._removeFunction = removeFunction;

    this.indexFn = function(buf, startIndex, size, count, index) {
        if (size == 0) return -1;

        var i = startIndex + index - buf[startIndex][id];
        if (i < startIndex) return -1;

        while (i > startIndex) {
            if (buf[(i - 1) % size][id] < index) {
                break;
            }
            i--;
        }
        return i;
    };

    this._bufferSize = maxBufferSize ? maxBufferSize : MAX_BUFFER_SIZE;
    var self = this;

    this._data = [];
    this._bufferStart = 0;
    this._bufferCount = 0;

    /**
     * Pushes a value into the buffer.
     * @param values    The objects to add to the buffer.
     * @param callback  The callback to call when the object has been fully processed downstream.
     */
    this.push = function(values, callback) {
        var l = values.length;
        var n = self._bufferCount + l - self._bufferSize;
        if (n > 0) {
            var removed = [];
            while (n-- > 0) {
                removed.push(self._data[self._bufferStart]);
                self._bufferStart = (self._bufferStart + 1) % self._bufferSize;
            }
            self._removeFunction(removed);
        } else {
            self._bufferCount += l;
        }

        var p = self._bufferStart + self._bufferCount - l;
        var idx_list= []
        for (n = 0; n < l; n++) {
            idx_list.push(p % self._bufferSize);
            self._data[p++ % self._bufferSize] = values[n];
        }
        self._addFunction(values, idx_list, function(err) {
            if (err) {
                self._bufferCount -= l; // rewind the values out of the buffer
            }
            callback(err);
        });
    };

    this.getBufferSize = function() {
        return self._bufferSize;
    }

    this.getDataAtIndex = function(idx) {
        return self._data[idx];
    }
}
exports.CircularBuffer = CircularBuffer;
