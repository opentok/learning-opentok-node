![logo](./tokbox-logo.png)

# Simple OpenTok Server App by Node.js

This simple server app shows you how to use [OpenTok Node Server SDK](https://tokbox.com/developer/sdks/node/) to create sessions, generate tokens for those sessions, archive (or record) sessions and download those archives.

## Quick deploy to Heroku

Heroku is a PaaS (Platform as a Service) that can be used to deploy simple and small applications for free. To easily deploy this repository to Heroku, sign up for a Heroku account and click this button:

<a href="https://heroku.com/deploy?template=https://github.com/opentok/learning-opentok-node/tree/update-rest-endpoints" target="_blank">
<img src="https://www.herokucdn.com/deploy/button.png" alt="Deploy">
</a>

Heroku will prompt you to add your OpenTok API key and OpenTok API secret, which you can
obtain at the [TokBox Dashboard](https://dashboard.tokbox.com/keys).

## Requirements

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)

## Installing && Running on localhost

  1. Once you have cloned the app, `cd` to the root directory.
  2. Run `npm install` command to fetch and install all npm dependecies.
  3. Run `npm start` command to start the app.
  4. Visit the URL http://localhost:8080/session in your browser. You should see a JSON response containing the OpenTok API key, session ID, and token.

## Exploring the code 

This simple server app starts off using [Express application generator](https://expressjs.com/en/starter/generator.html) which generates a ready-in-use Node.js server app template so that you can focus on implementation rather than configuration, port setup, and error handling etc. There are a couple things getting created but `routes/index.js` is the only piece we need to pay attention to throughout this tutorial.

In order to navigate clients to a designated meeting spot, we associate the [Session ID](https://tokbox.com/developer/guides/basics/#sessions) to a room name which is easier for people to recognize and pass. For simplicity, we use [node-localstorage](https://www.npmjs.com/package/node-localstorage) to implement the association. Basically, [node-localstorage](https://www.npmjs.com/package/node-localstorage) provides a local persistence hash that the key is the room name and the value is the [Session ID](https://tokbox.com/developer/guides/basics/#sessions). For production applications, you might want to configure a database to achieve this functionality.
<br>

#### Generate/Retrieve a Session ID

The `GET /room/:name` route handles the passed room name and performs a check to determine whether the app should generate a new session ID or retrieve from the local in-memory hahs. Then, we generate the token by that known session ID. Once API key, session ID, and token are ready, you can respond back all of them in a JSON object.

```javascript
if (localStorage[roomName]) {
  // fetch an exiting sessionId
  const sessionId = localStorage[roomName]

  // generate token
  token = opentok.generateToken(sessionId);
  res.setHeader('Content-Type', 'application/json');
  res.send({
    "apiKey": apiKey,
    "sessionId": sessionId,
    "token": token
  });
}
else {
  // Create a session that will attempt to transmit streams directly between
  // clients. If clients cannot connect, the session uses the OpenTok TURN server:
  opentok.createSession({mediaMode:"routed"}, function(err, session) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'createSession error:', err});
      return;
    }

    // store into local
    localStorage[roomName] = session.sessionId;
    
    // generate token
    token = opentok.generateToken(session.sessionId);
    res.setHeader('Content-Type', 'application/json');
    res.send({
      "apiKey": apiKey,
      "sessionId": session.sessionId,
      "token": token
    });
  });
}
```

The `GET /session` routes generates a convenient session for fast establishment of communication.

```javascript
router.get('/session', function(req, res, next) { 
  res.redirect('/room/session'); 
}); 
```

#### Start an [Archive](https://tokbox.com/developer/guides/archiving/)

You can only create an archive for sessions that have at least one client connected, the app will respond back an error otherwise. 

In order to start an archive, the `startArchive` needs a session ID to kick off the process. It's not really a case here to start an archive without a session ID. So at first, the `POST /archive/start` route checks if the passed room name exists. If so, we would retrieve the session ID and then start an archive by passing in the known session ID.

```javascript
router.post('/archive/start', function(req, res, next) {
  const json = req.body;
  const sessionId = json['sessionId'];
  opentok.startArchive(sessionId, { name: 'Important Presentation' }, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'startArchive error:', err});
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});
```

#### Stop an Archive

By having similar logic, you can stop a running archive by passing in an existing room name and archiveId(which gets returned by `startArchive` method call).

```javascript
router.post('/archive/:archiveId/stop', function(req, res, next) {
  var archiveId = req.params.archiveId;
  console.log('attempting to stop archive: ' + archiveId);
  opentok.stopArchive(archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'stopArchive error:', err});
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});
```

#### View an Archive

The routes redirects the requested clients to a URL where the archive gets played.

```javascript
router.get('/archive/:archiveId/view', function(req, res, next) {
  var archiveId = req.params.archiveId;
  console.log('attempting to view archive: ' + archiveId);
  opentok.getArchive(archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'viewArchive error:', err});
      return;
    }

    if (archive.status == 'available') {
      res.redirect(archive.url); 
    }
    else {
      res.render('view', { title: 'Express' });
    }
  });
});
``` 

#### Fetch an Archive info

The routes returns an json object that contains all archive properties like `status`, `url`, and `duration` etc. For more information, you can look it up [here](https://tokbox.com/developer/sdks/node/reference/Archive.html).

```javascript
router.get('/archive/:archiveId', function(req, res, next) {
  var sessionId = req.params.sessionId;
  var archiveId = req.params.archiveId;
  
  // fetch archive
  console.log('attempting to fetch archive: ' + archiveId);
  opentok.getArchive(archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'infoArchive error:', err});
      return;
    }

    // extract as a JSON object
    const json = Object.keys(archive).reduce((json, key) => {
      json[key] = archive[key];
      return json;
    }, {});
    res.setHeader('Content-Type', 'application/json');
    res.send(json);
  });
});
```

## More information
