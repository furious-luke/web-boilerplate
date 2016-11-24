import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

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
export default (ComposedComponent, query) => {

  // Process the query into components to be used later.
  let splitQuery = {};
  Object.keys( query ).forEach( name => {
    const info = query[name];
    const { model } = info;
    const [ type, id ] = model.split( ':' );
    splitQuery[name] = { type };
    if( id !== undefined )
      splitQuery[name].id = id;
  });

  /**
   * Connect the wrapper component to the model state.
   */
  return connect(

    state => {
      const { models = {} } = state || {};
      let data = {};
      Object.keys( splitQuery ).forEach( name => {
        const { type, id } = query[name];
        data[name] = models[type];
        if( id !== undefined )
          data[name] = getModel( data[name], id );
      });
      return data;
    },

    dispatch => {
      
    }

  )(

    class ModelView extends Component {

      /**
       * Need to load the requried models.
       */
      componentWillMount() {
        const { loadModels } = this.props;
      }
    }

  );

}
