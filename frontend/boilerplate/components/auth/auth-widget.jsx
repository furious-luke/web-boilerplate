import React, { Component, PropTypes } from 'react';
import CSSModules from 'react-css-modules';

import styles from './auth-widget.css';

class AuthWidget extends Component {

  handleClick( ev ) {
    ev.preventDefault();
    this.props.authActions.logout();
  }

  render() {
    const { auth } = this.props || {};
    return (
      <button styleName="buttonValid" onClick={ ::this.handleClick }>
        <span className="fa fa-lock"></span>
      </button>
    );
  }
}

export default CSSModules( AuthWidget, styles );
