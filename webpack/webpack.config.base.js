var path = require( 'path' );
var webpack = require( 'webpack' );
var BundleTracker = require( 'webpack-bundle-tracker' );

module.exports = {
  context: path.resolve( __dirname + '/..' ),
  entry: [
    'babel-polyfill',
    './frontend/boilerplate/index'
  ],
  output: {
    path: path.resolve( './var/build/js/' ),
    filename: '[name]-[hash].js'
  },
  plugins: [
    new BundleTracker({ filename: './var/build/webpack-stats.json' })
  ],
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loaders: [ 'babel' ]
      },
      {
        test: /\.styl$/,
        loaders: [
          'style',
          'css',
          'stylus'
        ]
      },
      {
        test: /(node_modules|static)\/.*\.css$/,
        loaders: [
          'style',
          'css'
        ]
      },
      {
        test: /\.css$/,
        exclude: /(node_modules|static)\//,
        loaders: [
          'style',
          'css?modules&importLoaders=1&localIdentName=[path]__[name]__[local]__[hash:base64:5]'
        ]
      },
      {
        test: /\.(woff2?|eot|ttf|svg|otf)(\?.+)?$/,
        loaders: [
          'url'
        ]
      }
    ]
  },
  resolve: {
    root: path.resolve( 'frontend' ),
    modulesDirectories: [ 'node_modules' ],
    extensions: [ '', '.js', '.jsx' ]
  },
  devtool: '#inline-source-map',
  debug: true
};
