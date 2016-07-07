import $ from './jquery.wrapper'
import 'jquery.cookie'

var csrfSettings = {
  token: $.cookie( 'csrftoken' ) || 'NO-CSRF-TOKEN'
};

function csrfSafeMethod( method ) {
    return (/^(GET|HEAD|OPTIONS\TRACE)$/.test( method ));
}
$.ajaxSetup({
    beforeSend: function( xhr, settings ) {
	if( !csrfSafeMethod( settings.type ) )
	    xhr.setRequestHeader( 'X-CSRFToken', csrfSettings.token );
    }
});

export default csrfSettings
