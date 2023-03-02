const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const path = require('path');
const axios = require('axios');
const { projectToken } = require('opentok-jwt');
const _ = require('lodash');
const bodyParser = require('body-parser');

const apiKey = process.env.TOKBOX_API_KEY;
const secret = process.env.TOKBOX_SECRET;

const captionsUrl = 'https://api.opentok.com/v2/project';

const postBodyParser = bodyParser.json();
bodyParser.raw();

if (!apiKey || !secret) {
  console.error('='.repeat('80'));
  console.error('');
  console.error('Missing TOKBOX_API_KEY or TOKBOX_SECRET');
  console.error(
    'Find the appropriate values for these by logging into your TokBox Dashboard at: https://tokbox.com/account/#/',
  );
  console.error('Then add them to ', path.resolve('.env'), 'or as environment variables');
  console.error('');
  console.error('='.repeat('80'));
  process.exit();
}

const OpenTok = require('opentok');
const opentok = new OpenTok(apiKey, secret);

// IMPORTANT: roomToSessionIdDictionary is a variable that associates room names with unique
// unique session IDs. However, since this is stored in memory, restarting your server will
// reset these values if you want to have a room-to-session association in your production
// application you should consider a more persistent storage

const roomToSessionIdDictionary = {};

// returns the room name, given a session ID that was associated with it
function findRoomFromSessionId(sessionId) {
  return _.findKey(roomToSessionIdDictionary, function (value) {
    return value === sessionId;
  });
}

router.get('/', function (req, res) {
  res.render('index', { title: 'Learning-OpenTok-Node' });
});

/**
 * GET /session redirects to /room/session
 */
router.get('/session', function (req, res) {
  res.redirect('/room/session');
});

/**
 * GET /room/:name
 */
router.get('/room/:name', function (req, res) {
  const roomName = req.params.name;
  let sessionId;
  let token;

  const tokenOptions = {};
  // we need caption to be moderator role for captions to work
  tokenOptions.role = "moderator";

  console.log('attempting to create a session associated with the room: ' + roomName);

  // if the room name is associated with a session ID, fetch that
  if (roomToSessionIdDictionary[roomName]) {
    sessionId = roomToSessionIdDictionary[roomName];

    // generate token
    token = opentok.generateToken(sessionId, tokenOptions);
    res.setHeader('Content-Type', 'application/json');
    res.send({
      apiKey: apiKey,
      sessionId: sessionId,
      token: token,
    });
  }
  // if this is the first time the room is being accessed, create a new session ID
  else {
    opentok.createSession({ mediaMode: 'routed' }, function (err, session) {
      if (err) {
        console.log(err);
        res.status(500).send({ error: 'createSession error:' + err });
        return;
      }

      // now that the room name has a session associated wit it, store it in memory
      // IMPORTANT: Because this is stored in memory, restarting your server will reset these values
      // if you want to store a room-to-session association in your production application
      // you should use a more persistent storage for them
      roomToSessionIdDictionary[roomName] = session.sessionId;

      // generate token
      token = opentok.generateToken(session.sessionId, tokenOptions);
      res.setHeader('Content-Type', 'application/json');
      res.send({
        apiKey: apiKey,
        sessionId: session.sessionId,
        token: token,
      });
    });
  }
});

/**
 * POST /captions/start
 */
router.post('/captions/start', async function (req, res) {
  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);
  const captionURL = `${captionsUrl}/${apiKey}/captions`;

  const captionPostBody = {
    sessionId: req.body.sessionId,
    token: req.body.token,
    languageCode: 'en-US',
    maxDuration: 36000,
    partialCaptions: 'true',
  };

  try {
    const captionResponse = await axios.post(captionURL, captionPostBody, {
      headers: {
        'X-OPENTOK-AUTH': projectJWT,
        'Content-Type': 'application/json',
      },
    });
    res.send(captionResponse.data.captionsId);
  } catch (err) {
    console.warn(err);
    res.status(500);
    res.send(`Error starting transcription services: ${err}`);
    return;
  }
});

/**
 * POST /captions/stop
 */
router.post('/captions/stop', postBodyParser, async function (req, res) {
  const captionsId = req.body.captionId;

  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);

  const captionURL = `${captionsUrl}/${apiKey}/captions/${captionsId}/stop`;

  try {
    const captionResponse = await axios.post(captionURL, {}, {
      headers: {
        'X-OPENTOK-AUTH': projectJWT,
        'Content-Type': 'application/json',
      },
    });
    res.sendStatus(captionResponse.status);
  } catch (err) {
    console.warn(err);
    res.status(500);
    res.send(`Error stopping transcription services: ${err}`);
    return;
  }
});

/**
 * POST /archive/start
 */
router.post('/archive/start', function (req, res) {
  const json = req.body;
  const sessionId = json.sessionId;
  opentok.startArchive(sessionId, { name: findRoomFromSessionId(sessionId) }, function (err, archive) {
    if (err) {
      console.error('error in startArchive');
      console.error(err);
      res.status(500).send({ error: 'startArchive error:' + err });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

/**
 * POST /archive/:archiveId/stop
 */
router.post('/archive/:archiveId/stop', function (req, res) {
  const archiveId = req.params.archiveId;
  console.log('attempting to stop archive: ' + archiveId);
  opentok.stopArchive(archiveId, function (err, archive) {
    if (err) {
      console.error('error in stopArchive');
      console.error(err);
      res.status(500).send({ error: 'stopArchive error:' + err });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(archive);
  });
});

/**
 * GET /archive/:archiveId/view
 */
router.get('/archive/:archiveId/view', function (req, res) {
  const archiveId = req.params.archiveId;
  console.log('attempting to view archive: ' + archiveId);
  opentok.getArchive(archiveId, function (err, archive) {
    if (err) {
      console.error('error in getArchive');
      console.error(err);
      res.status(500).send({ error: 'getArchive error:' + err });
      return;
    }

    if (archive.status === 'available') {
      res.redirect(archive.url);
    } else {
      res.render('view', { title: 'Archiving Pending' });
    }
  });
});

/**
 * GET /archive/:archiveId
 */
router.get('/archive/:archiveId', function (req, res) {
  const archiveId = req.params.archiveId;

  // fetch archive
  console.log('attempting to fetch archive: ' + archiveId);
  opentok.getArchive(archiveId, function (err, archive) {
    if (err) {
      console.error('error in getArchive');
      console.error(err);
      res.status(500).send({ error: 'getArchive error:' + err });
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
router.get('/archive', function (req, res) {
  const options = {};
  if (req.query.count) {
    options.count = req.query.count;
  }
  if (req.query.offset) {
    options.offset = req.query.offset;
  }

  // list archives
  console.log('attempting to list archives');
  opentok.listArchives(options, function (err, archives) {
    if (err) {
      console.error('error in listArchives');
      console.error(err);
      res.status(500).send({ error: 'infoArchive error:' + err });
      return;
    }

    // extract as a JSON object
    res.setHeader('Content-Type', 'application/json');
    res.send(archives);
  });
});

module.exports = router;
