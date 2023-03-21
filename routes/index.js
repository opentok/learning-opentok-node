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

const opentokUrl = 'https://api.opentok.com/v2/project';

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

// IMPORTANT: roomToSessionIdDictionary is a variable that associates room names with
// unique session IDs. However, since this is stored in memory, restarting your server will
// reset these values. If you want to have a room-to-session association in your production
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

router.post('/captions/start', async (req, res) => {
  const sessionId = req.body.sessionId;

  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);
  const captionURL = `${opentokUrl}/${apiKey}/captions`;

  const captionPostBody = {
    sessionId,
    token: req.body.token,
    languageCode: 'en-US',
    maxDuration: 14400,
    partialCaptions: 'true',
  };

  try {
    const captionResponse = await axios.post(captionURL, captionPostBody, {
      headers: {
        'X-OPENTOK-AUTH': projectJWT,
        'Content-Type': 'application/json',
      },
    });

    const captionsId = captionResponse.data.captionsId;
    res.send({ id: captionsId });
  } catch (err) {
    console.warn(err);
    res.status(500);
    res.send(`Error starting transcription services: ${err}`);
    return;
  }
});

router.post('/captions/:captionsId/stop', postBodyParser, async (req, res) => {
  const captionsId = req.params.captionsId;

  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);

  const captionURL = `${opentokUrl}/${apiKey}/captions/${captionsId}/stop`;

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

router.post('/render', async (req, res) => {
  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);
  const renderURL = `${opentokUrl}/${apiKey}/render`;

  const renderPostBody = {
    sessionId: req.body.sessionId,
    token: req.body.token,
    "url": "https://www.google.com",
    maxDuration: 36000,
    "resolution": "1280x720",
    "properties": {
      name: "Composed stream for Live event",
    },
  };
  try {
    const renderResponse = await axios.post(renderURL, renderPostBody, {
      headers: {
        'X-OPENTOK-AUTH': projectJWT,
        'Content-Type': 'application/json',
      },
    });
    res.send(renderResponse.data.id);
  } catch (err) {
    console.warn(err);
    res.status(500);
    res.send(`Error starting Experience Composer: ${err}`);
    return;
  }
});

router.get('/render/info', async (req, res) => {
  const renderId = req.body.id;

  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);

  const renderURL = `${opentokUrl}/${apiKey}/render/${renderId}`;

  try {
    const renderResponse = await axios.get(renderURL, {
      headers: {
        'X-OPENTOK-AUTH': projectJWT,
        'Content-Type': 'application/json',
      },
    }, {});
    res.sendStatus(renderResponse.status);
  } catch (err) {
    console.warn(err);
    res.status(err.status);
    res.send(`Error retrieving composer information: ${err}`);
    return;
  }
});

router.get('/render/list', async (req, res) => {
  const count = req.body.count;

  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);

  const renderURL = `${opentokUrl}/${apiKey}/render?count=${count}`;

  try {
    const renderResponse = await axios.get(renderURL, {
      headers: {
        'X-OPENTOK-AUTH': projectJWT,
        'Content-Type': 'application/json',
      },
    }, {});
    res.sendStatus(renderResponse.status);
  } catch (err) {
    console.warn(err);
    res.status(err.response.status);
    res.send(`Error retrieving composer information: ${err}`);
    return;
  }
});

router.delete('/render/stop', postBodyParser, async (req, res) => {
  const renderId = req.body.id;

  // With custom expiry (Default 30 days)
  const expires = Math.floor(new Date() / 1000) + (24 * 60 * 60);
  const projectJWT = projectToken(apiKey, secret, expires);
  const renderURL = `${opentokUrl}/${apiKey}/render/${renderId}/`;
  try {
    const renderResponse = await axios.delete(renderURL, {
      headers: {
        'Content-Type': 'application/json',
        'X-OPENTOK-AUTH': projectJWT,
      },
    }, {});
    res.sendStatus(renderResponse.status);
  } catch (err) {
    console.warn(err);
    res.status(err.response.status);
    res.send(`Error stopping the composer: ${err}`);
    return;
  }
});

module.exports = router;
