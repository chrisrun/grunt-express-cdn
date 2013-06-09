//     grunt-express-cdn
//     MIT Licensed

// Node.js module for delivering optimized, minified, mangled, gzipped,
//  and CDN-hosted assets in Express using S3 and Grunt.

// code base from [@niftylettuce](https://twitter.com/#!/niftylettuce)
// Copyright (c) 2012- Nick Baugh <niftylettuce@gmail.com> (http://niftylettuce.com)
// MIT Licensed

// # express-cdn

var fs = require('fs')
    , url = require('url')
    , path = require('path')
    , mime = require('mime')
    , async = require('async')
    , request = require('request')
    , _ = require('underscore')
    , spawn = require('child_process').spawn
    , package = require('../../../package.json')

_.str = require('underscore.string');
_.mixin(_.str.exports());

var throwError = function (msg) {
    console.log(msg);
    throw new Error('CDN: ' + msg);
};

var logger = function (msg) {
    console.log(msg);
};

// `escape` function from Lo-Dash v0.2.2 <http://lodash.com>
// and Copyright 2012 John-David Dalton <http://allyoucanleet.com/>
// MIT licensed <http://lodash.com/license>
var escape = function (string) {
    return (string + '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
};

var renderAttributes = function (attributes) {
    var str = [];
    for (var name in attributes) {
        if (_.has(attributes, name)) {
            str.push(escape(name) + '="' + escape(attributes[name]) + '"');
        }
    }
    return str.sort().join(" ");
};

var createTag = function (src, asset, attributes, version) {
    // Cachebusting
    version = version || '';
    // Enable "raw" output
    if ('raw' in attributes && attributes.raw === true) {
        return src + asset + version;
    }

    // Check mime type
    switch (mime.lookup(asset)) {
        case 'application/javascript':
        case 'text/javascript':
            attributes.type = attributes.type || 'text/javascript';
            attributes.src = src + asset + version;
            return '<script ' + renderAttributes(attributes) + '></script>';
        case 'text/css':
            attributes.rel = attributes.rel || 'stylesheet';
            attributes.href = src + asset + version;
            return '<link ' + renderAttributes(attributes) + ' />';
        case 'image/png':
        case 'image/jpg':
        case 'image/jpeg':
        case 'image/pjpeg':
        case 'image/gif':
            attributes.src = src + asset + version;
            return '<img ' + renderAttributes(attributes) + ' />';
        default:
            throwError('unknown asset type');
    }
};

var renderTag = function (options, assetTag, attributes) {
    // Set attributes
    attributes = attributes || {};

    // In production mode, check for SSL
    var src = '', position, timestamp = package.version;
    if (options.production) {
        if (options.ssl) {
            src = 'https://' + options.domain;
        } else {
            src = 'http://' + options.domain;
        }
        // Process array by breaking file names into parts
        //  and check that array mime types are all equivalent

        if (typeof assetTag === 'object') {

            var name;
            for (var prop in assetTag) {
                name = prop;

                break;
            }
            console.log(assetTag[name][0])

            name += path.extname(assetTag[name][0]);
            position = name.lastIndexOf('.');

            name = _(name).splice(position, 0, '.' + timestamp);
            return createTag(src, "/" + name, attributes) + "\n";
        } else {
            timestamp = package.version;
            position = assetTag.lastIndexOf('.');
            return createTag(src, _(assetTag).splice(position, 0, '.' + timestamp), attributes) + "\n";
        }
    } else {
        // Development mode just pump out assets normally
        var version = '?v=' + new Date().getTime();
        var buf = [];
        if (typeof assetTag === 'object') {
            var name;
            for (var prop in assetTag) {
                name = prop;

                break;
            }
            for (var i = 0; i < assetTag[name].length; i += 1) {
                buf.push(createTag(src, assetTag[name][i], attributes, version));
                if ((i + 1) === assetTag[name].length) return buf.join("\n") + "\n";
            }
        } else if (typeof assetTag === 'string') {
            return createTag(src, assetTag, attributes, version) + "\n";
        } else {
            throwError('asset was not a string or an array');
        }
    }

};

var js = ['application/javascript', 'text/javascript'];

var savedOptions = {};

var CDN = function (app, options, callback) {

    // Validate express - Express app instance is an object in v2.x.x and function in 3.x.x
    if (!(typeof app === 'object' || typeof app === 'function')) throwError('requires express');

    // Validate options
    var required = [
        'publicDir'
        , 'viewsDir'
        , 'domain'
        , 'production'
    ];
    required.forEach(function (index) {
        if (typeof options[index] === 'undefined') {
            throwError('missing option "' + index + '"');
        }
    });

    if (options.logger) {
        if (typeof options.logger === 'function')
            logger = options.logger;
    }

    // Return the dynamic view helper
    return function (req, res) {
        return function (assets, attributes) {
            if (typeof assets === 'undefined') throwError('assets undefined');
            return renderTag(options, assets, attributes);
        };
    };

};

module.exports = CDN;

