Node.js module for delivering optimized, minified, mangled, gzipped, and CDN-hosted assets in Express (currently by Amazon S3 and Amazon CloudFront).

## Index

- [Features](#features)
- [Add-On Modules](#add-on-modules)
- [How Does It Work?](#how-does-it-work)
- [Contributors](#contributors)
- [License](#license)


## Features

* Automatic parsing of `background`, `background-image` and `content` for `url({{absoluteUrl}})` in stylesheets and scripts.
* Built-in optimization of images in production mode using binaries from NPM of [OptiPNG][1] and [JPEGTran][2].
* Supports [Sass][3], [LESS][4], and [Stylus][5] using respective stylesheet compilers.
* JavaScript assets are mangled and minified using [UglifyJS][6].
* Automatic detection of asset changes and will only upload changed assets to S3 in production mode.
* Utilizes cachebusting, which is inspired by [express-cachebuster][7] and [h5bp][8].
* All assets are compressed using [zlib][9] into a gzip buffer for S3 uploading with `Content-Encoding` header set to `gzip`.
* Embed multiple assets as a single `<script>` or `<link>` tag using the built-in dynamic view helper.
* Loads and processes assets per view (allowing you to minimize client HTTP requests).
* Combine commonly used assets together using a simple array argument.
* Uploads changed assets automatically and asynchronously to Amazon S3 (only in production mode) using [knox][10].


## How does it work?

* Grunt task that loads the assets to S3
* Library interacts with assets in templates to serve either single production asset or normal files for development


## Environment Differences

**Development Mode:**

Assets are untouched, cachebusted, and delivered as typical local files for rapid development.

**Production Mode:**

Assets are optimized, minified, mangled, gzipped, delivered by Amazon CloudFront CDN, and hosted from Amazon S3.


## Contributors

* Nick Baugh <niftylettuce@gmail.com>
* James Wyse <james@jameswyse.net>
* Jon Keating <jon@licq.org>
* Andrew de Andrade <andrew@deandrade.com.br>
* [Joshua Gross](http://www.joshisgross.com) <josh@spandex.io>
* Dominik Lessel <info@rocketeleven.com>
* Elad Ben-Israel <elad.benisrael@gmail.com>


## License

The MIT License

Copyright (c) 2012- Nick Baugh niftylettuce@gmail.com (http://niftylettuce.com/)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


[1]: http://optipng.sourceforge.net/
[2]: http://jpegclub.org/jpegtran/
[3]: http://sass-lang.com/
[4]: http://lesscss.org/
[5]: http://learnboost.github.com/stylus/
[6]: https://github.com/mishoo/UglifyJS/
[7]: https://github.com/niftylettuce/express-cachebuster/
[8]: http://h5bp.com/
[9]: http://nodejs.org/api/zlib.html
[10]: https://github.com/LearnBoost/knox/
[11]: https://github.com/mxcl/homebrew/
[12]: https://github.com/flatiron/winston/
[13]: https://github.com/GoalSmashers/clean-css