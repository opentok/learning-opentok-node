var express = require('express');
var router = express.Router();
var localStorage = {};

const apiKey = process.env.API_KEY || ''
const secret = process.env.API_SECRET || ''

if (!apiKey || !secret) {
  console.log("================================");
  console.log("Missing apiKey or secret in " + __filename);
  console.log("================================");
  process.exit()
}

var OpenTok = require('opentok'),
    opentok = new OpenTok(apiKey, secret);
var roomName;

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/**
 * GET /session
 */
router.get('/session', function(req, res, next) { 
  res.redirect('/room/session'); 
}); 

/**
 * GET /room/:name
 */
router.get('/room/:name', function(req, res, next) {
  roomName = req.params.name;
  console.log('attempting to create a session associated with' + roomName);
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
});

/**
 * POST /archive/start
 */ 
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

/**
 * POST /archive/:archiveId/stop
 */
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

/**
 * GET /archive/:archiveId/view
 */
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

/**
 * GET /archive/:archiveId
 */
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

/**
 * GET /archives
 */
router.get('/archives', function(req, res, next) {

  var options = {};
  if (req.params.count) {
    options['count'] = req.params.count;
  }
  if (req.param.offset) {
    options['offset'] = req.params.offset;
  }

  // fetch archives
  console.log('attempting to fetch archives');
  opentok.listArchives(options, function(err, archives) {
    if (err) {
      console.log(err);
      res.status(500).send({error: 'infoArchive error:', err});
      return;
    }

    // extract as a JSON object
    res.setHeader('Content-Type', 'application/json');
    res.send(archives);
  });
});

module.exports = router;
