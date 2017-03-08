import {api} from 'js-tinyapi';

api.merge( require( './api.json' ) );
api.merge({

  login: {
    POST: {
      name: 'login',
      options: {
        type: 'form',
        handler: (req, username, password) => req( {payload: {username, password}} )
      }
    }
  },

  logout: {
    POST: 'logout'
  }
});

export default api;
