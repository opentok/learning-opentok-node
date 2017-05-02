![logo](./tokbox-logo.png)

# Simple OpenTok Server App by Node.js

This simple server app shows yo how to use [OpenTok Node Server SDK](https://tokbox.com/developer/sdks/node/) to create sessions, generate tokens for those sessions, archive (or record) sessions and download those archives.

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
    4. Visit the URL http://localhost:3000 in your browser. You should see a JSON response containing the OpenTok API key, session ID, and token.

## Exploring the code 

This simple server app starts off using [Express application generator](https://expressjs.com/en/starter/generator.html) which generates a ready-in-use Node.js server app template so that you can focus on implementation rather than configuration, port setup, and error handling etc. There are a couple things getting created but `routes/index.js` is the only piece we need to pay attention to throughout this README.

In order to navigate clients to a designated meeting spot, we associate the [Session ID](https://tokbox.com/developer/guides/basics/#sessions) to a room name which is easier for people to recognize and pass. For simplicity, we use [node-localstorage](https://www.npmjs.com/package/node-localstorage) to implement the association. Basically, [node-localstorage](https://www.npmjs.com/package/node-localstorage) provides a local persistence hash that the key is the room name and the value is the [Session ID](https://tokbox.com/developer/guides/basics/#sessions). For production applications, you might want to configure a database to achieve this functionality.
<br>

#### Generate/Retrieve a session ID

The `GET /room/:name` route handles the passed room name and performs a check to determine whether the app should generate a new session ID or retrieve from the local persistence. Then, we generate the token by that known session ID. Once API key, session ID, and token are ready, you can respond back all of them in a JSON object.

```javascript
router.get('/room/:name', function(req, res, next) {
  var roomName = req.params.name;
  if (localStorage.getItem(roomName) !== null) {
    // fetch an exiting sessionId
    const sessionId = localStorage.getItem(roomName)

    // generate token
    token = opentok.generateToken(sessionId);
    res.send({
      "apiKey": apiKey,
      "sessionId": sessionId,
      "token": token
    });
  }
  else {

    opentok.createSession({mediaMode:"routed"}, function(err, session) {
      if (err) {
        console.log(err);
        res.status(500).send({error: 'createSession error:', err});
        return;
      }

      // store into local
      localStorage.setItem(roomName, session.sessionId);
      
      // generate token
      token = opentok.generateToken(sessionId);
      res.send({
        "apiKey": apiKey,
        "sessionId": sessionId,
        "token": token
      });
    });
  }
});
```

#### Start an [Archive](https://tokbox.com/developer/guides/archiving/)

You can only create an archive for sessions that have at least one client connected, the app will respond back an error otherwise. 

In order to start an archive, the `startArchive` needs a session ID to kick off the process. It's not really a case here to start an archive without a session ID. So at first, the `POST /room/:name/archive/start` route checks if the passed room name exists. If so, we would retrieve the session ID and then start an archive by passing in the known session ID.

```javascript
router.post('/room/:name/archive/start', function(req, res, next) {
  var roomName = req.params.name;
  if (localStorage.getItem(roomName) !== null) {
    // fetch an exiting sessionId
    const sessionId = localStorage.getItem(roomName)
    console.log('attempting to start archive on session: ' + sessionId);

    // start archiving
    opentok.startArchive(sessionId, { name: 'Important Presentation' }, function(err, archive) {
      if (err) {
        console.log(err);
        res.status(500).send({error: 'startArchive error:', err});
        return;
      }
      res.send(archive);
    });
  }
  else {
    const err = new Error("${roomName} does not exist");
    res.status(500).send({error: 'startArchive error:', err});
  }
});
```

#### Stop an Archive

By having similar logic, you can stop a running archive by passing in an existing room name and archiveId(which gets returned by `startArchive` method call).

```javascript
router.post('/room/:name/archive/:archiveId/stop', function(req, res, next) {
  var roomName = req.params.name;
  var archiveId = req.params.archiveId;
  if (localStorage.getItem(roomName) !== null) {
    // stop archiving
    console.log('attempting to stop archiveId: ' + archiveId);
    opentok.stopArchive(archiveId, function(err, archive) {
      if (err) {
        console.log(err);
        res.status(500).send({error: 'stopArchive error:', err});
        return;
      }
      res.send(archive);
    });
  }
  else {
    const err = new Error("${roomName} does not exist");
    res.status(500).send({error: 'stopArchive error:', err});
  }
});
```

## More information
