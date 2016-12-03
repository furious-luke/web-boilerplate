import Api from 'boilerplate/api';

let api = new Api({

  login: {
    POST: {
      name: 'login',
      options: {
        type: 'form',
        handler: (req, username, password) => req({ data: { username, password }})
      }
    }
  },

  logout: {
    POST: 'logout'
  }
});

export default api;
