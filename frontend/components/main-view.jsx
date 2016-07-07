import React, { Component, PropTypes } from 'react'
import { Grid, Row, Col } from 'react-bootstrap'
import CSSModules from 'react-css-modules'

import AuthenticatedComponent from '../boilerplate/components/auth/authenticated-component'

import styles from './main-view.css'

class MainView extends Component {
  render() {
    const { data = {} } = this.props;
    return (
      <Grid fluid={ true }>
        <Row>
          <Col smOffset={ 3 } sm={ 6 }>
            <h1>Hello world</h1>
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default AuthenticatedComponent( CSSModules( MainView, styles ) );
