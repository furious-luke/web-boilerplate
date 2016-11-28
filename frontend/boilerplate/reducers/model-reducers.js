import { combineReducers } from 'redux';

import { createReducer } from './utils';
import { initCollection, updateCollection, splitObjects,
         getServer, getLocal } from './model-utils';

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
    const { type, attrs = {} } = action.payload;
    const { id } = attrs;
    let obj;

    // Is this a new model?
    if( id === undefined ) {
      obj = {
        ...attrs,
        id: uuid(),
      };
    }
    else {

      // Not new. Is it already in our local cache?
      obj = getLocal( state, type, id );
      if( obj !== undefined ) {
        obj = {
          ...obj,
          ...attrs
        };
      }
      else {

        // Not new, and not in local cache. Copy from server cache.
        obj = getServer( state, type, id );
        if( obj !== undefined ) {
          obj = {
            ...obj,
            ...attrs
          };
        }
        else {

          // Not anywhere, and has an ID. This is an error.
          throw `unable to find a model of type ${type} with ID ${id}`;
        }
      }
    }

    // Now add the model to the state.
    return {
      ...state,
      local: {
        ...state.local,
        [type]: updateCollection( state.local[type], obj )
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
        };
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
