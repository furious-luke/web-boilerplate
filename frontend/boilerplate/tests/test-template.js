var jsdom = require( 'jsdom-global' )();  // must come first
var React = require( 'react' );
var TU = require( 'react-addons-test-utils' );
var assert = require( 'assert' );

// Require module to be tested.

describe( 'Test', function() {

  it( 'does something', function() {
    /* let com = TU.renderIntoDocument( <TheComponent /> );
       let div = TU.findRenderedDOMComponentWithTag( com, 'div' );
       assert.notEqual( div, undefined ); */
  });

  it( 'does something else', function() {
    /* let com = TU.renderIntoDocument( <TheComponent /> );
       com.addNotification({ title: 'hello', body: 'world' });
       let div = TU.scryRenderedDOMComponentsWithTag( com, 'ul' );
       assert.notEqual( div, [] ); */
  });
});
