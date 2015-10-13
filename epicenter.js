#!/usr/bin/env node
'use strict';

var _startTime = new Date();

require( 'es6-shim' ); // shim the things
var async = require( 'async' );
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
    serverOptions.certificate = fs.readFileSync( opts.httpscert );
    serverOptions.key = fs.readFileSync( opts.httpskey );
    serverOptions.httpsServerOptions = {
        ciphers: opts.httpsciphers
    };
}

var app = Object.assign( {
    settings: opts,
    systems: [],
    server: restify.createServer( serverOptions ),
    eventBus: new EventEmitter2()
}, EventEmitter2.prototype );

app.server.on( 'uncaughtException', function ( request, response, route, error ) {
    console.error( 'uncaughtException', error.stack );
    response.send( error );
} );

app.server.pre( restify.CORS( {
    credentials: true
} ) );
app.server.use( restify.acceptParser( app.server.acceptable ) );
app.server.use( restify.queryParser() );
app.server.use( CookieParser.parse );
app.server.use( restify.jsonp() );
app.server.use( restify.bodyParser() );
app.server.use( restify.gzipResponse() );

var _ready = false;
var _initialized = false;
var _initializing = {};
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
        averageResponseTime: _requests.time / _requests.total,
        ready: _ready,
        initialized: _initialized,
        initializing: _initializing
    } );
} );

if ( sslEnabled ) {
    console.log( 'HTTPS enabled' );

    var httpServer = restify.createServer( {
        name: opts.name
    } );
    if ( opts.httpsredirect ) {
        console.log( '  Redirecting unsecured requests...' );
        httpServer.pre( function( request, response ) {
            var hostString = request.headers.host;
            var hostInfo = hostString.split( ':' );
            var host = hostInfo[ 0 ];
            response.header( 'Location', 'https://' + host + request.url );
            response.send( 301 );
        } );
    }
    else {
        console.log( '  Rejecting unsecured requests...' );
        httpServer.pre( function( request, response, next ) {
            return next( new restify.NotAuthorizedError( 'An HTTPS connection is required to request this resource.' ) );
        } );
    }
    httpServer.listen( opts.httpport );
}

function loadSystem( system, _canonical, callback ) {
    console.log( 'Loading: ' + _canonical );

    app.systems.push( system );

    if ( !system.init ) {
        callback();
        return;
    }

    _initializing[ _canonical ] = true;

    system.init( app, app.server, function( error ) {
        delete _initializing[ _canonical ];
        callback( error );
    } );
}

async.eachSeries( opts.requires, function( req, next ) {
    recursiveRequire( {
        allowMissing: true,
        directory: path.resolve( untildify( req ) ),
        visit: loadSystem
    }, next );
}, function( error ) {
    if ( error ) {
        console.error( error );
        process.exit( 1 );
    }

    (function checkInitialized() {
        _initialized = !!!Object.keys( _initializing ).length;
        if ( !_initialized ) {
            setTimeout( checkInitialized, 100 );
        }
    })();

    var port = sslEnabled ? opts.httpsport : opts.httpport;
    app.server.listen( port );
    console.log( 'Listening on port: ' + port + ' ...' );

    _ready = true;
} );
