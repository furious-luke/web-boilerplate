import Api from 'js-tinyapi';

let api = new Api({

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
