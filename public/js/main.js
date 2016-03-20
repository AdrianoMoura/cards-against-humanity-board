var myApp = new Framework7({
    material: true,
    modalTitle: 'Cards Against Humanity',
    precompileTemplates: true,
    template7Pages: true
});

var socket = io();

var playerId;
var playerName;

var mainView = myApp.addView('.view-main', {
    dynamicNavbar: true
})

myApp.onPageInit('home', function()
{
    $('.enter-game').on('click', function()
    {
        myApp.prompt('Seu nome', function (name) {
            myApp.prompt('ID da Sala', function (roomId) {
                socket.emit('enter-game', roomId, name, function (success, msg) {
                    if (!success) {
                        myApp.alert(msg);
                    }
                    else {
                        playerName = name;

                        mainView.router.load({
                            url: '/deck',
                            context: {
                                roomId: roomId
                            }
                        });

                        playerId = msg;
                    }
                });
            });
        });
    });

    $('.init-game').on('click', function()
    {
        socket.emit('init-game', function(roomId)
        {
            mainView.router.load({
                url: '/board',
                context: {
                    roomId: roomId
                }
            });
        });
        launchFullScreen(document.documentElement);
    });

}).trigger();

var blackCards;
var whiteCards;
var waitingPlayers = -1;

myApp.onPageInit('board', function()
{

    socket.on('new-player', function(playerId, name, color){
        $('.user-list ul').append(Template7.templates.playerTemplate({
            playerId: playerId,
            name: name,
            color: color
        }));
        waitingPlayers = waitingPlayers == -1 ? 1 : waitingPlayers+1;
    });

    socket.on('player-ready', function(playerId){
        $('.user-list ul #p' + playerId).find('.item-after').html('<span style="color: green">Pronto</span>');
        waitingPlayers--;
    });

    socket.on('receive-card', function(obj)
    {
        var anims = ['bounceInRight', 'bounceInLeft', 'bounceInUp', 'bounceInDown']

        $('.page[data-page="board"] .page-content').append(Template7.templates.whiteCardTemplate({
            text: obj.text,
            player: obj.player,
            x: Math.round(Math.random()*($(document).width()-200)),
            y: Math.round(Math.random()*($(document).height()-200)),
            anim: anims[Math.round(Math.random()*3)]
        }));

        $('.rotate-area').TouchBox({
            resize: false,
            drag: false,
            rotate: true,
            grid_drag: 1,
            callback_touches: function (touches) {
                //Touch added or removed from touches. Parameter is given with current touches
                //this is DOM element, so using $(this) wil give you an jQuery element
            },
            callback_size_change: function (newWidth, newHeight) {
                //User changed the size of the DOM element - this is DOM element, so using $(this) wil give you an jQuery element.
            },
            callback_position_change: function (newLeft, newTop) {
                //User changed the position of the DOM element - this is DOM element, so using $(this) wil give you an jQuery element.
            },
            callback_degree_change: function (lastDegree, newDegree) {
                //User changed the degrees of the DOM element - this is DOM element, so using $(this) wil give you an jQuery element.
            }
        });
    });

    socket.on('player-exit', function(playerId){
        $('.user-list ul #p' + playerId).remove();
        waitingPlayers = waitingPlayers == 0 ? -1 : waitingPlayers-1;
    });

    $('.clear').on('click', function()
    {
        var anims = ['bounceOutRight', 'bounceOutLeft', 'bounceOutUp', 'bounceOutDown']
        $('.flip-container.hover').parent().removeClass()
        $('.flip-container.hover').parent().addClass('animated')

        $('.flip-container.hover').each(function()
        {
            $(this).parent().addClass(anims[Math.round(Math.random()*anims.length-1)])
        });

        setTimeout(function()
        {
            $('.flip-container.hover').parent().remove()
        },800);
    });

    $('.init-game-finally').on('click', function()
    {

        if (waitingPlayers == 0) {
            myApp.showIndicator();
            $('.init-modal').fadeOut();
            socket.emit('init-game-finally', function () {
                myApp.hideIndicator();
            });
        }
        else
        {
            myApp.alert('Aguarde os jogadores')
        }
    });

    socket.on('get-black-cards', function(cards){
        blackCards = cards;

        insertBlackCards(0)
    });
});

