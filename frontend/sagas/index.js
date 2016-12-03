import { authSaga, modelSaga } from 'boilerplate/sagas';

export default function* rootSaga() {
  yield [
    authSaga(),
    modelSaga()
  ];
}
