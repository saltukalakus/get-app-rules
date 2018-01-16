window.addEventListener('load', function() {
  var content = document.querySelector('.content');
  var loadingSpinner = document.getElementById('loading');
  content.style.display = 'block';
  loadingSpinner.style.display = 'none';

  var webAuth = new auth0.WebAuth({
    domain: AUTH0_DOMAIN,
    clientID: AUTH0_CLIENT_ID,
    redirectUri: AUTH0_CALLBACK_URL,
    audience: 'https://' + AUTH0_DOMAIN + '/userinfo',
    responseType: 'token id_token',
    scope: 'openid',
    leeway: 60
  });

  // webAuth.crossOriginVerification();

  var loginStatus = document.querySelector('.container h4');
  var loginView = document.getElementById('login-view');
  var homeView = document.getElementById('home-view');

  // buttons and event listeners
  var homeViewBtn = document.getElementById('btn-home-view');
  var loginBtn = document.getElementById('qsLoginBtn');
  var logoutBtn = document.getElementById('qsLogoutBtn');

  homeViewBtn.addEventListener('click', function() {
    homeView.style.display = 'inline-block';
    loginView.style.display = 'none';
  });

  loginBtn.addEventListener('click', function(e) {
    e.preventDefault();
    webAuth.authorize();
  });

  logoutBtn.addEventListener('click', logout);

  function setSession(authResult) {
    // Set the time that the access token will expire at
    var expiresAt = JSON.stringify(
      authResult.expiresIn * 1000 + new Date().getTime()
    );
    localStorage.setItem('access_token', authResult.accessToken);
    localStorage.setItem('id_token', authResult.idToken);
    localStorage.setItem('expires_at', expiresAt);
  }

  function logout() {
    // Remove tokens and expiry time from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('expires_at');
    displayButtons();
  }

  function isAuthenticated() {
    // Check whether the current time is past the
    // access token's expiry time
    var expiresAt = JSON.parse(localStorage.getItem('expires_at'));
    return new Date().getTime() < expiresAt;
  }

  function handleAuthentication() {
    webAuth.parseHash(function(err, authResult) {
      if (authResult && authResult.accessToken && authResult.idToken) {
        window.location.hash = '';
        setSession(authResult);
        loginBtn.style.display = 'none';
        homeView.style.display = 'inline-block';
      } else if (err) {
        homeView.style.display = 'inline-block';
        console.log(err);
        alert(
          'Error: ' + err.error + '. Check the console for further details.'
        );
      }
      displayButtons();
    });
  }

  function displayButtons() {
    if (isAuthenticated()) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
      loginStatus.innerHTML = '<h1>Here is the rules list!</h1>';
      showRules();
    } else {
      loginBtn.style.display = 'inline-block';
      logoutBtn.style.display = 'none';
      loginStatus.innerHTML =
        'You are not logged in! Please log in to continue.';
    }
  }

  function showRules() {
    var printRules = function(clients) {
      clients.forEach(function(client) {
        homeView.innerHTML += '<h2>' + client.name + '</h2><ul>';

        if (client.rules.length === 0) {
          homeView.innerHTML += '<li>' + 'No rules' + '</li>';
        }

        client.rules.forEach(function(rule) {
          homeView.innerHTML += '<li>' + rule + '</li>';
        });

        homeView.innerHTML += '</ul>';
      });
    };

    var UnauthorizedError = function() {} // stub for exception used in a rule.

    var settings = {
      "async": true,
      "crossDomain": true,
      "url": `https://${AUTH0_DOMAIN}/oauth/token`,
      "method": "POST",
      "headers": {
        "content-type": "application/json"
      },
      "data": "{\"client_id\":\"" + AUTH0_CLIENT_ID + "\",\"client_secret\":\"" + AUTH0_CLIENT_SECRET + "\",\"audience\":\"https://" + AUTH0_DOMAIN + "/api/v2/\",\"grant_type\":\"client_credentials\"}"
    }

    $.ajax(settings).done(function (response) {
      var bearer = response.access_token;
      var clients = null;
      var rules = null;

      $.ajax({
        "async": true,
        "crossDomain": true,
        "url": `https://${AUTH0_DOMAIN}/api/v2/clients`,
        "method": "GET",
        "headers": {
          "authorization": "Bearer " + bearer
        }
      }).done(function (response) {
        clients = response;

        $.ajax({
          "async": true,
          "crossDomain": true,
          "url": `https://${AUTH0_DOMAIN}/api/v2/rules`,
          "method": "GET",
          "headers": {
            "authorization": "Bearer " + bearer
          }
        }).done(function (response) {
          rules = response;

          clients.forEach(function(client) {
            if (!client.rules) { client.rules = []; }

            rules.forEach(function(rule) {
              eval('var runnableRule = ' + rule.script);
              runnableRule({}, { clientName: client.name }, function(error, user, context){
                if (error) {
                  return;
                }
                if (context.skipped) {
                  return;
                }
                if (context.processed) {
                  client.rules.push(rule.name);
                }
              });
            });
          });

          printRules(clients);

        });
      });
    });
  }

  handleAuthentication();
});
