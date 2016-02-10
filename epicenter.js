#!/usr/bin/env node
'use strict';

const _startTime = new Date();

const async = require( 'async' );
const CookieParser = require( 'restify-cookies' );
const EventEmitter = require( 'events' );
const fs = require( 'fs' );
const getcli = require( './getcli' );
const path = require( 'path' );
const recursiveRequire = require( './recursive-require' );
const restify = require( 'restify' );
const untildify = require( 'untildify' );

const opts = getcli();

let _ready = false;
let _initialized = false;
let _systemsLoaded = {};
let _systemsInitializing = {};
let _systemsInitialized = {};
let _requests = {
    active: 0,
    total: 0,
    failed: 0,
    time: 0
};

const sslEnabled = opts.httpscert && opts.httpskey;
let serverOptions = {
    name: opts.name
};

if ( sslEnabled ) {
    serverOptions.certificate = fs.readFileSync( opts.httpscert );
    serverOptions.key = fs.readFileSync( opts.httpskey );
    serverOptions.httpsServerOptions = {
        ciphers: opts.httpsciphers
    };
}

let app = Object.assign( {
    settings: opts,
    systems: [],
    server: restify.createServer( serverOptions ),
    eventBus: new EventEmitter()
}, EventEmitter.prototype );

app.server.on( 'uncaughtException', function ( request, response, route, error ) {
    console.error( 'uncaughtException', error.stack );
    response.send( error );
} );

app.server.pre( restify.CORS( {
    credentials: true
} ) );
app.server.pre( restify.pre.sanitizePath() );

app.server.use( restify.acceptParser( app.server.acceptable ) );
app.server.use( restify.queryParser() );
app.server.use( CookieParser.parse );
app.server.use( restify.jsonp() );
app.server.use( restify.bodyParser() );
app.server.use( restify.gzipResponse() );

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

const pkg = require( './package.json' );
let apiPackage = null;
try {
    apiPackage = require( path.join( path.resolve( '.' ), 'package.json' ) );
}
catch( ex ) {
    apiPackage = {};
}
app.server.get( '/__epicenter', function( request, response ) {
    response.send( {
        version: pkg.version,
        name: opts.name,
        node: process.versions,
        requests: _requests,
        uptime: new Date() - _startTime,
        averageResponseTime: _requests.time / _requests.total,
        ready: _ready,
        initialized: _initialized,
        systemsLoaded: _systemsLoaded,
        systemsInitializing: _systemsInitializing,
        systemsInitialized: _systemsInitialized,
        canonical: opts.canonical,
        api: {
            version: apiPackage.version
        }
    } );
} );

if ( sslEnabled ) {
    console.log( 'HTTPS enabled' );

    let httpServer = restify.createServer( {
        name: opts.name
    } );
    if ( opts.httpsredirect ) {
        console.log( '  Redirecting unsecured requests...' );
        httpServer.pre( function( request, response ) {
            const hostString = request.headers.host;
            const hostInfo = hostString.split( ':' );
            const host = hostInfo[ 0 ];
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

function loadSystem( system, _canonical, _filename, callback ) {
    _systemsLoaded[ _canonical ] = true;

    process.stdout.write( 'Loading: ' + _canonical + ' ... ' );

    app.systems.push( system );

    if ( !system.init ) {
        console.log( 'done.' );
        callback();
        return;
    }

    _systemsInitializing[ _canonical ] = true;
    _systemsInitialized[ _canonical ] = false;

    system.init( app, app.server, function( error ) {
        delete _systemsInitializing[ _canonical ];
        _systemsInitialized[ _canonical ] = true;

        if ( error ) {
            console.error( 'error: ' + require( 'util' ).inspect( error, { depth: null } ) );
        }
        else {
            console.log( 'done.' );
        }

        callback( error );
    } );
}

const MAX_INITIALIZATION_TIME = 30000;

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

    const initializationCheckStartTime = new Date();
    (function checkInitialized() {
        _initialized = !!!Object.keys( _systemsInitializing ).length;
        if ( !_initialized ) {

            const initializationTime = new Date() - initializationCheckStartTime;
            if ( initializationTime > MAX_INITIALIZATION_TIME ) {
                console.error( 'Exceeded max initialization wait time: ' + MAX_INITIALIZATION_TIME );
                process.exit( 1 );
            }

            setTimeout( checkInitialized, 100 );
            return;
        }
    })();

    const port = sslEnabled ? opts.httpsport : opts.httpport;
    app.server.listen( port );
    console.log( 'Listening on port: ' + port + ' ...' );

    _ready = true;
} );
