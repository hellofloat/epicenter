#!/usr/bin/env node
'use strict';

var _startTime = new Date();

require( 'es6-shim' ); // shim the things
var CookieParser = require( 'restify-cookies' );
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
    server: restify.createServer( serverOptions ),
    eventBus: new EventEmitter2()
}, EventEmitter2 );

app.server.on( 'uncaughtException', function ( request, response, route, error ) {
    console.error( 'uncaughtException', error.stack );
    response.send( error );
} );

app.server.use( restify.CORS() );
app.server.use( restify.acceptParser( app.server.acceptable ) );
app.server.use( restify.queryParser() );
app.server.use( CookieParser.parse );
app.server.use( restify.jsonp() );
app.server.use( restify.bodyParser() );
app.server.use( restify.gzipResponse() );

var _requests = {
    active: 0,
    total: 0,
    failed: 0,
    time: 0
};

app.server.use( function( request, response, next ) {
    var requestStartTime = new Date();
    ++_requests.total;
    ++_requests.active;
    response.on( 'close', function() {
        --_requests.active;
        ++_requests.failed;
        var timeDelta = new Date() - requestStartTime;
        _requests.time += timeDelta;
    } );
    response.on( 'finish', function() {
        --_requests.active;
        var timeDelta = new Date() - requestStartTime;
        _requests.time += timeDelta;
    } );
    next();
} );

var pkg = require( './package.json' );
app.server.get( '/__epicenter', function( request, response ) {
    response.send( {
        version: pkg.version,
        requests: _requests,
        uptime: new Date() - _startTime,
        averageResponseTime: _requests.time / _requests.total
    } );
} );

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
