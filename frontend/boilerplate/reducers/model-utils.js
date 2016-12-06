import { List, Map, Set } from 'immutable';
import uuid from 'uuid';

export function isObject( x ) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export function isEmpty( x ) {
  return x === undefined || x === null;
}

function ModelDoesNotExist() {
}

function ModelTooManyResults() {
}

/**
 *
 */
export function toIndexMap( state, key='id' ) {
  if( isEmpty( state ) )
    return [];
  let index = new Map();
  state.forEach( (item, ii) => {
    const val = item[key];
    if( !index.has( val ) )
      index = index.set( val, new Set([ ii ]) );
    else
      index = index.updateIn([ val ], x => x.add( ii ));
  });
  return index;
}

/**
 * Initialise a model collection.
 */
export function initCollection( data, indices='id' ) {
  if( !(indices instanceof Array) )
    indices = [ indices ];
  let inds = new Map();
  for( const key of indices )
    inds = inds.set( key, toIndexMap( data, key ) );
  return {
    objects: new List( data || [] ),
    indices: inds
  };
}

function reduceIndices( results, indices, key, value ) {
  if( results === undefined )
    return indices[key];
  const other = indices[key][value];
  if( other === undefined )
    return new Set();
  return results.filter( x => other.has( x ));
}

export function filterObjects( state, type, idOrQuery ) {
  if( !state )
    return;
  const coll = state[type];
  if( !coll )
    return
  const { alias = {}, objects, indices } = coll;
  if( !isObject( idOrQuery ) )
    idOrQuery = { id: idOrQuery };
  let results;
  for( const key in idOrQuery )
    results = reduceIndices( results, indices, key, idOrQuery[key] );
  return results;
}

export function getObject( state, type, idOrQuery ) {
  const obj = filterObjects( state, type, idOrQuery );
  if( obj.length > 1 )
    throw new ModelTooManyResults();
  if( obj.length == 0 )
    throw new ModelDoesNotExist();
  return obj;
}

/**
 * Split array of JSON API objects.
 */
export function splitObjects( objects=[], data={} ) {
  if( !(objects instanceof Array) )
      objects = [ objects ];
  objects.forEach( obj => {
    const type = obj.type;
    if( !(type in data) )
      data[type] = [];
    data[type].push( obj );
  });
  return data;
}

/**
 * Split JSON API response.
 */
export function splitJsonApiResponse( response ) {
  let data = splitObjects( response.data );
  data = splitObjects( response.included, data );
  return data;
}

/**
 * Update a model collection. Takes care to update the indices
 * appropriately. Note that this only adds new models and updates
 * existing ones.
 */
export function updateCollection( collection, data, inPlace=false, _indices='id' ) {

  // If we get given an empty collection, just initialise.
  if( collection === undefined )
    return initCollection( data, _indices );

  // Ensure we have an array of objects to add.
  const { objects = [], indices = {} } = collection;
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
 * Remove one or more objects from a collection.
 */
export function removeFromCollection( collection, ids ) {
  const _ids = (ids instanceof Array) ? ids : [ids];
  let objects = [
    ...collection.objects
  ];
  let map = {
    ...collection.map
  };
  for( const id of _ids ) {
    delete objects[map[id]];
    delete map[id];
  }
  return {
    objects,
    map
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

    let res = getLocal( state, rel.type, rel.id ) ||
              getServer( state, rel.type, rel.id );
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
    const type = mod.type;
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

export function ModelError( message ) {
  this.message = message;
}
