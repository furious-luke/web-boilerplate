import { ajax, capitalize, supplant } from './utils';

function ApiError( message ) {
  this.message = message;
}

/**
 * Describes an API.
 */
class Api {

  /**
   * Constructs an Api instance. Accepts an endpoint tree.
   */
  constructor( endpoints = {} ) {
    this.merge = ::this.merge;
    this.request = ::this.request;
    this.crud = {};
    this.merge( endpoints );
  }

  /**
   * Constructs an endpoint call function and sets it.
   */
  makeEndpoint( name, path, method, options = {} ) {

    // Prepare the context to be passed to the request method.
    let ctx = {
      type: 'json',
      path: path,
      method: method,
      ...options
    };

    // If we were given a function to call, bind it appropriately.
    // Otherwise just use the standard request.
    let request = opts => this.request( ctx, opts );
    const { handler } = options;
    if( handler !== undefined )
      this[name] = (...args) => handler( request, ...args );
    else
      this[name] = request;
    return this[name];
  }

  /**
   * Merge an endpoint tree.
   */
  merge( endpoints, path = '' ) {
    for( const key of Object.keys( endpoints ) ) {
      let ep = endpoints[key];

      // Check if we're looking at an endpoint.
      let match = /^(GET|POST|PUT|PATCH|DELETE)$/.exec( key );
      if( match ) {

        // The endpoint can be just the name of the function
        // or it can be an object of details.
        if( !(ep instanceof Object) )
          ep = { name: ep };
        const { name, options = {} } = ep;

        // Make the endpoint.
        this.makeEndpoint( name, path + '/', match[1], options );
      }

      // If not an endpoint, check for a CRUD shorthand.
      else if( ep == 'CRUD' ) {
        ep = [ key, key + 's' ];
        const basePath = path + '/' + ep[1];
        const baseName = capitalize( ep[0] );
        const baseNamePlural = capitalize( ep[1] );
        this.crud[ep[0]] = {
          list: this.makeEndpoint( 'list' + baseNamePlural, basePath, 'GET' ),
          create: this.makeEndpoint( 'create' + baseName, basePath, 'POST', {
            handler: (req, id, data, opts = {}) => req({
              ...opts,
              args: { id },
              data
            })
          }),
          detail: this.makeEndpoint( 'get' + baseName, basePath + '/{id}', 'GET', {
            handler: (req, id, opts = {}) => {
              return req({
                ...opts,
                args: { id }
              });
            }
          }),
          del: this.makeEndpoint( 'delete' + baseName, basePath + '/{id}', 'DELETE', {
            handler: (req, id, opts = {}) => req({
              ...opts,
              args: { id }
            })
          })
        };
      }

      // If not an endpoint or CRUD, continue down the tree.
      else
        this.merge( ep, path + '/' + key )
    }
  }

  /**
   * Perform a request call.
   */
  request( endpoint, options = {} ) {
    const { method = endpoint.method, path = endpoint.path,
            args = {}, type = endpoint.type, data,
            include = [] } = options;
    let body;
    if( data !== undefined ) {
      if( type == 'form' ) {
        body = new FormData();
        for( let k in data )
          body.append( k, data[k] );
      }
      else {
        body = options.data || {};
        body = JSON.stringify( body );
      }
    }
    let finalPath = supplant( path, args );

    // Add on the included models.
    if( include && include.length )
      finalPath += '?include=' + include.join( ',' );

    console.debug( `API: ${finalPath}` );
    return ajax( finalPath, body, method, type );
  }
}

export default Api;
