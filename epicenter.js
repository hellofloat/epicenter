#!/usr/bin/env node

'use strict';

const _startTime = new Date();

const async = require( 'async' );
const CookieParser = require( 'restify-cookies' );
const cors = require( 'cors' );
const EventEmitter = require( 'events' );
const fs = require( 'fs' );
const getcli = require( './getcli' );
const getRequestIP = require( 'get-request-ip' );
const globToRegExp = require( 'glob-to-regexp' );
const moment = require( 'moment' );
const path = require( 'path' );
const Raven = require( 'raven' );
const recursiveRequire = require( './recursive-require' );
const restify = require( 'restify' );
const untildify = require( 'untildify' );
const uuid = require( 'uuid' );

const epicenter_package = require( './package.json' );

console.log( `Epicenter (${ epicenter_package.version }) starting...` );

let api_package = null;
try {
    api_package = require( path.join( path.resolve( '.' ), 'package.json' ) );
}
catch ( ex ) {
    api_package = {};
}

const opts = getcli();

const service_name = opts.name || api_package.name || 'unknown';

let sentry_logged_idents = [];
if ( opts.sentrydsn ) {
    Raven.config( opts.sentrydsn, {
        environment: process.env.NODE_ENVIRONMENT || 'unknown',
        release: `epicenter (${ epicenter_package.version }) / ${ service_name } (${ api_package.version })`,
        tags: {
            service: service_name
        }
    } ).install( ( logged, error ) => {
        console.error( error );
        console.error( `logged to sentry: ${ logged }` );
        process.exit( 1 );
    } );
    Raven.on( 'logged', ident => {
        sentry_logged_idents.unshift( ident && ident.id || ident );
        sentry_logged_idents = sentry_logged_idents.slice( 0, 100 );
    } );
    console.log( 'Sentry error logging initialized...' );
    console.log( `  DSN: ${ opts.sentrydsn }` );
}

if ( opts.verbose ) {
    console.log( 'Epicenter verbose output enabled.' );
}

let _systemsLoaded = {};
let _systemsInitializing = {};
let _systemsInitialized = {};

const sslEnabled = opts.httpscert && opts.httpskey;
let serverOptions = {
    name: service_name
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
    status: {
        initialized: false,
        ready: false,
        requests: {
            active: 0,
            total: 0,
            failed: 0,
            time: 0
        }
    },
    systems: [],
    server: restify.createServer( serverOptions ),
    eventBus: new EventEmitter(),
    sentry: Raven,
    on_error: error => {
        if ( opts.sentrydsn ) {
            Raven.captureException( error );
        }

        console.trace( error );
    }
}, EventEmitter.prototype );

app.addOrigin = function( origin ) {
    const self = this;
    self.origins = self.origins || [];
    origin = origin === '*' ? origin : origin.indexOf( '*' ) !== -1 ? globToRegExp( origin ) : origin;
    self.origins.push( origin );
    self.cors = cors( {
        origin: self.origins,
        allowedHeaders: self.allowedHeaders,
        credentials: true
    } );
};

console.log( `CORS: allowed headers: ${ ( opts.cors.allowedHeaders || [] ).join( ', ' ) }` );
console.log( `CORS: origins: ${ ( opts.cors.origins || [ '*' ] ).join( ', ' ) }` );

app.allowedHeaders = opts.cors.allowedHeaders;
app.origins = opts.cors.origins.map( app.addOrigin.bind( app ) );

function handle_uncaught_exception( request, response, route, error ) {
    console.error( `UNCAUGHT EXCEPTION: ${ route && route.spec && route.spec.method } ${ route && route.spec && route.spec.path }` );
    console.error( error.stack );

    let sending_response = false;
    let response_sent = false;
    if ( response && !response.headersSent ) {
        sending_response = true;
        response.on( 'finish', () => {
            response_sent = true;
        } );
        response.send( 500, {
            error: 'internal server error',
            message: 'There was an internal server error processing your request.'
        } );
    }

    let logging_error = false;
    let error_logged = false;
    if ( response && response.sentry ) {
        logging_error = true;
        setInterval( () => {
            error_logged = ( sentry_logged_idents.indexOf( response.sentry ) !== -1 );
        }, 10 );
    }

    ( function check_exit() {
        const need_to_wait = ( sending_response && !response_sent ) || ( logging_error && !error_logged );
        if ( need_to_wait ) {
            setTimeout( check_exit, 100 );
            return;
        }

        process.exit( 1 );
    } )();
}

if ( opts.sentrydsn ) {
    app.server.use( Raven.requestHandler() );
    const raven_error_handler = Raven.errorHandler();
    app.server.on( 'uncaughtException', ( request, response, route, error ) => {
        if ( request && request.user ) {
            Raven.setUserContext( {
                id: request.user.id,
                email: request.user.email
            } );
        }
        raven_error_handler( error, request, response, () => {
            Raven.setUserContext( null );
            handle_uncaught_exception( request, response, route, error );
        } );
    } );
}
else {
    app.server.on( 'uncaughtException', handle_uncaught_exception );
}

