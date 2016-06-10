import csrfSettings from '../../libs/csrf'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux-reusable'

import authActions from '../../actions/auth-actions'
import LoginForm from './login-form'
import AuthWidget from './auth-widget'

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

export default ( ComposedComponent ) => {
  return connect( mapStateToProps, mapDispatchToProps )(
    class AuthenticatedComponent extends Component {
      render() {
        const { auth: authCtr, authActions, ...props } = this.props;
        const { auth, authLoading, authError } = authCtr || {};
        const { user, csrf_token } = auth || {};
        if( user ) {
          if( csrf_token )
            csrfSettings.token = csrf_token;
          return (
            <div>
              <AuthWidget auth={ auth } authActions={ authActions } />
              <ComposedComponent { ...props } authUser={ user } />;
            </div>
          );
        }
        else
          return <LoginForm auth={ auth } error={ authError } loading={ authLoading } authActions={ authActions } />;
      }
    }
  );
}
