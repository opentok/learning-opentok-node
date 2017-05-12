var express = require('express');
var router = express.Router();
var LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./rooms');

const apiKey = process.env.API_KEY || ''
const secret = process.env.API_SECRET || ''

var OpenTok = require('opentok'),
    opentok = new OpenTok(apiKey, secret);

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/**
 * GET /session
 */
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
 * POST /session/:sessionId/archive/start
 */ 
router.post('/session/:sessionId/archive/start', function(req, res, next) {
  var sessionId = req.params.sessionId;
  opentok.startArchive(sessionId, { name: 'Important Presentation' }, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'startArchive error:', err});
      return;
    }
    res.send(archive);
  });
});

/**
 * POST /session/:sessionId/archive/:archiveId/stop
 */
router.post('/session/:sessionId/archive/:archiveId/stop', function(req, res, next) {
  var sessionId = req.params.sessionId;
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

/*
 * GET /session/:sessionId/archive/:archiveId/view
 */
router.get('/session/:sessionId/archive/:archiveId/view', function(req, res, next) {
  var sessionId = req.params.sessionId;
  var archiveId = req.params.archiveId;
  
  // fetch archive
  opentok.getArchive(archiveId, function(err, archive) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'viewArchive error:', err});
      return;
    }

    // return if sessionId does not match
    if (archive.sessionId !== sessionId) {
      const err = new Error("${roomName} does not own this archive");
      res.status(500).send({error: 'viewArchive error:', err});
      return;
    }

    // extract as a JSON object
    const json = Object.keys(archive).reduce((json, key) => {
      json[key] = archive[key];
      return json;
    }, {});

    res.send(json);
  });
});

module.exports = router;
