import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux-reusable';

import { authActions } from '../../actions/auth-actions';
// import LoginForm from './login-form';
// import AuthWidget from './auth-widget';

function mapStateToProps( state ) {
  const { auth } = state;
  return {
    auth
  };
}

function mapDispatchToProps( dispatch ) {
  return {
    authActions: bindActionCreators( authActions, dispatch ),
  };
}

export default ( ComposedComponent, LoginView ) => {
  return connect( mapStateToProps, mapDispatchToProps )(
    class AuthenticatedComponent extends Component {
      render() {
        const { auth: authCtr, authActions, ...props } = this.props;
        const { auth, authLoading, authError } = authCtr || {};
        const { user } = auth || {};
        if( user ) {
          return (
            <ComposedComponent { ...props } authUser={ user } authActions={ authActions } />
          );
        }
        else
          return <LoginView auth={ auth } error={ authError } loading={ authLoading } authActions={ authActions } />;
      }
    }
  );
}
