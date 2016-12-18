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
      path: path + '/',
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
      let match = /^(GET|POST|PUT|PATCH|DELETE|CRUD)$/.exec( key );
      if( match ) {

        // If we matched a CRUD endpoint, perform the setup.
        if( match[1] == 'CRUD' ) {
          let crudKey = path.slice( path.lastIndexOf( '/' ) );
          this.makeCrudEndpoints( crudKey, path );
        }

        // The endpoint can be just the name of the function
        // or it can be an object of details.
        else {
          if( !(ep instanceof Object) )
            ep = { name: ep };
          const { name, options = {} } = ep;

          // Make the endpoint.
          this.makeEndpoint( name, path + '/', match[1], options );
        }
      }

      // If not an endpoint, check for a CRUD shorthand.
      else if( ep == 'CRUD' )
        this.makeCrudEndpoints( key, path )

      // If not an endpoint or CRUD, continue down the tree.
      else
        this.merge( ep, path + '/' + key )
    }
  }

  makeCrudEndpoints( key, path ) {
    let ep = [ key, key + 's' ];
    const basePath = path + '/' + ep[1];
    const baseName = capitalize( ep[0] );
    const baseNamePlural = capitalize( ep[1] );
    this.crud[ep[0]] = {
      list: this.makeEndpoint( 'list' + baseNamePlural, basePath, 'GET' ),
      create: this.makeEndpoint( 'create' + baseName, basePath, 'POST', {
        handler: (req, data, opts = {}) => req({
          ...opts,
          data
        })
      }),
      detail: this.makeEndpoint( 'get' + baseName, basePath + '/{id}', 'GET', {
        handler: (req, id, opts = {}) => {
          return req({
            ...opts,
            args: {id}
          });
        }
      }),
      update: this.makeEndpoint( 'get' + baseName, basePath + '/{id}', 'PATCH', {
        handler: (req, id, data, opts = {}) => {
          return req({
            ...opts,
            args: {id},
            data
          });
        }
      }),
      remove: this.makeEndpoint( 'remove' + baseName, basePath + '/{id}', 'DELETE', {
        handler: (req, id, opts = {}) => req({
          ...opts,
          args: {id}
        })
      })
    };
  }

  /**
   * Perform a request call.
   */
  request( endpoint, options = {} ) {
    const { method = endpoint.method, path = endpoint.path,
            args = {}, type = endpoint.type, data,
            include = [] } = options;
    let queryString = [];

    // Process the body. This can end up being a FormData object
    // or a json string.
    let body;
    if( method != 'GET' ) {
      if( data !== undefined ) {
        if( type == 'form' ) {
          body = new FormData();
          for( let k in data )
            body.append( k, data[k] );
        }
        else {
          body = data || {};
          body = JSON.stringify( body );
        }
      }
    }
    else {
      if( data !== undefined ) {
        for( const k in data )
          queryString.push( k + '=' + encodeURIComponent( data[k] ) );
      }
    }

    // Replace any URL arguments. This is typically just hte ID of
    // an object.
    let finalPath = supplant( path, args );

    // Do we have any included models?
    if( include && include.length )
      queryString.push( 'include=' + include.join( ',' ) );

    // Complete the path with the query string.
    if( queryString.length > 0 )
      finalPath += '?' + queryString.join( '&' );

    console.debug( `API ${method} ${type}: ${finalPath}`, data );
    return ajax( finalPath, body, method, type );
  }
}

export default Api;
