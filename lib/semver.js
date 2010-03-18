// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

/**
  @file 
  
  Implements versioning support according to the semantic versioning 
  specification at http://semver.org

*/


// ..........................................................
// NATCOMPARE
// 
// Used with thanks to Kristof Coomans 
// Find online at http://sourcefrog.net/projects/natsort/natcompare.js
// Cleaned up JSLint errors

/*
natcompare.js -- Perform 'natural order' comparisons of strings in JavaScript.
Copyright (C) 2005 by SCK-CEN (Belgian Nucleair Research Centre)
Written by Kristof Coomans <kristof[dot]coomans[at]sckcen[dot]be>

Based on the Java version by Pierre-Luc Paour, of which this is more or less a straight conversion.
Copyright (C) 2003 by Pierre-Luc Paour <natorder@paour.com>

The Java version was based on the C version by Martin Pool.
Copyright (C) 2000 by Martin Pool <mbp@humbug.org.au>

This software is provided 'as-is', without any express or implied
warranty.  In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
claim that you wrote the original software. If you use this software
in a product, an acknowledgment in the product documentation would be
appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
*/


function isWhitespaceChar(a)
{
    var charCode;
    charCode = a.charCodeAt(0);

    if ( charCode <= 32 )
    {
        return true;
    }
    else
    {
        return false;
    }
}

function isDigitChar(a)
{
    var charCode;
    charCode = a.charCodeAt(0);

    if ( charCode >= 48  && charCode <= 57 )
    {
        return true;
    }
    else
    {
        return false;
    }
}

function compareRight(a,b)
{
    var bias = 0;
    var ia = 0;
    var ib = 0;

    var ca;
    var cb;

    // The longest run of digits wins.  That aside, the greatest
    // value wins, but we can't know that it will until we've scanned
    // both numbers to know that they have the same magnitude, so we
    // remember it in BIAS.
    for (;; ia++, ib++) {
        ca = a.charAt(ia);
        cb = b.charAt(ib);

        if (!isDigitChar(ca)
                && !isDigitChar(cb)) {
            return bias;
        } else if (!isDigitChar(ca)) {
            return -1;
        } else if (!isDigitChar(cb)) {
            return +1;
        } else if (ca < cb) {
            if (bias === 0) {
                bias = -1;
            }
        } else if (ca > cb) {
            if (bias === 0) bias = +1;

        } else if (ca === 0 && cb === 0) {
            return bias;
        }
    }
}

function natcompare(a,b) {

    var ia = 0, ib = 0;
	var nza = 0, nzb = 0;
	var ca, cb;
	var result;

    while (true)
    {
        // only count the number of zeroes leading the last number compared
        nza = nzb = 0;

        ca = a.charAt(ia);
        cb = b.charAt(ib);

        // skip over leading spaces or zeros
        while ( isWhitespaceChar( ca ) || ca =='0' ) {
            if (ca == '0') {
                nza++;
            } else {
                // only count consecutive zeroes
                nza = 0;
            }

            ca = a.charAt(++ia);
        }

        while ( isWhitespaceChar( cb ) || cb == '0') {
            if (cb == '0') {
                nzb++;
            } else {
                // only count consecutive zeroes
                nzb = 0;
            }

            cb = b.charAt(++ib);
        }

        // process run of digits
        if (isDigitChar(ca) && isDigitChar(cb)) {
            if ((result = compareRight(a.substring(ia), b.substring(ib))) !== 0) {
                return result;
            }
        }

        if (ca === 0 && cb === 0) {
            // The strings compare the same.  Perhaps the caller
            // will want to call strcmp to break the tie.
            return nza - nzb;
        }

        if (ca < cb) {
            return -1;
        } else if (ca > cb) {
            return +1;
        }

        ++ia; ++ib;
    }
}


// ..........................................................
// PUBLIC API
// 

/**
  Parse the version number into its components.  Returns result of a regex.
*/
exports.parse = function(vers) {
  var ret = vers.match(/^([\d]+?)(\.([\d]+?)(\.(.+))?)?$/);
  if (!ret) return null; // no match
  return [ret, ret[1], ret[3] || '0', ret[5] || '0'];
};
var vparse = exports.parse;

/**
  Returns the major version number of a version string. 
  
  @param {String} vers
    version string
    
  @returns {Number} version number or null if could not be parsed
*/
exports.major = function(vers) {
  return Number(vparse(vers)[1]);
};

/**
  Returns the minor version number of a version string
  
  
  @param {String} vers
    version string
    
  @returns {Number} version number or null if could not be parsed
*/
exports.minor = function(vers) {
  return Number(vparse(vers)[2]);
};

/**
  Returns the patch of a version string.  The patch value is always a string
  not a number
*/
exports.patch = function(vers) {
  var ret = vparse(vers)[3];
  return isNaN(Number(ret)) ? ret : Number(ret);
};

/**
  Compares two patch strings using the proper matching formula defined by
  semver.org
*/
exports.comparePatch = function(patch1, patch2) {
  var num1, num2;
      
  if (patch1 === patch2) return 0; // equal
  
  num1   = Number(patch1);
  num2   = Number(patch2);
      
  if (isNaN(num1)) {
    if (isNaN(num2)) {
      // do lexigraphic comparison
      return natcompare(patch1, patch2);
      
    } else return -1; // num2 is a number therefore beats num1
    
  // num1 is a number but num2 is not so num1 beats.  otherwise just compare
  } else if (isNaN(num2)) {
    return 1 ;
  } else {
    return num1<num2 ? -1 : (num2>num1 ? 1 : 0) ;
  }
};

function invalidVers(vers) {
  return '' + vers + ' is an invalid version string';
}

function compareNum(vers1, vers2, num1, num2) {
  num1 = Number(num1);
  num2 = Number(num2);
  if (isNaN(num1)) throw invalidVers(vers1);
  if (isNaN(num2)) throw invalidVers(vers2);
  return num1 - num2 ;
}

/**
  Compares two version strings, using natural sorting for the patch.
*/
exports.compare = function(vers1, vers2) {
  var ret ;
  
  if (vers1 === vers2) return 0;
  if (!vers1) return -1; 
  if (!vers2) return 1; 
  
  vers1 = vparse(vers1);
  vers2 = vparse(vers2);

  ret = compareNum(vers1[0], vers2[0], vers1[1], vers2[1]);
  if (ret === 0) {
    ret = compareNum(vers1[0], vers2[0], vers1[2], vers2[2]);
    if (ret === 0) ret = exports.comparePatch(vers1[3], vers2[3]);
  }
  
  return (ret < 0) ? -1 : (ret>0 ? 1 : 0);
};

/**
  Returns true if the second version string represents a version compatible 
  with the first version.  In general this means the second version must be
  greater than or equal to the first version but its major version must not 
  be different.
*/
exports.compatible = function(reqVers, curVers) {
  if (!reqVers) return true; // always compatible with no version
  if (reqVers === curVers) return true; // fast path
  if (exports.major(reqVers) !== exports.major(curVers)) return false;
  return exports.compare(reqVers, curVers) <= 0;
};

/**
  Normalizes version numbers so that semantically equivalent will be treated 
  the same.
*/
exports.normalize = function(vers) {
  var patch;
  
  vers = exports.parse(vers);
  
  patch = Number(vers[3]);
  if (isNaN(patch)) patch = vers[3];
  
  return [Number(vers[1]), Number(vers[2]), patch].join('.');
};
