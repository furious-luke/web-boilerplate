import { createAction } from './utils';

export const setDB = createAction( 'MODEL_SET_DB' );
export const sync = createAction( 'MODEL_SYNC' );
export const loadModels = createAction( 'MODEL_LOAD' );
export const loadModelView = createAction( 'MODEL_LOAD_VIEW' );
