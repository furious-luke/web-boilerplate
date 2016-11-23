import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as authActions from '../../actions/auth-actions';

function mapStateToProps( state ) {
  const { auth = {} } = state;
  return { auth };
}

function mapDispatchToProps( dispatch ) {
  return {
    authActions: bindActionCreators( authActions, dispatch ),
  };
}

export default (ComposedComponent, LoginView) => {
  return connect( mapStateToProps, mapDispatchToProps )(
    class AuthenticatedComponent extends Component {
      render() {
        const { auth = {}, authActions, ...props } = this.props;
        const { user } = auth;
        if( user ) {
          return (
            <ComposedComponent { ...props } auth={ auth } authActions={ authActions } />
          );
        }
        else {
          if( !LoginView )
            LoginView = require( './login-form' ).default;
          return <LoginView { ...auth } authActions={ authActions } />;
        }
      }
    }
  );
}
