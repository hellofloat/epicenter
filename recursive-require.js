'use strict';

const async = require( 'async' );
const fs = require( 'fs' );
const path = require( 'path' );
const untildify = require( 'untildify' );

module.exports = recursiveRequire;

let defaults = {
    verbose: false,
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
            const regexp = new RegExp( '\\.(' + options.extensions.join( '|' ) + ')$', 'i' );
            if ( !regexp.test( filename ) ) {
                return false;
            }

            return true;
        };
    }

    const canonical = path.resolve( untildify( options.directory ) );
    let files = null;

    async.series( [
        function getFileList( next ) {
            fs.readdir( canonical, function( error, _files ) {
                if ( error ) {
                    if ( options.allowMissing && error.code && error.code === 'ENOENT' ) {
                        next( {
                            skip: true
                        } );
                        return;
                    }

                    next( error );
                    return;
                }

                files = _files;
                next();
            } );
        },

        function loadFiles( next ) {
            async.eachSeries( files, function( filename, _next ) {

                const canonicalFilename = path.join( canonical, filename );
                fs.lstat( canonicalFilename, function( error, stat ) {
                    if ( error ) {
                        _next( error );
                        return;
                    }

                    if ( stat.isDirectory() ) {
                        recursiveRequire( Object.assign( options, {
                            directory: canonicalFilename
                        } ), _next );
                        return;
                    }

                    if ( !options.check( canonicalFilename ) ) {
                        _next();
                        return;
                    }

                    if ( options.verbose ) {
                        console.log( 'Loading: ' + canonicalFilename );
                    }

                    var required = options.require( canonicalFilename );

                    if ( options.visit ) {
                        if ( options.verbose ) {
                            console.log( 'Visiting: ' + canonicalFilename );
                        }

                        options.visit( required, canonicalFilename, filename, _next );
                        return;
                    }

                    _next();
                } );
            }, next );
        }
    ], function( error ) {
        if ( error && error.skip ) {
            error = null;
        }

        callback( error );
    } );
}
