import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as modelActions from '../../actions/model-actions';
import { mergeCollections, getObject } from '../../reducers/model-utils';

/**
 * Higher-order component to automatically insert models loaded
 * from a server.
 *
 * The query details which model(s) to load, and is of the form:
 *
 *   {
 *     modelName: {
 *       model: modelType,
 *     },
 *     modelName2: {
 *       model: modelType2:id,
 *     }
 *   }
 */
export default (ComposedComponent, options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return connect(

    state => {
      const { query = {} } = options || {};
      const { model = {} } = state;
      let data = {};
      Object.keys( query ).forEach( name => {
        const { type, id } = query[name];
        const coll = mergeCollections( model, type );
        const value = (id !== undefined) ? getObject( coll, this.props[id] ) : coll;
        if( value !== undefined )
          data[name] = value;
      });
      return data;
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class ModelView extends Component {

      /**
       * Need to load the requried models.
       */
      componentWillMount() {
        this.props.loadModelView( options );
      }

      render() {
        console.log( this.props );
        return <h1>HELLO</h1>;
//        return <ComposedComponent { ...this.props } />;
      }
    }

  );

}
