require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const JENKINS_URL = process.env,JENKINS_USER;
const JOB_NAME = process.env,JOB_NAME; // replace with your job name
const JENKINS_USER = process.env.JENKINS_USER; // Jenkins username from environment variable
const JENKINS_TOKEN = process.env.JENKINS_TOKEN; // Jenkins API token from environment variable

let lastBuildNumber = null;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const fetchBuildLogs = async (buildNumber) => {
  try {
    const response = await axios.get(`${JENKINS_URL}/job/${JOB_NAME}/${buildNumber}/logText/progressiveText?start=0`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64')}`
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching logs for build ${buildNumber}:`, error);
    return `Error fetching logs for build ${buildNumber}`;
  }
};

const fetchLastBuildNumber = async () => {
  try {
    const response = await axios.get(`${JENKINS_URL}/job/${JOB_NAME}/lastBuild/api/json`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64')}`
      }
    });
    return response.data.number;
  } catch (error) {
    console.error('Error fetching last build number:', error);
    return null;
  }
};

const checkForNewBuilds = async () => {
  const currentBuildNumber = await fetchLastBuildNumber();
  if (currentBuildNumber && currentBuildNumber !== lastBuildNumber) {
    lastBuildNumber = currentBuildNumber;
    const logs = await fetchBuildLogs(currentBuildNumber);
    io.emit('new-build', { buildNumber: currentBuildNumber, logs });
  }
};

// Check for new builds every 10 seconds
setInterval(checkForNewBuilds, 10000);

io.on('connection', async (socket) => {
  console.log('a user connected');

  const currentBuildNumber = await fetchLastBuildNumber();
  if (currentBuildNumber) {
    for (let i = 0; i < 5; i++) {
      const buildNumber = currentBuildNumber - i;
      if (buildNumber > 0) {
        const logs = await fetchBuildLogs(buildNumber);
        socket.emit('logs', { buildNumber, logs });
      }
    }
    lastBuildNumber = currentBuildNumber;
  } else {
    socket.emit('logs', { buildNumber: null, logs: 'Error fetching build numbers' });
  }

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
