import { combineReducers } from 'redux';

import schema, { DB } from 'models';

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
 */
const dbReducer = createReducer({
  server: {},
  local: {}
}, {

  /**
   * Merge loaded models into the DB.
   */
  MODEL_LOAD_SUCCESS( state, action ) {
    let db = new DB( state );
    db.loadJsonApi( action.payload );
    return db.data;
  },

  /**
   * Update attributes of a model, creating the model if it doesn't
   * exist.
   */
  MODEL_SET( state, action ) {
    let db = new DB( state.db );
    db.set( action.payload );
    return {
      ...state,
      db: db.data
    };
  },

  MODEL_SYNC_REQUEST( state, action ) {
    return {
      ...state,
      sync: true
    };
  },

  MODEL_COMMIT_DIFF( state, action ) {
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
  db: dbReducer,
  views: viewReducer
});

export default modelReducer;
