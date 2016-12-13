import { combineReducers } from 'redux';

import schema, { DB } from 'models';
import { createReducer } from './utils';
import { flattenObject } from '../utils';

/**
 * Manages the state for models loaded form a server. As an example
 * of what the store would look like, let's assume we have two model
 * types, Book and Author:
 */
const dbReducer = createReducer({}, {

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
    let db = new DB( state );
    db.set( action.payload );
    return db.data;
  },

  MODEL_APPLY_BLOCK( state, action ) {
    let db = new DB( state );
    db.applyBlock( action.payload );
    return db.data;
  },

  MODEL_SYNC_REQUEST( state, action ) {
    return {
      ...state,
      sync: true
    };
  },

  MODEL_COMMIT_DIFF( state, action ) {
    const { diff, response } = action.payload;
    let db = new DB( state.db );
    db.postCommitDiff( diff, response );
    db.popDiff();
    return {
      ...state,
      db: db.data
    };
  },

  MODEL_SYNC_SUCCESS( state, action ) {
    const { sync, syncErrors, ...rem } = state;
    return rem;
  },

  MODEL_SYNC_FAILURE( state, action ) {
    const { sync, ...rem } = state;
    return {
      ...rem,
      syncErrors: action.payload.errors
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
    let flatResults = {};
    Object.keys( results ).forEach( x => {
      flatResults[x] = flattenObject( results[x].data );
    });
    console.debug( `Model: View load success: ${name}`, flatResults );
    return {
      ...state,
      [name]: {
        ...viewState,
        ...flatResults,
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
