'use strict';

let debugmode = true;

let states = Object.freeze({
    SplashScreen: 0,
    GameScreen: 1,
    ScoreScreen: 2
});

let currentstate;

let gravity = 0.25;
let velocity = 0;
let position = 180;
let rotation = 0;
let jump = -4.6;
let flyArea = $("#flyarea").height();

let score = 0;
let highscore = 0;

let pipeheight = 90;
let pipewidth = 52;
let pipes = [];

let replayclickable = false;

//sounds
let volume = 30;
let soundJump = new buzz.sound("assets/sounds/sfx_wing.ogg");
let soundScore = new buzz.sound("assets/sounds/sfx_point.ogg");
let soundHit = new buzz.sound("assets/sounds/sfx_hit.ogg");
let soundDie = new buzz.sound("assets/sounds/sfx_die.ogg");
let soundSwoosh = new buzz.sound("assets/sounds/sfx_swooshing.ogg");
buzz.all().setVolume(volume);

//loops
let loopGameloop;
let loopPipeloop;

$(document).ready(function () {
    if (window.location.search === "?debug")
        debugmode = true;
    if (window.location.search === "?easy")
        pipeheight = 200;

    //get the highscore
    let savedscore = getCookie("highscore");
    if (savedscore !== "") highscore = parseInt(savedscore);

    //start with the splash screen
    showSplash();
});

function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    let d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toGMTString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function showSplash() {
    currentstate = states.SplashScreen;

    //set the defaults (again)
    velocity = 0;
    position = 180;
    rotation = 0;
    score = 0;

    //update the player in preparation for the next game
    $("#player").css({y: 0, x: 0});
    updatePlayer($("#player"));

    soundSwoosh.stop();
    soundSwoosh.play();

    //clear out all the pipes if there are any
    $(".pipe").remove();
    pipes = [];

    //make everything animated again
    $(".animated").css('animation-play-state', 'running');
    $(".animated").css('-webkit-animation-play-state', 'running');

    //fade in the splash
    $("#splash").transition({opacity: 1}, 2000, 'ease');
}

function startGame() {
    currentstate = states.GameScreen;

    //fade out the splash
    $("#splash").stop();
    $("#splash").transition({opacity: 0}, 500, 'ease');

    //update the big score
    setBigScore();

    //debug mode?
    if (debugmode) {
        //show the bounding boxes
        $(".boundingbox").show();
    }

    //start up our loops
    let updaterate = 1000.0 / 60.0; //60 times a second
    loopGameloop = setInterval(gameloop, updaterate);
    loopPipeloop = setInterval(updatePipes, 1400);

    //jump from the start!
    playerJump();
}

function updatePlayer(player) {
    //rotation
    rotation = Math.min((velocity / 10) * 90, 90);

    //apply rotation and position
    $(player).css({rotate: rotation, top: position});
}

