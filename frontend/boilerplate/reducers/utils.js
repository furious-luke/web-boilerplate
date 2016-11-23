function createReducer( initialState, handlers ) {
  let typeHandlers = {};
  Object.keys( handlers ).forEach( k => typeHandlers[k.type] = handlers[k] );
  return ( state = initialState, action ) => {
    if( typeHandlers.hasOwnProperty( action.type ) )
      return typeHandlers[action.type]( state, action );
    else
      return state;
  }
}

export { createReducer };
