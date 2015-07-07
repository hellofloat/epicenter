#!/usr/bin/env node
'use strict';

require( 'es6-shim' ); // shim the things

//var async = require( 'async' );
var EventEmitter2 = require( 'eventemitter2' ).EventEmitter2;
var fs = require( 'fs' );
var getcli = require( './getcli' );
var path = require( 'path' );
var recursiveRequire = require( './recursive-require' );
var restify = require( 'restify' );
var untildify = require( 'untildify' );

var opts = getcli();

var sslEnabled = opts.httpscert && opts.httpskey;
var serverOptions = {
    name: opts.name
};

if ( sslEnabled ) {
    serverOptions.httpsServerOptions = {
        cert: fs.readFileSync( opts.httpscert ),
        key: fs.readFileSync( opts.httpskey ),
        ciphers: opts.httpsciphers
    };
}

var app = Object.assign( {
    settings: opts,
    systems: [],
    server: restify.createServer( serverOptions )
}, EventEmitter2 );

app.server.on( 'uncaughtException', function ( request, response, route, error ) {
    console.error( 'uncaughtException', error.stack );
    response.send( error );
} );

app.server.use( restify.CORS() );
app.server.use( restify.acceptParser( app.server.acceptable ) );
app.server.use( restify.queryParser() );
app.server.use( restify.jsonp() );
app.server.use( restify.bodyParser( {
    mapParams: true
} ) );
app.server.use( restify.gzipResponse() );

console.log( 'HTTP port: ' + opts.httpport );
app.server.listen( opts.httpport );

if ( sslEnabled ) {
    console.log( 'HTTPS port: ' + opts.httpsport );
    app.server.listen( opts.httpsport );
}

if ( opts.httpsforce ) {
    console.log( 'Forcing HTTPS...' );
    app.server.use( function( request, response, next ) {
        if ( request.headers[ 'x-forwarded-proto' ] !== 'https' ) {
            return next( new restify.NotAuthorizedError( 'An HTTPS connection is required to request this resource.' ) );
        }
    } );
}

opts.requires.forEach( function( req ) {
    var canonical = path.resolve( untildify( req ) );

    if ( !fs.existsSync( canonical ) ) {
        return;
    }

    recursiveRequire( {
        directory: canonical,
        visit: function( system, canonical ) {
            console.log( 'Loading: ' + canonical );

            app.systems.push( system );

            if ( !system.init ) {
                return;
            }

            system.init( app, app.server );
        }
    } );
} );

console.log( 'Listening...' );
