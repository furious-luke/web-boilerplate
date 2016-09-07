import $ from 'jquery';

export function get( url ) {
  let method = 'get', contentType = 'application/json; charset=utf-8',
      dataType = 'json';
  return $.ajax({ url, method, contentType, dataType });
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
