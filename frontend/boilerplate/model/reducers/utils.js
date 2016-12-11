/**
 * Basic reducer creation. Allows us to use an object to map
 * handlers instead of a switch.
 */
function createReducer( initialState, handlers ) {
  return ( state = initialState, action ) => {
    if( handlers.hasOwnProperty( action.type ) )
      return handlers[action.type]( state, action );
    else
      return state;
  }
}

export { createReducer };
