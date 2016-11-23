import React, { Component, PropTypes } from 'react'
import CSSModules from 'react-css-modules'

import styles from './login-form.css'

class LoginForm extends Component {

  handleSubmit( ev ) {
    ev.preventDefault();
    const { loading, auth, authActions } = this.props || {};
    const { user } = auth || {};
    if( loading || user )
      return;
    const { username, password } = this.state || {};
    authActions.login({ username, password });
  }

  handleChange( ev ) {
    this.setState({ [ev.target.name]: ev.target.value });
  }

  handleUserFocus( ev ) {
    this.setState({ userFocus: true });
  }

  handleUserBlur( ev ) {
    this.setState({ userFocus: false });
  }

  handlePassFocus( ev ) {
    this.setState({ passFocus: true });
  }

  handlePassBlur( ev ) {
    this.setState({ passFocus: false });
  }

  render() {
    const { loading, user, errors = {} } = this.props || {};
    const { userFocus, passFocus } = this.state || {};
    /* const { status, errors = {} } = error || {}; */
    /* const { user, redirect } = auth || {}; */

    let buttonStyle, buttonClass, disabled = false;
    if( loading ) {
      buttonStyle = 'button';
      buttonClass = 'fa fa-gear fa-spin';
      disabled = true;
    }
    else if( user ) {
      buttonStyle = 'buttonValid';
      buttonClass = 'fa fa-lock';
    }
    else {
      buttonStyle = 'button';
      buttonClass = 'fa fa-unlock';
    }

    return (
      <form styleName="form" onSubmit={ ::this.handleSubmit }>
        <h2 styleName="h2"><span className="fa fa-sign-in"></span> Login</h2>
        <button styleName={ buttonStyle } className="submit" disabled={ disabled } onClick={ ::this.handleSubmit }>
          <span className={ buttonClass }></span>
        </button>
        <span styleName={ 'inputUserIcon' + (userFocus ? 'Focus' : '') } className="entypo-user"></span>
        <input styleName="input" type="text" className="user" placeholder="username" name="username" disabled={ disabled }
               onFocus={ ::this.handleUserFocus } onBlur={ ::this.handleUserBlur }
               onChange={ ::this.handleChange } />
        <span styleName={ 'inputPassIcon' + (passFocus ? 'Focus' : '') } className="entypo-key"></span>
        <input styleName="input" type="password" className="pass"placeholder="password" name="password" disabled={ disabled }
               onFocus={ ::this.handlePassFocus } onBlur={ ::this.handlePassBlur }
               onChange={ ::this.handleChange } />
        { Object.keys( errors ).map( key => {
            return errors[key].map( msg => (
              <div styleName="error">
                <p><b>{ ((key != '__all__') ? (key + ': ') : '') }</b>{ msg }</p>
              </div>
            ))})}
      </form>
    );
  }
}

export default CSSModules( LoginForm, styles )
