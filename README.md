![Epicenter](/epicenter.jpg?raw=true)

Epicenter
=========

Epicenter is a command line server that will automatically load modules in certain default
directories or in directories you specify.

## Installation

### Requirements

Epicenter requires *node.js* and *npm*.

### Install via npm

You can install Epicenter using npm globally on your computer:

```
npm install -g epicenter
```

## Usage

```
usage: epicenter [OPTIONS]
options:
    --version                         Print version and exit.
    -h, --help                        Print this help and exit.
    -v, --verbose                     Enable verbose output.
    -r DIR, --req=DIR, --require=DIR  Specify requires. By default the following are tried:
                                        ./routes, ./handlers, ./api.
                                      Environment: EPICENTER_REQUIRES=DIR

    --name=NAME                       Specify the service name for restify.
                                      Default: epicenter
                                      Environment: EPICENTER_NAME=NAME

    --httpport=PORT                   Specify the HTTP port to listen on.
                                      Default: 8000
                                      Environment: EPICENTER_HTTP_PORT=PORT

    --httpsport=PORT                  Specify the HTTPS port to listen on.
                                      Defuault: 4443
                                      Environment: EPICENTER_HTTPS_PORT=PORT

    --httpscert=PATH                  Specify the path of the file containing the SSL
                                      certificate for the server.
                                      Environment: EPICENTER_HTTPS_CERT=PATH

    --httpskey=PATH                   Specify the path fo the file containing the SSL
                                      private key for the server.
                                      Environment: EPICENTER_HTTPS_KEY=PATH

    --httpsciphers=CIPHERS            Specify the SSL ciphers.
                                      Default:
                                      ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA:AES:CAMELLIA:DES-CBC3-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!aECDH:!EDH-DSS-DES-CBC3-SHA:!EDH-RSA-DES-CBC3-SHA:!KRB5-DES-CBC3-SHA.
                                      Environment: EPICENTER_HTTPS_CIPHERS=CIPHERS

    --httpsredirect                   If specified, will redirect all connections on
                                      the unsecured port to the HTTPS port.
                                      Environment: EPICENTER_HTTPS_REDIRECT=1
```

## Status

You can retrieve Epicenter's status at the reserved URL: /__epicenter

Eg:

```json
{
    "version": "0.7.0",
    "requests": {
        "active": 1,
        "total": 21,
        "failed": 0,
        "time": 64
    },
    "uptime": 16668,
    "averageResponseTime": 3.0476190476190474
}
```

## Contributing

Pull requests are very welcome! Just make sure your code:

1) Passes jshint given the included .jshintrc

2) Is beautified using jsbeautifier and the included .jsbeautifyrc

## Why?

Deploying microservices without something like epicenter means a lot of boilerplate
code is replicated. Epicenter lets you just write the bits that matter for the
particular microservice you're writing.

# CHANGELOG

v0.6.1
------
- Doc updates

v0.0.1
------
- Initial release.