function insertBlackCards(i)
{
    setTimeout(function(){

        var blackCard = Template7.templates.blackCardTemplate({
            card: blackCards[i]
        });

        $('.black-deck').append(blackCard);

        if (i+1 < blackCards.length)
        {
            insertBlackCards(i+1)
        }
        else
        {
            setDrag()
        }
    }, 50);
}
var mySwiper;

myApp.onPageInit('deck', function()
{
    $('.confirm-date').on('click', function()
    {
        socket.emit('confirm-date', $('#data').val(), $('#time').val());
        $('.content-modal').html('<h2>Aguardando inicio do jogo</h2>')
    });

    socket.on('draw-card', function(cards){
        whiteCards.push(cards[0]);

        var cardsSlide = Template7.templates.cardSlideTemplate({
            cards: cards
        });

        mySwiper.appendSlide(cardsSlide);

    })

    socket.on('get-white-cards', function(cards){
        $('.init-modal').remove();

        whiteCards = cards;

        var cardsSlide = Template7.templates.cardSlideTemplate({
            cards: whiteCards
        });

        $('.swiper-wrapper').html(cardsSlide);

        if (mySwiper)
            mySwiper.destroy()

        mySwiper = myApp.swiper('.swiper-container', {
            pagination:'.swiper-pagination'
        });

        setTimeout(function()
        {
            $('.swiper-slide .whiteCard').removeClass('bounceInUp');
        },1000);

        interact('.swiper-slide .whiteCard').on('doubletap', function (event) {
            $(event.currentTarget).addClass('bounceOutUp');

            setTimeout(function () {
                socket.emit('send-card', {
                    text: $(event.currentTarget).find('.inner').html(),
                    player: playerName
                });
                mySwiper.removeSlide(mySwiper.activeIndex);
            }, 1000);
        })

    });
});

socket.on('game-finished', function(){
    myApp.alert('O jogo acabou!!', function()
    {
       location.href ='/'
    });
});

setDrag = function()
{
    interact('.draggable')
        .draggable({
            // enable inertial throwing
            inertia: true,
            // keep the element within the area of it's parent
            restrict: {
                restriction: "body",
                endOnly: true,
                elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
            },
            // enable autoScroll
            autoScroll: true,

            // call this function on every dragmove event
            onmove: dragMoveListener,
            // call this function on every dragend event
            onend: function (event) {

            }
        });

    function dragMoveListener (event) {
        var target = event.target,
        // keep the dragged position in the data-x/data-y attributes
            x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
            y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        // translate the element
        target.style.webkitTransform =
            target.style.transform =
                'translate(' + x + 'px, ' + y + 'px)';

        // update the posiion attributes
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
    }

    // this is used later in the resizing and gesture demos
    window.dragMoveListener = dragMoveListener;





    $('.rotate-area').TouchBox({
        resize: false,
        drag: false,
        rotate: true,
        grid_drag: 1,
        callback_touches: function (touches) {
            //Touch added or removed from touches. Parameter is given with current touches
            //this is DOM element, so using $(this) wil give you an jQuery element
        },
        callback_size_change: function (newWidth, newHeight) {
            //User changed the size of the DOM element - this is DOM element, so using $(this) wil give you an jQuery element.
        },
        callback_position_change: function (newLeft, newTop) {
            //User changed the position of the DOM element - this is DOM element, so using $(this) wil give you an jQuery element.
        },
        callback_degree_change: function (lastDegree, newDegree) {
            //User changed the degrees of the DOM element - this is DOM element, so using $(this) wil give you an jQuery element.
        }
    });

    interact('.tap-target').on('doubletap', function (event) {
        event.currentTarget.classList.toggle('hover')
    })
}

function launchFullScreen(element) {
    if(element.requestFullScreen) {
        element.requestFullScreen();
    } else if(element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if(element.webkitRequestFullScreen) {
        element.webkitRequestFullScreen();
    }
}