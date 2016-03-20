var express = require('express');
var _ = require('lodash');
var util = require("util");
var app = express();
var randomstring = require("randomstring");

var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = process.env.PORT || 1337

app.use(express.static('public'));

app.get('/', function(req, res){
    res.sendfile('views/index.html');
});

app.get('/board', function(req, res){
    res.sendfile('views/board.html');
});

app.get('/deck', function(req, res){
    res.sendfile('views/deck.html');
});

app.get('/instances', function(req, res) {
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.end(util.inspect(instances));
});

// Game instances, each one is a particular room
var instances = [];
// Black Deck
var blackDeck = [];
// White Deck
var whiteDeck = [];
// colors available
var colors = [ '#7b7eaa', '#2c4d97', '#e611fd', '#79dbfc', '#67aa50', '#7d3654', '#8852ff', '#97db2f' ];

io.on('connection', function(socket){

    console.log('a user connected');

    var roomId = "";
    var playerId = randomstring.generate(7);

    // start new game
    socket.on('init-game', function(fn)
    {
        roomId = randomstring.generate(7).toLowerCase();

        instances[roomId] = {
                                board: socket,
                                players: [],
                                colors: colors.slice()
                            };

        console.log('new game initialized', roomId);

        fn(roomId)
    });

    // enter on an existing game
    socket.on('enter-game', function(rId, name, fn)
    {
        roomId = rId;

        if (!_.isUndefined(instances[roomId])) {

            var color = instances[roomId].colors.splice(Math.round(Math.random()*instances[roomId].colors.length-1),1);

            instances[roomId].players[playerId] =
                {
                    playerName: name,
                    socket: socket,
                    color: color
                };

                instances[roomId].board.emit('new-player', playerId, name, color);

            console.log('an player entered in ', roomId);
            fn(true, playerId)
        }
        else
            fn(false, 'Sala não encontrada')
    });

    // confirm poop time
    socket.on('confirm-date', function(date, time)
    {
        instances[roomId].players[playerId].date = date + ' ' + time;
        instances[roomId].board.emit('player-ready', playerId)
    });

    // start new game
    socket.on('init-game-finally', function(fn)
    {
        instances[roomId]['blackCards'] = shuffle(require('./cards/black.json')).slice();
        instances[roomId]['whiteCards'] = shuffle(require('./cards/white.json')).slice();

        setTimeout(function() {
            socket.emit('get-black-cards', instances[roomId].blackCards);

            for (var i in instances[roomId].players)
            {
                instances[roomId].players[i].socket.emit('get-white-cards', instances[roomId].whiteCards.splice(0,10));
            }

            fn(roomId)
        }, 1000);
    });

    socket.on('send-card', function(obj)
    {
        console.log('send-card', obj)
        instances[roomId].board.emit('receive-card', obj)

        socket.emit('draw-card', instances[roomId].whiteCards.splice(0,1))
    });

    socket.on('disconnect', function()
    {
        if (_.isUndefined(instances[roomId]))
            return false;

        if (instances[roomId].board == socket)
        {
            for (var i in instances[roomId].players)
            {
                instances[roomId].players[i].socket.emit('game-finished');
            }

            delete instances[roomId];

            console.log('user disconnected, instance removed');

            return false
        }

        if (!_.isUndefined(instances[roomId])) {
           instances[roomId].board.emit('player-exit', playerId)
           delete instances[roomId][playerId];
        }
    });
});

http.listen(port, function(){
    console.log('listening on *:' + port);
});

function shuffle(a)
{
    var j, x, i;
    for (i = a.length; i; i -= 1) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }

    return a;
}