function gameloop() {
    console.log('game loop');
    console.log('velocity', velocity);
    let player = $("#player");

    //update the player speed/position
    velocity += gravity;
    position += velocity;

    //update the player
    updatePlayer(player);

    //create the bounding box
    let box = document.getElementById('player').getBoundingClientRect();
    let origwidth = 34.0;
    let origheight = 24.0;

    let boxwidth = origwidth - (Math.sin(Math.abs(rotation) / 90) * 8);
    let boxheight = (origheight + box.height) / 2;
    let boxleft = ((box.width - boxwidth) / 2) + box.left;
    let boxtop = ((box.height - boxheight) / 2) + box.top;
    let boxright = boxleft + boxwidth;
    let boxbottom = boxtop + boxheight;

    //if we're in debug mode, draw the bounding box
    if (debugmode) {
        let boundingbox = $("#playerbox");
        boundingbox.css('left', boxleft);
        boundingbox.css('top', boxtop);
        boundingbox.css('height', boxheight);
        boundingbox.css('width', boxwidth);
    }

    //did we hit the ground?
    if (box.bottom >= $("#land").offset().top) {
        playerDead();
        return;
    }

    //have they tried to escape through the ceiling? :o
    let ceiling = $("#ceiling");
    if (boxtop <= (ceiling.offset().top + ceiling.height()))
        position = 0;

    //we can't go any further without a pipe
    if (!pipes[0])
        return;

    //determine the bounding box of the next pipes inner area
    let nextpipe = pipes[0];
    let nextpipeupper = nextpipe.children(".pipe_upper");

    let pipetop = nextpipeupper.offset().top + nextpipeupper.height();
    let pipeleft = nextpipeupper.offset().left - 2; // for some reason it starts at the inner pipes offset, not the outer pipes.
    let piperight = pipeleft + pipewidth;
    let pipebottom = pipetop + pipeheight;

    if (debugmode) {
        let boundingbox = $("#pipebox");
        boundingbox.css('left', pipeleft);
        boundingbox.css('top', pipetop);
        boundingbox.css('height', pipeheight);
        boundingbox.css('width', pipewidth);
    }

    //have we gotten inside the pipe yet?
    if (boxright > pipeleft) {
        //we're within the pipe, have we passed between upper and lower pipes?
        if (boxtop > pipetop && boxbottom < pipebottom) {
            //yeah! we're within bounds

        }
        else {
            //no! we touched the pipe
            playerDead();
            return;
        }
    }


    //have we passed the imminent danger?
    if (boxleft > piperight) {
        //yes, remove it
        pipes.splice(0, 1);

        //and score a point
        playerScore();
    }
}

//Handle space bar
$(document).keydown(function (e) {
    //space bar!
    if (e.keyCode === 32) {
        //in ScoreScreen, hitting space should click the "replay" button. else it's just a regular spacebar hit
        if (currentstate === states.ScoreScreen)
            $("#replay").click();
        else
            screenClick();
    }
});

//Handle mouse down OR touch start
if ("ontouchstart" in window)
    $(document).on("touchstart", screenClick);
else
    $(document).on("mousedown", screenClick);

function screenClick() {
    if (currentstate === states.GameScreen) {
        playerJump();
    }
    else if (currentstate === states.SplashScreen) {
        startGame();
    }
}

function playerJump() {
    velocity = jump;
    //play jump sound
    soundJump.stop();
    soundJump.play();
}

