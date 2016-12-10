import { createAction } from './utils';

export const setModel = createAction( 'MODEL_SET' );
export const sync = createAction( 'MODEL_SYNC' );
export const loadModels = createAction( 'MODEL_LOAD' );
export const loadModelView = createAction( 'MODEL_LOAD_VIEW' );
