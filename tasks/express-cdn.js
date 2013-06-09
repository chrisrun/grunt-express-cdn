var fs = require('fs')
    , url = require('url')
    , path = require('path')
    , mime = require('mime')
    , knox = require('knox')
    , walk = require('walk')
    , zlib = require('zlib')
    , async = require('async')
    , request = require('request')
    , _ = require('underscore')
    , jsp = require('uglify-js').parser
    , pro = require('uglify-js').uglify
    , spawn = require('child_process').spawn
    , optipngPath = require('optipng-bin').path
    , jpegtranPath = require('jpegtran-bin').path
    , cleanCSS = require('clean-css')
    , package = require('../../../package.json')

module.exports = function (grunt) {

    _.str = require('underscore.string');
    _.mixin(_.str.exports());
    var js = ['application/javascript', 'text/javascript'];

    var logger = function (msg) {
        console.log(msg);
    };

    var throwError = function (msg) {
        console.log(msg);
        throw new Error('grunt-expresscdn: ' + msg);
    };


    var readUtf8 = function (file, callback) {
        fs.readFile(file, 'utf8', callback);
    };

    var readCSS = function (file, callback) {
        var simplePath = calculateSimplePath(file, savedOptions.publicDir);
        fs.readFile(simplePath, 'utf8', callback);
    };

    var calculateSimplePath = function (httpFilePath, publicDir) {
        var relativePath = url.parse(httpFilePath).pathname;
        if (relativePath.indexOf("?") != -1) {
            relativePath = relativePath.substring(0, relativePath.indexOf("?"));
        }
        return path.join(publicDir, relativePath);
    }

    var calculateRelativePath = function (assets, originalPath, options) {
        //console.log("all assets: ")
        //console.log(assets)
        var relativePath = originalPath;
        for (key in assets) {
            var currentAsset = assets[key];
            //console.log("Processing: "  + )
            var dir = path.dirname(url.parse(currentAsset).pathname);
            //join with the relative path in the css
            //console.log("Asset: " + assets[key]);
            if (relativePath.indexOf("?") != -1) {
                relativePath = relativePath.substring(0, relativePath.indexOf("?"));
            }

            dir = path.join(dir, relativePath);

            if (fs.existsSync(path.join(options.publicDir, dir.substr(1)))) {
                //return the relative path from the root directory
                return dir.substr(1);
            } else {
                //return the original relative path
                continue;
            }
        }
        return originalPath;
    };

    var compile = function (fileName, assets, S3, options, method, type, timestamp, callback) {
        var finishUpload = function () {
            return callback && callback();
        };
        return function (err, results) {

            if (err) {
                console.log("An error occurred in compile:");
                console.log(results);
                throwError(err);
            }

            if (results instanceof Array) results = results.join("\n");
            var expires = new Date(new Date().getTime() + (31556926 * 1000)).toUTCString();
            var headers = {
                'Set-Cookie': '', 'response-content-type': type, 'Content-Type': type, 'response-cache-control': 'maxage=31556926', 'Cache-Control': 'maxage=31556926', 'response-expires': expires, 'Expires': expires, 'response-content-encoding': 'gzip', 'Content-Encoding': 'gzip'
            };
            switch (method) {
                case 'uglify':
                    var ast = jsp.parse(results);
                    ast = pro.ast_mangle(ast);
                    ast = pro.ast_squeeze(ast);
                    var final_code = pro.gen_code(ast);
                    zlib.gzip(final_code, function (err, buffer) {
                        if (err) throwError(err);
                        S3.putBuffer(buffer, encodeURIComponent(fileName), headers, function (err, response) {
                            if (err) return throwError(err);
                            if (response.statusCode !== 200) {
                                //return throwError('unsuccessful upload of script "' + fileName + '" to S3');
                                console.log('unsuccessful upload of script "' + fileName + '" to S3');
                                return finishUpload();
                            } else {
                                logger({ task: 'expresscdn', message: 'successfully uploaded script "' + fileName + '" to S3' });
                                return finishUpload();
                            }
                        });
                    });
                    break;
                case 'minify':
                    var minify = cleanCSS.process(results, {debug:false});
                    // NOTE: We can't minify with cleanCSS because it has so many inconsistencies and invalid optimizations

                    // Process images
                    minify = minify.replace(/(background\-image|background|content)\:[^;]*url\((?!data:)['"]?([^\)'"]+)['"]?\)/g, function (match, attribute, assetUrl) {
                        var relativePath = assetUrl;
                        if ('/' === relativePath[0]) {
                            relativePath = relativePath.substr(1);
                        }

                        if (!fs.existsSync(path.join(options.publicDir, relativePath))) {
                            relativePath = calculateRelativePath(assets, relativePath, options);
                        }

                        var imageResource = compile('images/' + path.basename(relativePath), relativePath, S3, options, 'image', 'image/' + path.extname(assetUrl).substr(1), Date.now(), null, null)();
                        return attribute + ':url(' + 'images/' + path.basename(relativePath) + ')';
                    });

                    // Process fonts
                    minify = minify.replace(/url\(([^\)]+\.eot|[^\)]+\.woff|[^\)]+\.ttf)(\?[^\)]+)?([^\)])/g, function (match, attribute, url) {
                        var matchString = match.toString();

                        var relativePath = matchString.replace("url(", "").replace(/['"]/g, "");
                        if (!relativePath || relativePath.length == 0)
                            throwError({"error": "Matching of fonts still needs to be improved!!"});

                        var relativeQuery = "";

                        var index = relativePath.indexOf("?");
                        if (index != -1) {
                            var split = relativePath.split('?');

                            relativePath = split[0];
                            relativeQuery = '?' + split[1];
                        }

                        if ('/' === relativePath[0]) {
                            relativePath = relativePath.substr(1);
                        }

                        if (!fs.existsSync(path.join(options.publicDir, relativePath))) {
                            relativePath = calculateRelativePath(assets, relativePath, options);
                        }

                        var mimeType = mime.lookup(relativePath)
                        var fontResource = compile('fonts/' + path.basename(relativePath), relativePath, S3, options, 'font', mimeType, Date.now(), null, null)();
                        return 'url("' + 'fonts/' + path.basename(relativePath) + relativeQuery + '"';
                    });

                    zlib.gzip(minify, function (err, buffer) {
                        if (err) throwError(err);

                        S3.putBuffer(buffer, encodeURIComponent(fileName), headers, function (err, response) {
                            if (err) throwError(err);
                            if (response.statusCode !== 200) {
                                //throwError('unsuccessful upload of stylesheet "' + fileName + '" to S3');
                                console.log('unsuccessful upload of stylesheet "' + fileName + '" to S3');
                                return finishUpload();
                            } else {
                                logger({ task: 'expresscdn', message: 'successfully uploaded stylesheet "' + fileName + '" to S3' });
                                return finishUpload();
                            }
                        });
                    });
                    break;
                case 'optipng':
                    var img = path.join(options.publicDir, assets);
                    var optipng = spawn(optipngPath, [img]);
                    optipng.stdout.on('data', function (data) {
                        logger({ task: 'expresscdn', message: 'optipng: ' + data });
                    });
                    optipng.stderr.on('data', function (data) {
                        logger({ task: 'expresscdn', message: 'optipng: ' + data });
                    });
                    optipng.on('exit', function (code) {
                        // OptiPNG returns 1 if an error occurs
                        if (code !== 0)
                            throwError('optipng returned an error during processing \'' + img + '\': ' + code);

                        logger({ task: 'expresscdn', message: 'optipng exited with code ' + code });
                        fs.readFile(img, function (err, data) {
                            zlib.gzip(data, function (err, buffer) {
                                S3.putBuffer(buffer, encodeURIComponent(fileName), headers, function (err, response) {
                                    if (err) throwError(err);
                                    if (response.statusCode !== 200) {
                                        //throwError('unsuccessful upload of image "' + fileName + '" to S3');
                                        console.log('unsuccessful upload of image "' + fileName + '" to S3');
                                        return finishUpload();
                                    } else {
                                        logger({ task: 'expresscdn', message: 'successfully uploaded image "' + fileName + '" to S3' });
                                        // Hack to preserve original timestamp for view helper
                                        //fs.utimesSync(img, new Date(timestamp), new Date(timestamp));
                                        return finishUpload();
                                    }
                                });
                            });
                        });
                    });
                    break;
                case 'jpegtran':
                    var jpg = path.join(options.publicDir, assets);
                    var jpegtran = spawn(jpegtranPath, [ '-copy', 'none', '-optimize', '-outfile', jpg, jpg ]);
                    jpegtran.stdout.on('data', function (data) {
                        logger({ task: 'expresscdn', message: 'jpegtran: ' + data });
                    });
                    jpegtran.stderr.on('data', function (data) {
                        throwError(data);
                    });
                    jpegtran.on('exit', function (code) {
                        logger({ task: 'expresscdn', message: 'jpegtran exited with code ' + code });
                        fs.readFile(jpg, function (err, data) {
                            zlib.gzip(data, function (err, buffer) {
                                S3.putBuffer(buffer, encodeURIComponent(fileName), headers, function (err, response) {
                                    if (err) throwError(err);
                                    if (response.statusCode !== 200) {
                                        //throwError('unsuccessful upload of image "' + fileName + '" to S3');
                                        console.log('unsuccessful upload of image "' + fileName + '" to S3');
                                        return finishUpload();
                                    } else {
                                        logger({ task: 'expresscdn', message: 'successfully uploaded image "' + fileName + '" to S3' });
                                        // Hack to preserve original timestamp for view helper
                                        //fs.utimesSync(jpg, new Date(timestamp), new Date(timestamp));
                                        return finishUpload();
                                    }
                                });
                            });
                        });
                    });
                    break;
                case 'image':
                case 'font':
                    var image = path.join(options.publicDir, assets);
                    fs.readFile(image, function (err, data) {
                        zlib.gzip(data, function (err, buffer) {
                            S3.putBuffer(buffer, encodeURIComponent(fileName), headers, function (err, response) {
                                if (err) throwError(err);
                                if (response.statusCode !== 200) {
                                    //throwError('unsuccessful upload of image "' + fileName + '" to S3');
                                    console.log('w of font or image "' + fileName + '" to S3');
                                    return finishUpload();
                                } else {
                                    logger('successfully uploaded font or image "' + fileName + '" to S3');
                                    // Hack to preserve original timestamp for view helper
                                    try {
                                        //fs.utimesSync(image, new Date(timestamp), new Date(timestamp));
                                        return finishUpload();
                                    } catch (e) {
                                        return finishUpload();
                                    }
                                }
                            });
                        });
                    });
                    break;
            }
        };
    };


