var express = require('express');
var router = express.Router();
var OpenTok = require('opentok'),
    opentok = new OpenTok('', '');

/* GET home page. */
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

module.exports = router;
