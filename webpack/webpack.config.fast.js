var webpack = require( 'webpack' );
var BundleTracker = require( 'webpack-bundle-tracker' );
var config = require( './webpack.config.base' );

config.plugins = [
    new BundleTracker({ filename: './var/build/webpack-stats.json' }),
    new webpack.DefinePlugin({
        'process.env': {
            'NODE_ENV': JSON.stringify( 'production' )
        }
    }),
]

module.exports = config;
