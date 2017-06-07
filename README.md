![logo](./tokbox-logo.png)

# Simple OpenTok Server App by Node.js

This simple server app shows you how to use [OpenTok Node Server SDK](https://tokbox.com/developer/sdks/node/) to create OpenTok sessions, generate tokens for those sessions, archive (or record) sessions, and download those archives.

## Quick deploy to Heroku

Heroku is a PaaS (Platform as a Service) that can be used to deploy simple and small applications for free. To easily deploy this repository to Heroku, sign up for a Heroku account and click this button:

<a href="https://heroku.com/deploy?template=https://github.com/opentok/learning-opentok-node/" target="_blank">
<img src="https://www.herokucdn.com/deploy/button.png" alt="Deploy">
</a>

Heroku will prompt you to add your OpenTok API key and OpenTok API secret, which you can
obtain at the [TokBox Dashboard](https://dashboard.tokbox.com/keys).

## Requirements

- [Node.js](https://nodejs.org/)

## Installing & Running on localhost

  1. Clone the app by running the command
  
		  git clone git@github.com:opentok/learning-opentok-node.git

  2. `cd` to the root directory.
  3. Run `npm install` command to fetch and install all npm dependecies.
  4. Next, rename the `.envcopy` file located at the root directory to `.env`, and enter in your TokBox api key and secret as indicated:

      ```
      # enter your TokBox api key after the '=' sign below
      TOKBOX_API_KEY=
      # enter your TokBox secret after the '=' sign below
      TOKBOX_SECRET=
      ```
    
  4. Run `npm start` to start the app.
  5. Visit the URL <http://localhost:8080/session> in your browser. You should see a JSON response containing the OpenTok API key, session ID, and token.

## Exploring the code 

The `routes/index.js` file is the Express routing for the web service. The rest of this tutorial
discusses code in this file.

In order to navigate clients to a designated meeting spot, we associate the [Session ID](https://tokbox.com/developer/guides/basics/#sessions) to a room name which is easier for people to recognize and pass. For simplicity, we use a local associated array to implement the association where the room name is the key and the [Session ID](https://tokbox.com/developer/guides/basics/#sessions) is the value. For production applications, you may want to configure a persistence (such as a database) to achieve this functionality.

### Generate/Retrieve a Session ID

The `GET /room/:name` route associates an OpenTok session with a "room" name. This route handles the passed room name and performs a check to determine whether the app should generate a new session ID or retrieve a session ID from the local in-memory hash. Then, it generates an OpenTok token for that session ID. Once the API key, session ID, and token are ready, it sends a response with the body set to a JSON object containing the information.

```javascript
if (localStorage[roomName]) {
  // fetch an existing sessionId
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

### Start an [Archive](https://tokbox.com/developer/guides/archiving/)

A `POST` request to the `/archive/start` route starts an archive recording of an OpenTok session.
The session ID OpenTok session is passed in as JSON data in the body of the request

```javascript
router.post('/archive/start', function(req, res, next) {
  const json = req.body;
  const sessionId = json['sessionId'];
  opentok.startArchive(sessionId, { name: roomName }, function(err, archive) {
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

You can only create an archive for sessions that have at least one client connected. Otherwise,
the app will respond with an error.

### Stop an Archive

A `POST` request to the `/archive:archiveId/stop` route stops an archive recording.
The archive ID is returned by call to the `archive/start` endpoint.

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

### View an Archive

A `GET` request to `'/archive/:archiveId/view'` redirects the requested clients to
a URL where the archive gets played.

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
      res.render('view', { title: 'Archiving Pending' });
    }
  });
});
``` 

### Get Archive information

A `GET` request to `/archive/:archiveId` returns a JSON object that contains all archive properties, including `status`, `url`, `duration`, etc. For more information, see [here](https://tokbox.com/developer/sdks/node/reference/Archive.html).

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
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});
```

### Fetch multiple Archives

A `GET` request to `/archive` with optional `count` and `offset` params returns a list of JSON archive objects. For more information, please check [here](https://tokbox.com/developer/sdks/node/reference/OpenTok.html#listArchives).

Examples:
```javascript
GET /archive // fetch up to 1000 archive objects
GET /archive?count=10  // fetch the first 10 archive objects
GET /archive?offset=10  // fetch archives but first 10 archive objetcs
GET /archive?count=10&offset=10 // fetch 10 archive objects starting from 11st
```

## More information

This sample app does not provide client-side OpenTok functionality
(for connecting to OpenTok sessions and for publishing and subscribing to streams).
It is intended to be used with the OpenTok tutorials for Web, iOS, iOS-Swift, or Android:

* [Web](https://tokbox.com/developer/tutorials/web/basic-video-chat/)
* [iOS](https://tokbox.com/developer/tutorials/ios/basic-video-chat/)
* [iOS-Swift](https://tokbox.com/developer/tutorials/ios/swift/basic-video-chat/)
* [Android](https://tokbox.com/developer/tutorials/android/basic-video-chat/)
