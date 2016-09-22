import $ from 'jquery';

var flatten = function( data ) {

  function flatten_recurse( prefix, data, result ) {
    Object.keys( data ).forEach( key => {
      let val = data[key];
      if( val instanceof Array )
        val.map( ( item, ii ) => result[prefix + key + '[' + ii + ']'] = item );
      else if( val === Object( val ) && !(val instanceof Blob) ) {
        flatten_recurse( prefix + key + '__', val, result );
      }
      else
        result[prefix + key] = val;
    });
  }

  var result = {};
  flatten_recurse( '', data, result );
  return result;
}

var make_formdata = function( data ) {
  let flatData = flatten( data );
  var fd = new FormData();
  Object.keys( flatData ).forEach( key => {
    fd.append( key, flatData[key] );
  });
  return fd;
}

var Model = {

  save: function( options ) {
    var opts = {
      type: options.type || 'POST',
      url: options.url,
      dataType: 'json'
    };

    if( options.formdata ) {
      opts.data = make_formdata( options.formdata );
      opts.processData = false;
      opts.contentType = false;
    }
    else {
      opts.data = JSON.stringify( options.data );
      opts.contentType = 'application/json; charset=utf-8';
    }

    opts.success = function( response, status ) {
      if( status != 'success' ) {
	console.error( response );
	if( options.error )
	  options.error( response );
      }
      else {
	if( options.success )
	  options.success( response );
      }
    }

    var xhr = $.ajax( opts ).fail( function( xhr, status, error ) {
      console.error( xhr.responseText );
      if( options.error )
	options.error( status, undefined, error );
    });
    if( options.always )
      xhr.always( options.always );

    return xhr;
  },

  load: function( options ) {
    var opts = {
      url: options.url,
      dataType: 'json'
    };
    if( options.filter )
      opts.url += options.filter;

    var xhr = $.get( opts )
	       .fail( function( xhr, status, error ) {
		 console.error( xhr.responseText );
		 if( options.error )
		   options.error( status, undefined, error );
	       });
    if( options.success )
      xhr.done( options.success );
    if( options.always )
      xhr.always( options.always );

    return xhr;
  },
}

export default Model;
