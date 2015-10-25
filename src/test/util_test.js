var assert = require('assert');
var util = require('../util').util;

// Test case for the util module
describe('Util', function() {

  // Test the URL-safe base64
  describe('#base64EncodeUrl()', function () {
    it('should replace + by - and / by _.', function () {
      assert.equal('-__', util.util.base64EncodeUrl('+//='));
    });
  });

  // Test the encryption function
  describe('#encrypt()', function () {
    it('should be able to encrypt an Uint8Array with lengt multiple of 4.', function () {
    	var ua = new Uint8Array([22, 12, 32, 12, 244, 11, 0, 23, 11, 1, 123, 12, 87, 66, 0, 3, 67, 100, 213, 23, 7]);
    	//var encrypted = util.util.encrypt(ua);
        //assert.equal('string', typeof(encrypted));
    });
  });
});