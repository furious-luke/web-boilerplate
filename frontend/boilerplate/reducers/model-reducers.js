import { combineReducers } from 'redux';

import schema from 'models';

import { createReducer } from './utils';
import { initCollection, updateCollection, splitObjects,
         getServer, getLocal } from './model-utils';

function ModelError( message ) {
  this.message = message;
}

/**
 * Manages the state for models loaded form a server. As an example
 * of what the store would look like, let's assume we have two model
 * types, Book and Author:
 *
 *   {
 *     server: {
 *       book: {
 *         objects: [],
 *         map: {},
 *       },
 *       author: {
 *         objects: [],
 *         map: {},
 *       }
 *     },
 *     local: {
 *       book: {
 *         objects: [],
 *         map: {},
 *       },
 *       author: {
 *         objects: [],
 *         map: {},
 *       }
 *     }
 *   }
 */
const collectionReducer = createReducer({
  server: {},
  local: {}
}, {

  /**
   * Merge loaded models.
   */
  MODEL_LOAD_SUCCESS( state, action ) {
    const objects = splitObjects( action.payload );
    let newState = { ...state };
    let { server } = newState;

    // Iterate over the model types and the new collections.
    Object.keys( objects ).forEach( type => {
      const data = objects[type];
      if( newState[type] === undefined )
        server[type] = initCollection( data );
      else
        server[type] = updateCollection( server[type], data );
    });

    return newState;
  },

  /**
   * Update attributes of a model, creating the model if it doesn't
   * exist.
   */
  MODEL_SET( state, action ) {
    const { attributes, id, destination = 'local' } = action.payload;
    const type = action.payload.type.toLowerCase();
    const model = schema.getModel( type );

    // Fucking what? No, not this. Anything but this.
    const shitState = { collections: state };

    // Check if this is an update. If it's an update we need to locate
    // the existing model and merge attributes.
    let obj;
    if( id !== undefined ) {
      let existing = getLocal( shitState, type, id );
      if( existing === undefined )
        existing = getServer( shitState, type, id );
      if( existing !== undefined )
        obj = existing;
      else {
        console.error( `Unable to find a model of type ${type} with ID ${id}.` );
        return state;
      }
    }
    else {
      obj = {
        id,
        type
      };
    }

    // Update the model with values from the passed in attributes.
    const { relationships = {} } = model;
    for( const attr of Object.keys( attributes ) ) {
      if( attr in relationships )
        obj.relationships[attr] = attributes[attr];
      else
        obj.attributes[attr] = attributes[attr];
    }

    // Now add the model to the state.
    return {
      ...state,
      [destination]: {
        ...state[destination],
        [type]: updateCollection( state[destination][type], obj )
      }
    };
  },

  MODEL_SYNC_REQUEST( state, action ) {
    return {
      ...state,
      sync: true
    };
  },

  MODEL_SYNC_SUCCESS( state, action ) {
    const { diffs } = action.payload;
    let server = state.collections.server;
    for( const diff of diffs ) {
      const type = diff.model.type.toLowerCase();
      if( diff.op == 'create' ) {
      }
      else if( diff.op == 'remove' ) {
      }
      else {
        server = {
          ...server,
          [type]: {
            ...server.type,
            [diff.model.id]: {
              ...diff.model
            }
          }
        }
      }
    }
    return {
      ...state,
      server: {
        ...server,
      },
      local: {},
      sync: false
    };
  }
});

/**
 * Manages the state of model views. If we have two views, BookView, and
 * AuthorView, then we would have a state like:
 *
 *  {
 *    BookView: {
 *      loading: true
 *    },
 *    AuthorView: {
 *      loading: false
 *    }
 *  }
 *
 */
const viewReducer = createReducer({}, {

  /**
   * Indicates a model view is currently loading.
   */
  MODEL_LOAD_VIEW_REQUEST( state, action ) {
    const { name } = action.payload;
    const viewState = state[name] || {};
    return {
      ...state,
      [name]: {
        ...viewState,
        loading: true
      }
    };
  },

  /**
   * Indicates a model view is currently loading.
   */
  MODEL_LOAD_VIEW_SUCCESS( state, action ) {
    const { name, results } = action.payload;
    const viewState = state[name] || {};
    console.debug( `Model: View load success: ${name}`, results );
    return {
      ...state,
      [name]: {
        ...viewState,
        ...results,
        loading: false
      }
    };
  }
});

const modelReducer = combineReducers({
  collections: collectionReducer,
  views: viewReducer
});

export default modelReducer;
