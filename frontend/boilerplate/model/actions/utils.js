/**
 * Helper function for creating acions. Accepts an optional "thunk"
 * call, which will be used instead of the usual action if given.
 */
export function createAction( type, thunk ) {
  let action = ( ...args ) => {

    // If we were given a "thunk" function, return it instead
    // of a standard Redux action.
    if( thunk !== undefined )
      return (dispatch, getState) => thunk( dispatch, getState, ...args );

    // Stadnard action.
    return {
      type,
      payload: (args.length == 1) ? args[0] : args
    };
  };
  return action;
}
