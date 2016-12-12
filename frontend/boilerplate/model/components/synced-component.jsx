import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as modelActions from '../actions';
import { DB } from '..';
import { isObject } from '../utils';

/**
 * Higher-order component to automatically insert models loaded
 * from a server.
 */
export default (ComposedComponent, options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return connect(

    state => {
      const { name } = options || {};
      const { model = {} } = state;
      const { views = {} } = model;
      const db = new DB( model.db );
      let data = {};
      Object.keys( views[name] || {} ).forEach( x => {
        const value = views[name][x];
        if( !isObject( value ) )
          data[x] = value;
        else if( Array.isArray( value ) )
          data[x] = value.map( y => db.get( {_type: y._type, id: y.id} ) );
        else
          data[x] = db.get( {_type: value._type, id: value.id} );
      });
      console.debug( 'SyncedComponent: ', data );
      return {
        ...data,
        db
      };
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class SyncedComponent extends Component {

      /**
       * Need to load the requried models.
       */
      componentWillMount() {
        console.debug( 'SyncedComponent: Loading.' );
        this.props.loadModelView({ ...options, props: this.props });
      }

      render() {
        return <ComposedComponent { ...this.props } />;
      }
    }

  );

}
