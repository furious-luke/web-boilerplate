var path = require( 'path' );
var webpack = require( 'webpack' );
var BundleTracker = require( 'webpack-bundle-tracker' );
var config = require( './webpack.config.base' );

config.output = {
  path: path.resolve( './var/assets/js/' ),
  filename: '[name]-[hash].min.js'
};

config.plugins = [
    new BundleTracker({ filename: './webpack-stats.production.json' }),

    // removes a lot of debugging code in React
    new webpack.DefinePlugin({
        'process.env': {
            'NODE_ENV': JSON.stringify( 'production' )
        }
    }),

    // keeps hashes consistent between compilations
    new webpack.optimize.OccurenceOrderPlugin(),

    // minifies your code
    new webpack.optimize.UglifyJsPlugin({
        compressor: {
            warnings: false
        }
    })
]

module.exports = config;