app.server.pre( function( request, response, next ) {
    if ( !request.method || !request.method.toUpperCase || request.method.toUpperCase() !== 'OPTIONS' ) {
        next();
        return;
    }

    app.cors( request, response, next );
} );

app.server.pre( restify.pre.sanitizePath() );

app.server.use( function( request, response, next ) {
    app.cors( request, response, next );
} );
app.server.use( restify.acceptParser( app.server.acceptable ) );
app.server.use( restify.queryParser() );
app.server.use( CookieParser.parse );
app.server.use( restify.jsonp() );
app.server.use( restify.bodyParser() );
app.server.use( restify.gzipResponse() );

app.server.use( function( request, response, next ) {
    var requestStartTime = new Date();
    ++app.status.requests.total;
    ++app.status.requests.active;
    response.on( 'close', function() {
        --app.status.requests.active;
        ++app.status.requests.failed;
        var timeDelta = new Date() - requestStartTime;
        app.status.requests.time += timeDelta;
    } );
    response.on( 'finish', function() {
        --app.status.requests.active;
        var timeDelta = new Date() - requestStartTime;
        app.status.requests.time += timeDelta;
    } );
    next();
} );

app.logger = function( requestInfo ) {
    switch ( opts.logformat ) {
        case 'text':
            console.log( `${ requestInfo.date } | ${ requestInfo.ip } | ${ requestInfo.request.agent } | ${ requestInfo.request.method } ${ requestInfo.request.url } ${ requestInfo.request.version } | ${ requestInfo.status } | ${ requestInfo.bytesSent }b | ${ requestInfo.responseTime }ms` );
            break;
        case 'json':
            try {
                console.log( JSON.stringify( requestInfo ) );
            }
            catch ( ex ) {
                console.warn( ex );
            }
            break;
    }
};

if ( !opts.norequestlogging ) {
    app.server.use( function( request, response, next ) {
        // do not track requests to status url
        if ( request.url.indexOf( '/__epicenter' ) === 0 ) {
            next();
            return;
        }

        request.__startTime = new Date();
        request.__initialBytesWritten = request.socket.socket ? request.socket.socket.bytesWritten : request.socket.bytesWritten;

        response.on( 'finish', function() {
            let socket = request.socket.socket ? request.socket.socket : request.socket;
            const requestInfo = {
                ip: getRequestIP( request ),
                date: moment( request.__startTime ).toISOString(),
                request: {
                    method: request.method,
                    url: request.url,
                    version: 'HTTP/' + request.httpVersion,
                    protocol: 'HTTP' + ( request.connection.encrypted ? 'S' : '' ),
                    agent: request.headers[ 'user-agent' ],
                    headers: request.headers
                },
                status: response.statusCode,
                responseTime: request.__startTime ? new Date() - request.__startTime : -1,
                bytesSent: socket.bytesWritten - request.__initialBytesWritten,
                referrer: request.headers.referer || request.headers.referrer,
                id: uuid.v4()
            };

            if ( app.logger ) {
                app.logger( requestInfo );
            }
        } );

        next();
    } );
}

app.server.get( '/__epicenter', function( request, response ) {
    response.send( {
        version: epicenter_package.version,
        name: service_name,
        node: process.versions,
        requests: app.status.requests,
        uptime: new Date() - _startTime,
        averageResponseTime: app.status.requests.time / app.status.requests.total,
        ready: app.status.ready,
        initialized: app.status.initialized,
        systemsLoaded: _systemsLoaded,
        systemsInitializing: _systemsInitializing,
        systemsInitialized: _systemsInitialized,
        canonical: opts.canonical,
        api: {
            version: api_package.version
        }
    } );
} );

if ( sslEnabled ) {
    console.log( 'HTTPS enabled' );

    let httpServer = restify.createServer( {
        name: service_name
    } );
    if ( opts.httpsredirect ) {
        console.log( '  Redirecting unsecured requests...' );
        httpServer.pre( function( request, response ) {
            const hostString = request.headers.host;
            const hostInfo = hostString.split( ':' );
            const host = hostInfo[ 0 ];
            response.header( 'Location', `https://${ host }${ request.url }` );
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

    console.log( `Initializing: ${ _canonical } ...` );

    app.systems.push( system );

    if ( !system.init ) {
        _systemsInitialized[ _canonical ] = true;
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
            console.error( 'error: ' + require( 'util' ).inspect( error, {
                depth: null
            } ) );
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
        verbose: opts.verbose,
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
    ( function checkInitialized() {
        app.status.initialized = !!!Object.keys( _systemsInitializing ).length;
        if ( !app.status.initialized ) {

            const initializationTime = new Date() - initializationCheckStartTime;
            if ( initializationTime > MAX_INITIALIZATION_TIME ) {
                console.error( `Exceeded max initialization wait time: ${ MAX_INITIALIZATION_TIME }` );
                process.exit( 1 );
            }

            setTimeout( checkInitialized, 100 );
            return;
        }
    } )();

    const port = sslEnabled ? opts.httpsport : opts.httpport;
    app.server.listen( port );
    console.log( `Listening on port: ${ port } ...` );

    app.status.ready = true;
} );