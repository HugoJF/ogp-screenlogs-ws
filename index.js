const fs = require('fs');
const server = require('http').createServer();
const io = require('socket.io')(server);

require('dotenv').config();

const SCREENLOGS_LOCATION = process.env.SCREENLOGS_LOCATION;

/*
 * Room names
 */
const getHomeRoom = (home) => `home-${home}`;
/*
 * Socket.IO
 */
io.on('connection', socket => {
    console.log('Client connected');
    socket.on('disconnect', reason => {
    });

    socket.on('subscribe-home', home => {
        console.log(`Subscription request for home ${home}`);
        // TODO: sanitize home name
        let room = getHomeRoom(home);
        socket.join(room);
        socket.emit('logs', 'Connected');
    });
});

server.listen(3000, () => {
    console.log('Listening...');
});

let trackings = {};

fs.watch(SCREENLOGS_LOCATION, (type, file) => {
    let stat = undefined;
    try {
        stat = fs.statSync(SCREENLOGS_LOCATION + file);
    } catch (e) {
        console.log('Error while stating', file, e);
        return;
    }

    let newSize = stat.size;
    let match = file.match(/screenlog\.OGP_(HOME|UPDATE)_0*(\d*)/);

    if (!match || match.length !== 3) return;
    let id = match[2];
    let logType = match[1];

    let lastRead = getLastReadSize(id, logType, newSize);

    if (newSize !== lastRead) {
        fs.createReadStream(SCREENLOGS_LOCATION + file, {start: lastRead})
            .on('data', (data) => {
                console.log('Sending', data.toString(), 'from', id, 'event type:', logType.toLowerCase());
                io.to(getHomeRoom(id)).emit(logType.toLowerCase(), data.toString());
            });

        setLastReadSize(id, logType, newSize);
    }
});

function getLastReadSize(id, logType, defaultValue) {
    if (!trackings[id])
        return defaultValue;
    if (!trackings[id][logType])
        return defaultValue;

    return trackings[id][logType]['lastRead'];
}

function setLastReadSize(id, logType, newSize) {
    if (!trackings[id])
        trackings[id] = {};

    if (!trackings[id][logType])
        trackings[id][logType] = {};

    trackings[id][logType]['lastRead'] = newSize;
}