function setBigScore(erase) {
    let elemscore = $("#bigscore");
    elemscore.empty();

    if (erase)
        return;

    let digits = score.toString().split('');
    for (let i = 0; i < digits.length; i++)
        elemscore.append("<img src='assets/font_big_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setSmallScore() {
    let elemscore = $("#currentscore");
    elemscore.empty();

    let digits = score.toString().split('');
    for (let i = 0; i < digits.length; i++)
        elemscore.append("<img src='assets/font_small_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setHighScore() {
    let elemscore = $("#highscore");
    elemscore.empty();

    let digits = highscore.toString().split('');
    for (let i = 0; i < digits.length; i++)
        elemscore.append("<img src='assets/font_small_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setMedal() {
    let elemmedal = $("#medal");
    elemmedal.empty();

    let medal;

    if (score < 10) {
        //signal that no medal has been won
        return false;
    }

    if (score >= 10)
        medal = "bronze";
    if (score >= 20)
        medal = "silver";
    if (score >= 30)
        medal = "gold";
    if (score >= 40)
        medal = "platinum";

    elemmedal.append('<img src="assets/medal_' + medal + '.png" alt="' + medal + '">');

    //signal that a medal has been won
    return true;
}

function playerDead() {
    //stop animating everything!
    $(".animated").css('animation-play-state', 'paused');
    $(".animated").css('-webkit-animation-play-state', 'paused');

    //drop the bird to the floor
    let playerbottom = $("#player").position().top + $("#player").width(); //we use width because he'll be rotated 90 deg
    let floor = flyArea;
    let movey = Math.max(0, floor - playerbottom);
    $("#player").transition({y: movey + 'px', rotate: 90}, 1000, 'easeInOutCubic');

    //it's time to change states. as of now we're considered ScoreScreen to disable left click/flying
    currentstate = states.ScoreScreen;

    //destroy our gameloops
    clearInterval(loopGameloop);
    clearInterval(loopPipeloop);
    loopGameloop = null;
    loopPipeloop = null;

    //mobile browsers don't support buzz bindOnce event
    if (isIncompatible.any()) {
        //skip right to showing score
        showScore();
    }
    else {
        //play the hit sound (then the dead sound) and then show score
        soundHit.play().bindOnce("ended", function () {
            soundDie.play().bindOnce("ended", function () {
                showScore();
            });
        });
    }
}

function showScore() {
    //unhide us
    $("#scoreboard").css("display", "block");

    //remove the big score
    setBigScore(true);

    //have they beaten their high score?
    if (score > highscore) {
        //yeah!
        highscore = score;
        //save it!
        setCookie("highscore", highscore, 999);
    }

    //update the scoreboard
    setSmallScore();
    setHighScore();
    let wonmedal = setMedal();

    //SWOOSH!
    soundSwoosh.stop();
    soundSwoosh.play();

    //show the scoreboard
    $("#scoreboard").css({y: '40px', opacity: 0}); //move it down so we can slide it up
    $("#replay").css({y: '40px', opacity: 0});
    $("#scoreboard").transition({y: '0px', opacity: 1}, 600, 'ease', function () {
        //When the animation is done, animate in the replay button and SWOOSH!
        soundSwoosh.stop();
        soundSwoosh.play();
        $("#replay").transition({y: '0px', opacity: 1}, 600, 'ease');

        //also animate in the MEDAL! WOO!
        if (wonmedal) {
            $("#medal").css({scale: 2, opacity: 0});
            $("#medal").transition({opacity: 1, scale: 1}, 1200, 'ease');
        }
    });

    //make the replay button clickable
    replayclickable = true;
}

$("#replay").click(function () {
    //make sure we can only click once
    if (!replayclickable)
        return;
    else
        replayclickable = false;
    //SWOOSH!
    soundSwoosh.stop();
    soundSwoosh.play();

    //fade out the scoreboard
    $("#scoreboard").transition({y: '-40px', opacity: 0}, 1000, 'ease', function () {
        //when that's done, display us back to nothing
        $("#scoreboard").css("display", "none");

        //start the game over!
        showSplash();
    });
});

function playerScore() {
    score += 1;
    //play score sound
    soundScore.stop();
    soundScore.play();
    setBigScore();
}

function updatePipes() {
    console.log('updatePipes');
    //Do any pipes need removal?
    $(".pipe").filter(function () {
        return $(this).position().left <= -100;
    }).remove();

    //add a new pipe (top height + bottom height  + pipeheight == flyArea) and put it in our tracker
    let padding = 80;
    let constraint = flyArea - pipeheight - (padding * 2); //double padding (for top and bottom)
    let topheight = Math.floor((Math.random() * constraint) + padding); //add lower padding
    let bottomheight = (flyArea - pipeheight) - topheight;
    let newpipe = $('<div class="pipe animated"><div class="pipe_upper" style="height: ' + topheight + 'px;"></div><div class="pipe_lower" style="height: ' + bottomheight + 'px;"></div></div>');
    $("#flyarea").append(newpipe);

    console.log('topheight', topheight);
    console.log('bottomheight', bottomheight);
    pipes.push(newpipe);
}

let isIncompatible = {
    Android: function () {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function () {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function () {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function () {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Safari: function () {
        return (navigator.userAgent.match(/OS X.*Safari/) && !navigator.userAgent.match(/Chrome/));
    },
    Windows: function () {
        return navigator.userAgent.match(/IEMobile/i);
    },
    any: function () {
        return (isIncompatible.Android() || isIncompatible.BlackBerry() || isIncompatible.iOS() || isIncompatible.Opera() || isIncompatible.Safari() || isIncompatible.Windows());
    }
};