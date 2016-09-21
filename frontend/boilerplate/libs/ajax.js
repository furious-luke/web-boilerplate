import $ from 'jquery';

export function ajax( url, method, data ) {
  let contentType = 'application/json; charset=utf-8',
      dataType = 'json';
  return $.ajax({ url, method, contentType, dataType });
}

export function get( url ) {
  return ajax( url, 'get' );
}

export function post( url, data ) {
  return ajax( url, 'post', JSON.stringify( data ));
}

export function createOrUpdate( urlBase, data, success ) {
  let method, url;
  let contentType = 'application/json; charset=utf-8';
  if( data.id !== undefined ) {
    url = `${urlBase}${data.id}/`;
    method = 'patch';
  }
  else {
    url = urlBase;
    method = 'post';
  }
  $.ajax({ url, method, contentType, data: JSON.stringify( data ), dataType: 'json' })
   .done( response => console.log( response ))
   .error( response => console.error( response ));
}
