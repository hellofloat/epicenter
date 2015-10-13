'use strict';

var async = require( 'async' );
var fs = require( 'fs' );
var path = require( 'path' );
var untildify = require( 'untildify' );

module.exports = recursiveRequire;

var defaults = {
    allowMissing: false,
    extensions: [ 'js' ],
    require: require,
    check: null,
    visit: null
};

function recursiveRequire( options, callback ) {
    if ( typeof options === 'string' ) {
        options = Object.assign( defaults, {
            directory: options
        } );
    }
    else {
        options = Object.assign( defaults, options );
    }

    if ( !options.check ) {
        options.check = function( filename ) {
            var regexp = new RegExp( '\\.(' + options.extensions.join( '|' ) + ')$', 'i' );
            if ( !regexp.test( filename ) ) {
                return false;
            }

            return true;
        };
    }

    var canonical = path.resolve( untildify( options.directory ) );

    fs.readdir( canonical, function( error, files ) {
        if ( error ) {
            if ( options.allowMissing && error.code && error.code === 'ENOENT' ) {
                callback();
                return;
            }

            callback( error );
            return;
        }

        async.eachSeries( files, function( filename, next ) {

            var canonicalFilename = path.join( canonical, filename );
            fs.lstat( canonicalFilename, function( error, stat ) {
                if ( error ) {
                    next( error );
                    return;
                }

                if ( stat.isDirectory() ) {
                    recursiveRequire( Object.assign( options, {
                        directory: canonicalFilename
                    } ), next );
                    return;
                }

                if ( !options.check( canonicalFilename ) ) {
                    next();
                    return;
                }

                // Require the file.
                var required = options.require( canonicalFilename );

                if ( options.visit ) {
                    options.visit( required, canonicalFilename, filename, next );
                    return;
                }

                next();
            } );
        }, callback );
    } );
}
