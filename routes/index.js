var express = require('express');
var router = express.Router();
var LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./rooms');

const apiKey = process.env.API_KEY || ''
const secret = process.env.API_SECRET || ''

var OpenTok = require('opentok'),
    opentok = new OpenTok(apiKey, secret);

/**
 * GET /room/:name
 */
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
    // Create a session that will attempt to transmit streams directly between
    // clients. If clients cannot connect, the session uses the OpenTok TURN server:
    opentok.createSession({mediaMode:"routed"}, function(err, session) {
      if (err) {
        console.log(err);
        res.status(500).send({error: 'createSession error:', err});
        return;
      }

      // store into local
      localStorage.setItem(roomName, session.sessionId);
      
      // generate token
      token = opentok.generateToken(session.sessionId);
      res.send({
        "apiKey": apiKey,
        "sessionId": session.sessionId,
        "token": token
      });
    });
  }
});

/**
 * POST /room/:name/archive/start
 */ 
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

/**
 * POST /room/:name/archive/:archiveId/stop
 */
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

/**
 * Old API endpoints
 */

/*
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/session', function(req, res, next) {
  
  // Create a session that will attempt to transmit streams directly between
  // clients. If clients cannot connect, the session uses the OpenTok TURN server:
  opentok.createSession({mediaMode:"routed"}, function(err, session) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'createSession error:', err});
      return;
    }
    token = opentok.generateToken(session.sessionId);
    res.send({
      "apiKey": '',
      "sessionId": session.sessionId,
      "token": token
    });
  });
});

router.post('/start/:sessionId', function(req, res, next) {
  var sessionId = req.params.sessionId;
  console.log(sessionId);
  opentok.startArchive(sessionId, { name: 'Important Presentation' }, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'startArchive error:', err});
      return;
    }
    res.send(archive);
  });
});

router.post('/stop/:archiveId', function(req, res, next) {
  var archiveId = req.params.archiveId;
  console.log('attempting to stop archiveId: ' + archiveId);
  opentok.stopArchive(archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'stopArchive error:', err});
      return;
    }
    res.send(archive);
  });
});

router.get('/view/:archiveId', function(req, res, next) {
  var archiveId = req.params.archiveId;
  opentok.getArchive(archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'viewArchive error:', err});
      return;
    }
    res.send(archive);
  });
});
*/

module.exports = router;
