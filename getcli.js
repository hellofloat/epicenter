'use strict';

var dashdash = require( 'dashdash' );
var path = require( 'path' );

module.exports = function() {
	var options = [ {
		name: 'version',
		type: 'bool',
		help: 'Print version and exit.'
	}, {
		names: [ 'help', 'h' ],
		type: 'bool',
		help: 'Print this help and exit.'
	}, {
		names: [ 'verbose', 'v' ],
		type: 'bool',
		help: 'Enable verbose output.'
	}, {
		names: [ 'require', 'req', 'r' ],
		env: 'EPICENTER_REQUIRES',
		type: 'arrayOfString',
		help: 'Specify requires. By default the following are tried: ./routes, ./handlers, ./api',
		helpArg: 'DIR',
		default: [ './routes', './handlers', './api', './processors' ]
	}, {
		name: 'name',
		env: 'EPICENTER_NAME',
		type: 'string',
		help: 'Specify the service name for restify. Default: epicenter',
		helpArg: 'NAME',
		default: 'epicenter'
	}, {
		name: 'httpport',
		env: 'EPICENTER_HTTP_PORT',
		type: 'positiveInteger',
		help: 'Specify the HTTP port to listen on. Default: 8000',
		helpArg: 'PORT',
		default: 8000
	}, {
		name: 'httpsport',
		env: 'EPICENTER_HTTPS_PORT',
		type: 'positiveInteger',
		help: 'Specify the HTTPS port to listen on. Defuault: 4443',
		helpArg: 'PORT',
		default: 4443
	}, {
		name: 'httpscert',
		env: 'EPICENTER_HTTPS_CERT',
		type: 'string',
		help: 'Specify the path of the file containing the SSL certificate for the server.',
		helpArg: 'PATH'
	}, {
		name: 'httpskey',
		env: 'EPICENTER_HTTPS_KEY',
		type: 'string',
		help: 'Specify the path fo the file containing the SSL private key for the server.',
		helpArg: 'PATH'
	}, {
		name: 'httpsciphers',
		env: 'EPICENTER_HTTPS_CIPHERS',
		type: 'string',
		help: 'Specify the SSL ciphers. Default: ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:AES:CAMELLIA:DES-CBC3-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!aECDH:!EDH-DSS-DES-CBC3-SHA:!EDH-RSA-DES-CBC3-SHA:!KRB5-DES-CBC3-SHA',
		helpArg: 'CIPHERS',
		default: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:AES:CAMELLIA:DES-CBC3-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!aECDH:!EDH-DSS-DES-CBC3-SHA:!EDH-RSA-DES-CBC3-SHA:!KRB5-DES-CBC3-SHA'
	}, {
		name: 'httpsforce',
		env: 'EPICENTER_HTTPS_FORCE',
		type: 'bool',
		help: 'If specified, will redirect all connections on the unsecured port to the HTTPS port.',
		default: false
	} ];

	var scriptName = path.basename( require.main.filename );

	var parser = dashdash.createParser( {
		options: options
	} );

	var opts = {};
	try {
		opts = parser.parse( process.argv );
	}
	catch ( exception ) {
		console.error( exception.message );
		process.exit( 1 );
	}

	if ( opts.version ) {
		var pkg = require( './package.json' );
		console.log( scriptName + ' v' + pkg.version );
		process.exit( 0 );
	}

	if ( opts.help ) {
		var help = parser.help( {
			includeEnv: true
		} ).trimRight();

		console.log( 'usage: node ' + scriptName + ' [OPTIONS]\n' + 'options:\n' + help );
		process.exit( 0 );
	}

	if ( opts.require[ 0 ].indexOf( ':' ) !== -1 ) {
		opts.require = opts.require[ 0 ].split( ':' );
	}

	opts.requires = opts.require;
	delete opts.require;

	return opts;
};
