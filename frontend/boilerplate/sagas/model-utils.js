export function decodeLookup( lookup, props ) {

  // Can be the model function.
  if( lookup instanceof Function )
    return { model: lookup };

  // Otherwise assume it's an object with options.
  /* let args = lookup.args( props );
     if( !(args instanceof Array) )
     args = [args]; */
  return {
    ...lookup,
    args
  };
}
