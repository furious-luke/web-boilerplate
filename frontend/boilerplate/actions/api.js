import { ajax } from './utils';

class Api {

  constructor( urls = {} ) {
    this.GET = name => '-GET-' + name;
    this.POST = name => '-POST-' + name;

    this.merge = ::this.merge;
    this.request = ::this.request;
    this.call = {};
    this.merge( urls );
  }

  merge( endpoints, path = '' ) {
    for( const key of Object.keys( endpoints ) ) {
      let match = /-(GET|POST|PUT|PATCH|DELETE)-(.*)/.exec( key );
      if( match ) {
        let func = endpoints[key];
        let obj = {
          path: path + '/',
          method: match[1],
          func: endpoints[key],
          handler: this.request,
          request: function( options ) {
            return this.handler( this, options );
          }
        };
        obj.request = obj.request.bind( obj );
        this.call[match[2]] = func.bind( obj );
      }
      else
        this.merge( endpoints[key], path + '/' + key )
    }
  }

  request( info, options = {} ) {
    const { method = info.method, path = info.path } = options;
    const { type = 'json', data } = options || {};
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
    return ajax( path, body, method, type );
  }
}

let api = new Api();

export default api;
