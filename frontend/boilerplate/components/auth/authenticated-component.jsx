import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import {authActions} from '../../actions';

export default (ComposedComponent, LoginView) => {

  return connect(

    state => {
      const {auth = {}} = state;
      return {auth};
    },

    dispatch => Object({
      authActions: bindActionCreators( authActions, dispatch )
    })

  )(

    class AuthenticatedComponent extends Component {
      render() {
        const {auth = {}, authActions, ...props} = this.props;
        const {user} = auth;
        if( user ) {
          console.debug( 'AuthenticatedComponent: Logged in.' );
          return (
            <ComposedComponent {...props} auth={auth} authActions={authActions} />
          );
        }
        else {
          console.debug( 'AuthenticatedComponent: Unauthenticated.' );
          if( !LoginView )
            LoginView = require( './login-form' ).default;
          return <LoginView {...auth} authActions={authActions} />;
        }
      }
    }
  );
}
