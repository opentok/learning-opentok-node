const express = require('express');
const path = require('path');
const router = express.Router();

const apiKey = process.env.TOKBOX_API_KEY;
const secret = process.env.TOKBOX_SECRET;

if (!apiKey || !secret) {
  console.error('===============================================================================');
  console.error('Missing TOKBOX_API_KEY or TOKBOX_SECRET');
  console.error('Find the appropriate values for these by logging into your TokBox Dashboard');
  console.error('Then add them to ', path.resolve('../.env'), 'or as environment variables' );
  console.error('===============================================================================');
  process.exit();
}

const OpenTok = require('opentok');
const opentok = new OpenTok(apiKey, secret);

// IMPORTANT: roomToSessionIdDictionary is a variable that associates room names with unique sesssion IDs 
// However, since this is stored in memory, restarting your server will reset these values
// if you want to have a room-to-session association in your production application
// you should consider a more persistent storage
var roomToSessionIdDictionary = {};
var roomName;

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Learning-OpenTok-Node' });
});

/**
 * GET /session redirects to /room/session
 */
router.get('/session', function(req, res, next) { 
  res.redirect('/room/session'); 
}); 

/**
 * GET /room/:name
 */
router.get('/room/:name', function(req, res, next) {
  const roomName = req.params.name;
  console.log('attempting to create a session associated with the room: ' + roomName);

  // if the room name is associated with a session ID, fetch that
  if (roomToSessionIdDictionary[roomName]) {
    const sessionId = roomToSessionIdDictionary[roomName]

    // generate token
    const token = opentok.generateToken(sessionId);
    res.setHeader('Content-Type', 'application/json');
    res.send({
      "apiKey": apiKey,
      "sessionId": sessionId,
      "token": token
    });
  }
  // if this is the first time the room is being accessed, create a new session ID
  else {
    opentok.createSession({mediaMode:"routed"}, function(err, session) {
      if (err) {
        console.log(err);
        res.status(500).send({error: 'createSession error:', err});
        return;
      }

      // now that the room name has a session associated wit it, store it in memory
      // IMPORTANT: Because this is stored in memory, restarting your server will reset these values
      // if you want to store a room-to-session association in your production application
      // you should use a more persistent storage for them
      roomToSessionIdDictionary[roomName] = session.sessionId;
      
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
      console.error('error in startArchive');
      console.error(err);
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
      console.error('error in stopArchive');
      console.error(err);
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
      console.error('error in getArchive');
      console.error(err);
      res.status(500).send({error: 'getArchive error:', err});
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
  const sessionId = req.params.sessionId;
  const archiveId = req.params.archiveId;
  
  // fetch archive
  console.log('attempting to fetch archive: ' + archiveId);
  opentok.getArchive(archiveId, function(err, archive) {
    if (err) {
      console.error('error in getArchive');
      console.error(err);
      res.status(500).send({error: 'getArchive error:', err});
      return;
    }

    // extract as a JSON object
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

/**
 * GET /archive
 */
router.get('/archive', function(req, res, next) {

  var options = {};
  if (req.params.count) {
    options['count'] = req.params.count;
  }
  if (req.param.offset) {
    options['offset'] = req.params.offset;
  }

  // list archives
  console.log('attempting to list archives');
  opentok.listArchives(options, function(err, archives) {
    if (err) {
      console.error('error in listArchives');
      console.error(err);
      res.status(500).send({error: 'infoArchive error:', err});
      return;
    }

    // extract as a JSON object
    res.setHeader('Content-Type', 'application/json');
    res.send(archives);
  });
});

module.exports = router;