// Check if the file already exists
    var checkArrayIfModified = function (assets, fileName, S3, options, type, callback) {
        console.log(callback)

        var finishUpload = function () {
            return callback && callback(null, assets);
        };
        return function (err, response) {
            if (err) {
                console.log("an error occurred uploading an asset!");
                console.log(response);
                throwError(err);
            }

            logger({ task: 'expresscdn', message: '"' + fileName + '" will be uploaded to S3' });
            // Check file type
            switch (type) {
                case 'application/javascript':
                case 'text/javascript':
                    async.mapSeries(assets, readUtf8, compile(fileName, assets, S3, options, 'uglify', type, null, finishUpload));
                    return;
                case 'text/css':
                    async.mapSeries(assets, readCSS, compile(fileName, assets, S3, options, 'minify', type, null, finishUpload));
                    return;
                default:
                    throwError('unsupported mime type array "' + type + '"');
            }
        };
    };

    var checkStringIfModified = function (assets, fileName, S3, options, timestamp, callback) {
        var finishUpload = function () {
            return callback && callback(null, assets);
        };
        return function (err, response) {
            if (err) throwError(err);
            if (response.statusCode === 200) {
                logger({ task: 'expresscdn', message: '"' + fileName + '" not modified and is already stored on S3' });
                return finishUpload();
            } else {
                logger({ task: 'expresscdn', message: '"' + fileName + '" was not found on S3 or was modified recently' });
                // Check file type
                var type = mime.lookup(assets);
                switch (type) {
                    case 'application/javascript':
                    case 'text/javascript':
                        readUtf8(path.join(options.publicDir, assets), compile(fileName, assets, S3, options, 'uglify', type, null, finishUpload));
                        return;
                    case 'text/css':
                        readCSS(url.format({
                            protocol: (options.ssl) ? 'https' : 'http',
                            hostname: options.hostname,
                            port: options.port,
                            pathname: assets
                        }), compile(fileName, assets, S3, options, 'minify', type, null, finishUpload));
                        return;
                    case 'image/png':
                    case 'image/gif':
                        compile(fileName, assets, S3, options, 'optipng', type, timestamp, finishUpload)(null, null);
                        return;
                    case 'image/jpg':
                    case 'image/jpeg':
                    case 'image/pjpeg':
                        compile(fileName, assets, S3, options, 'jpegtran', type, timestamp, finishUpload)(null, null);
                        return;
                    default:
                        throwError('unsupported mime type "' + type + '"');
                }
            }
        };
    };


    var processAssets = function (options, results, done) {
        // Create knox instance
        savedOptions = options;
        var knoxOptions = _(options).pick([
            'region', 'endpoint', 'port', 'key', 'secret', 'access', 'bucket', 'secure'
        ]);
        var S3 = knox.createClient(knoxOptions);

        // Go through each result and process it
        async.mapSeries(results, function (result, iter) {
            var type = '', fileName = '', position, timestamp = package.version;
            // Combine the assets if it is an array
            if (result instanceof Object) {
                var assets = result.assets;
                // Concat the file names together
                var concat = [];
                var extension = "";
                // Ensure all assets are of the same type
                for (var k = 0; k < assets.length; k += 1) {
                    if (type === '') type = mime.lookup(assets[k]);
                    else if (mime.lookup(assets[k]) !== type)
                        throwError('mime types in array do not match');

                    if (_.indexOf(js, type) !== -1)
                        assets[k] = path.join(options.publicDir, assets[k]);
                    else if (type === 'text/css')
                        assets[k] = url.format({
                            protocol: (options.ssl) ? 'https' : 'http',
                            hostname: options.hostname,
                            port: options.port,
                            pathname: assets[k]
                        });
                    concat.push(path.basename(assets[k]));
                    extension = path.extname(assets[k]);
                }
                // Set the file name
                fileName = result.name + path.extname(concat[0]); //Math.abs(createHash(concat)) + "." + extension;

                position = fileName.lastIndexOf('.');
                fileName = _(fileName).splice(position, 0, '.' + timestamp);
                console.log("Processing: " + encodeURIComponent(fileName));

                S3.headFile(encodeURIComponent(fileName), checkArrayIfModified(assets, fileName, S3, options, type, iter));
            } else {
                // Set the file name
                fileName = result.substr(1);
                position = fileName.lastIndexOf('.');
                timestamp = package.version;
                fileName = _(fileName).splice(position, 0, '.' + timestamp);

                S3.headFile(encodeURIComponent(fileName), checkStringIfModified(result, fileName, S3, options, timestamp, iter));
            }
        }, function (err, results) {
            done(err, results);
        });
    };


    grunt.registerMultiTask('express-cdn', 'Moving express assets to CDN', function () {
        var done = this.async();

        var options = this.options();

        grunt.verbose.writeflags(options, 'Options');

        var walker = function () {

            var walker = walk.walk(options.viewsDir);
            var results = [];
            var regexCDN = /CDN\(([^)]+)\)/g;

            walker.on('file', function (root, stat, next) {
                console.log("Processing: " + stat.name);
                var ext = path.extname(stat.name), text;
                if (ext === '.jade' || ext === '.ejs') {

                    fs.readFile(path.join(root, stat.name), 'utf8', function (err, data) {
                        if (err) throwError(err);
                        var match;
                        while ((match = regexCDN.exec(data))) {
                            results.push(match[1]);
                        }
                        next();
                    });
                } else {
                    next();
                }
            });
            walker.on('end', function () {
                // Clean the array

                var out = new Array();

                for (var i = 0; i < results.length; i += 1) {
                    // Convert all apostrophes
                    results[i] = results[i].replace(/\'/g, '"');
                    // Insert assets property name

                    results[i] = JSON.parse(results[i]);

                    for (var k in results[i]) {
                        out.push({assets: results[i][k], name: k});
                    }

                }
                // Convert to an array of only assets

                // Process the results
                if (out.length > 0) {
                    processAssets(options, out, function (err, results) {
                        if (options.cache_file) {
                            fs.writeFile(options.cache_file, JSON.stringify(results), function () {
                                console.log("!!!ERROR!!!")
                                return callback && callback();
                            });
                        } else {
                            done();
                        }
                    });
                } else {
                    throwError('empty results');
                }
            });
        };

        if (options.cache_file) {
            fs.stat(options.cache_file, function (err, cache_stat) {
                if (err || !(cache_stat && cache_stat.isFile() && cache_stat.size > 0)) {
                    walker();
                } else {
                    // results are cached, everything already processed and on S3
                }
            });
        } else {
            walker();
        }

    });


}