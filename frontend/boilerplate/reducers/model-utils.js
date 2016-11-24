import uuid from 'uuid';

/**
 * Take an array of objects and return a mapping from a uniquely
 * identified field to the objects.
 */
export function toObjectMap( state, key = 'id' ) {
  if( Array.isArray( state ) ) {
    let byId = {};
    state.forEach( item => byId[item[key]] = item );
    return byId;
  }
  else
    return state;
}

/**
 * Similar to `toObjectMap`, but instead of mapping to the objects,
 * map to the indices of the objects in the original array.
 */
export function toIndexMap( state, key = 'id' ) {
  if( Array.isArray( state ) ) {
    let byId = {};
    state.forEach( ( item, ii ) => byId[item[key]] = ii );
    return byId;
  }
  else
    return state;
}

/**
 * Initialise a model collection.
 */
export function initCollection( state, key = 'id' ) {
  return {
    objects: state,
    map: toIndexMap( state, key )
  };
}

/**
 * Get an object from a collection.
 */
export function getObject( coll, id ) {
  const index = coll.map[id];
  if( index !== undefined )
    return coll.objects[index];
  return undefined;
}

/**
 * Get object from one of the caches.
 */
export function getCache( state, cache, type, id ) {
  const coll = state[cache][type];
  if( coll !== undefined )
    return getObject( coll, id );
  return undefined;
}

/**
 * Get object from local cache.
 */
export function getLocal( state, type, id ) {
  return getCache( state, 'local', type, id );
}

/**
 * Get object from server cache.
 */
export function getServer( state, type, id ) {
  return getCache( state, 'server', type, id );
}

/**
 * Update a model collection.
 */
export function updateCollection( state, data, key = 'id' ) {
  const { objects = [], map = {} } = state || {};

  // Ensure we have an array of objects to add.
  if( !Array.isArray( data ) )
    data = [ data ];

  // Create duplicates of the current state.
  let newObjects = [ ...objects ], newMap = { ...map };

  // Add each object.
  results.forEach( newObj => {

    // Check the ID.
    const id = newObj[key];
    if( id === undefined )
      throw 'Cannot update a model array with no ID.';

    // Do we already have this ID? If not, add it at the end.
    let index = newMap[id];
    if( index === undefined )
      index = newObjects.length;

    // Add the attributes.
    newObjects[index] = newObj;
    newMap[id] = index;
  });

  return {
    objects: newObjects,
    map: newMap
  };
}
