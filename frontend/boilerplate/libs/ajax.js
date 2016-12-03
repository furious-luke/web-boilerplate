// import $ from 'jquery';

// export function ajax( url, method, data, useForm ) {
//   let opts = {
//     url,
//     method,
//     data,
//     dataType: 'json'
//   };
//   if( !useForm )
//     opts.contentType = 'application/json; charset=utf-8';
//   console.log( opts );
//   return $.ajax( opts );
// }

// export function get( url ) {
//   return ajax( url, 'get' );
// }

// export function post( url, data, useForm ) {
//   let _data = useForm ? data : JSON.stringify( data );
//   return ajax( url, 'post', _data, useForm );
// }

// export function createOrUpdate( urlBase, data, success ) {
//   let method, url;
//   let contentType = 'application/json; charset=utf-8';
//   if( data.id !== undefined ) {
//     url = `${urlBase}${data.id}/`;
//     method = 'patch';
//   }
//   else {
//     url = urlBase;
//     method = 'post';
//   }
//   $.ajax({ url, method, contentType, data: JSON.stringify( data ), dataType: 'json' })
//    .done( response => console.log( response ))
//    .fail( response => console.error( response ));
// }
