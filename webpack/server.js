var exec = require( 'child_process' ).exec;
var webpack = require( 'webpack' );
var WebpackDevServer = require( 'webpack-dev-server' );
var config = require( './webpack.config.development' );

exec( 'cat /proc/1/cgroup | awk -F":" \'{ print $3 }\' | head -n 1', function( error, stdout ) {

    var host;
    if( stdout == '/' || stdout == '' )
        host = 'localhost';
    else
        host = '0.0.0.0';

    new WebpackDevServer( webpack( config ), {
        publicPath: config.output.publicPath,
        hot: true,
        inline: true,
        historyApiFallback: true
    }).listen( 3000, host, function( err, result ) {
        if( err )
            console.log( err );
        console.log( 'Listening at ' + host + ':3000' );
    })
});
