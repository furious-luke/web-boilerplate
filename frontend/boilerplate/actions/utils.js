// import $ from '../libs/jquery.wrapper';
// import 'jquery.cookie';
import Cookies from 'js-cookie';

/**
 * Helper function for creating acions. Accepts an optional "thunk"
 * call, which will be used instead of the usual action if given.
 */
function createAction( type, thunk ) {
  let action = ( ...args ) => {

    // If we were given a "thunk" function, return it instead
    // of a standard Redux action.
    if( thunk !== undefined )
      return (dispatch, getState) => thunk( dispatch, getState, ...args );

    // Stadnard action.
    return {
      type,
      payload: (args.length == 1) ? args[0] : args
    };
  };
  return action;
}

/**
 * Global storage for current csrf settings.
 */
var csrfSettings = {
  token: Cookies.get( 'token' ) || 'NO-CSRF-TOKEN'
  // token: $.cookie( 'csrftoken' ) || 'NO-CSRF-TOKEN'
};

function fetchHeaders( opts ) {
  const { method = 'get', dataType } = opts || {};
  let headers = new Headers({
    'X-Requested-With': 'XMLHttpRequest'
  });
  if( dataType == 'json' )
    headers.set( 'Content-Type', 'application/json' );
  if( !(/^(GET|HEAD|OPTIONS\TRACE)$/i.test( method )) )
    headers.set( 'X-CSRFToken', csrfSettings.token );
  return headers;
}

export function ajax( url, body, method, dataType ) {
  let request = new Request( url, {
    method,
    headers: fetchHeaders({ method, dataType }),
    credentials: 'same-origin',
    body: body 
  });
  return fetch( request )
    .then( r => r.ok ? r.json() : r.json().then( e => Promise.reject( e )));
}

/**
 * Helper for posting JSON data.
 */
function postJson( url, data ) {
  return ajax( url, JSON.stringify( data ), 'post', 'json' );
}

/**
 * Helper for posting form data.
 */
function postForm( url, data ) {
  let body = new FormData();
  for( let k in data )
    body.append( k, data[k] );
  return ajax( url, body, 'post' );
}

export { createAction, postJson, postForm, csrfSettings };
