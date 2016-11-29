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
    return state || {};
}

/**
 * Initialise a model collection.
 */
export function initCollection( data, key = 'id' ) {
  return {
    objects: data || [],
    map: toIndexMap( data, key )
  };
}

/**
 * Get collection.
 */
export function getCollection( state, cache, type ) {
  const coll = state.collections[cache];
  if( coll )
    return coll[type];
}

/**
 * Get an object from a collection.
 */
export function getCollectionObject( coll, id ) {
  const index = coll.map[id];
  if( index !== undefined )
    return coll.objects[index];
  return undefined;
}

/**
 * Get object from one of the caches.
 */
function getCache( state, cache, type, id ) {
  const coll = getCollection( state, cache, type );
  if( coll !== undefined )
    return getCollectionObject( coll, id );
  return undefined;
}

/**
 * Merge collection.
 */
export function mergeCollections( state, type ) {
  const server = getCollection( state, 'server', type );
  const local = getCollection( state, 'local', type );
  if( local === undefined )
    return server;
  if( server === undefined )
    return local;
  return updateCollection( server, local.objects );
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
 * Split array of objects.
 */
export function splitObjects( objects ) {
  let data = {};
  objects.forEach( obj => {
    const type = obj.type.toLowerCase();
    if( !(type in data) )
      data[type] = [];
    data[type].push( obj );
  });
  return data;
}

/**
 * Update a model collection.
 */
export function updateCollection( collection, data, inPlace=false, key='id' ) {
  const { objects = [], map = {} } = collection || {};

  // Ensure we have an array of objects to add.
  if( !Array.isArray( data ) )
    data = [ data ];

  // Create duplicates of the current state.
  let newObjects, newMap;
  if( inPlace ) {
    newObjects = objects;
    newMap = map;
  }
  else {
    newObjects = [ ...objects ];
    newMap = { ...map };
  }

  // Add each object.
  data.forEach( newObj => {

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

/**
 * Resolve a relationship.
 */
export function collectRelationships( state, relation, cache = {} ) {
  const _relations = (relation instanceof Array) ? relation : [ relation ];
  let results = [];
  _relations.forEach( rel => {

    // Relationships can be null, meaning they're a foreignkey
    // and there's no value.
    if( rel === null )
      return null;

    let res = getLocal( state, rel.type.toLowerCase(), rel.id ) ||
              getServer( state, rel.type.toLowerCase(), rel.id );
    if( res !== undefined )
      res = collect( state, res, cache );
    else
      res = rel.id;
    results.push( res );
  });
  if( relation instanceof Array )
    return results;
  return results[0];
}

/**
 * Collect model relationships.
 */
export function collect( state, model, cache = {} ) {
  const _models = (model instanceof Array) ? model : [ model ]; 
  let results = _models.map( mod => {

    // Check if the object exists in our cache.
    const type = mod.type.toLowerCase();
    if( type in cache && mod.id in cache[type] )
      return cache[type][mod.id];

    // Build the object and insert into cache.
    let obj = {
      id: mod.id,
      type,
      attributes: {
        ...mod.attributes
      }
    };
    if( !(type in cache) )
      cache[type] = {};
    cache[type][obj.id] = obj;

    // Build relationships.
    const { relationships = {} } = mod;
    for( const key of Object.keys( relationships ) )
      obj.attributes[key] = collectRelationships( state, relationships[key], cache );
    return obj;
  });
  if( model instanceof Array )
    return results;
  return results[0];
}
