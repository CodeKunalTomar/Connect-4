// constants
const WEB_WORKER_URL = 'Connect-4.js';
const BLURBS = {
    'start': {
        header: 'Get Ready',
        blurb: 'Select your Difficulty and Start the Game.'
    },
    'p1-turn': {
        header: 'Your Turn',
        blurb: 'Click on the Board to drop your chip.'
    },
    'p2-turn': {
        header: 'Computer\'s Turn',
        blurb: 'The Computer is trying to find the best way to make you Lose.'
    },
    'p1-win': {
        header: 'You Win',
        blurb: 'You are a winner. Remember this moment. Carry it with you, forever.'
    },
    'p2-win': {
        header: 'Computer Wins',
        blurb: 'Try again and NEVER GIVE UP, remember that.'
    },
    'tie': {
        header: 'Tie',
        blurb: 'Everyone\'s a winner! Or loser. Depends on how you look at it.'
    }
};
const OUTLOOKS = {
    'win-imminent': 'Uh oh, computer is feeling saucy!',
    'loss-imminent': 'Computer is unsure. Now\'s your chance!'
};

// global variables
const worker = new Worker(WEB_WORKER_URL);

// document ready
$(function() {
    $('.start button').on('click', startGame);
    setBlurb('start');
    setOutlook();

    worker.addEventListener('message', function(e) {
        switch(e.data.messageType) {
            case 'reset-done':
                startHumanTurn();
                break;
            case 'human-move-done':
                endHumanTurn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull);
                break;
            case 'progress':
                updateComputerTurn(e.data.col);
                break;
            case 'computer-move-done':
                endComputerTurn(e.data.coords, e.data.isWin, e.data.winningChips, e.data.isBoardFull,
                    e.data.isWinImminent, e.data.isLossImminent);
                break;
        }
    }, false);
});
function setBlurb(key) {
    $('.info h2').text(BLURBS[key].header);
    $('.info .blurb').text(BLURBS[key].blurb);
}

function setOutlook(key) {
    const $outlook = $('.info .outlook');
    if(key) {
        $outlook
            .text(OUTLOOKS[key])
            .show();
    } else {
        $outlook.hide();
    }
}

function startGame() {
    $('.dif').addClass('freeze');
    $('.dif input').prop('disabled', true);
    $('.lit-cells, .chips').empty();

    worker.postMessage({
        messageType: 'reset',
    });
}

function startHumanTurn() {
    setBlurb('p1-turn');
    $('.click-columns div').addClass('hover');

    // if mouse is already over a column, show cursor chip there
    const col = $('.click-columns div:hover').index();
    if(col !== -1) {
        createCursorChip(1, col);
    }

    $('.click-columns')
        .on('mouseenter', function() {
            const col = $('.click-columns div:hover').index();
            createCursorChip(1, col);
        })
        .on('mouseleave', function() {
            destroyCursorChip();
        });

    $('.click-columns div')
        .on('mouseenter', function() {
            const col = $(this).index();
            moveCursorChip(col);
        })
        .on('click', function() {
            $('.click-columns, .click-columns div').off();

            const col = $(this).index();
            worker.postMessage({
                messageType: 'human-move',
                col: col
            });
        });
}

function endHumanTurn(coords, isWin, winningChips, isBoardFull) {
    $('.click-columns div').removeClass('hover');
    if(!coords) {
        // column was full, human goes again
        startHumanTurn();
    } else {
        dropCursorChip(coords.row, function() {
            if(isWin) {
                endGame('p1-win', winningChips);
            } else if(isBoardFull) {
                endGame('tie');
            } else {
                // pass turn to computer
                startComputerTurn();
            }
        });
    }
}

function startComputerTurn() {
    setBlurb('p2-turn');

    // computer's cursor chip starts far left and moves right as it thinks
    createCursorChip(2, 0);

    const maxDepth = parseInt($('input[name=dif-options]:checked').val(), 10) + 1;
    worker.postMessage({
        messageType: 'computer-move',
        maxDepth: maxDepth
    });
}

function updateComputerTurn(col) {
    moveCursorChip(col);
}

function endComputerTurn(coords, isWin, winningChips, isBoardFull, isWinImminent, isLossImminent) {
    moveCursorChip(coords.col, function() {
        dropCursorChip(coords.row, function() {
            if (isWin) {
                endGame('p2-win', winningChips);
            } else if (isBoardFull) {
                endGame('tie');
            } else {
                if(isWinImminent) {
                    setOutlook('win-imminent');
                } else if (isLossImminent) {
                    setOutlook('loss-imminent');
                } else {
                    setOutlook();
                }

                // pass turn to human
                startHumanTurn();
            }
        });
    });
}

function endGame(blurbKey, winningChips) {
    $('.dif').removeClass('freeze');
    $('.dif input').prop('disabled', false);
    setBlurb(blurbKey);
    setOutlook();

    if(winningChips) {
        // not a tie, highlight the chips in the winning run
        for(let i = 0; i < winningChips.length; i++) {
            createLitCell(winningChips[i].col, winningChips[i].row);
        }
    }
}

function createLitCell(col, row) {
    $('<div>')
        .css({
            'left': indexToPixels(col),
            'bottom': indexToPixels(row)
        })
        .appendTo('.lit-cells');
}

function createCursorChip(player, col) {
    const playerClass = 'p' + player;
    $('<div>', { 'class': 'cursor ' + playerClass })
        .css('left', indexToPixels(col))
        .appendTo('.chips');

    // also highlight column
    $('.lit-columns div').eq(col).addClass('lit');
}

function destroyCursorChip() {
    $('.chips .cursor').remove();
    $('.lit-columns .lit').removeClass('lit');
}

function moveCursorChip(col, callback) {
    $('.chips .cursor').css('left', indexToPixels(col));
    $('.lit-columns .lit').removeClass('lit');
    $('.lit-columns div').eq(col).addClass('lit');

    // callback is only used when the computer is about to drop a chip
    // give it a slight delay for visual interest
    setTimeout(callback, 300);
}

function dropCursorChip(row, callback) {
    // speed of animation depends on how far the chip has to drop
    const ms = (7 - row) * 40;
    const duration = (ms / 1000) + 's';

    $('.chips .cursor')
        .removeClass('cursor')
        .css({
            'bottom': indexToPixels(row),
            'transition-duration': duration,
            'animation-delay': duration
        })
        .addClass('dropped');

    $('.lit-columns .lit').removeClass('lit');
    setTimeout(callback, ms);
}

function indexToPixels(index) {
    return (index * 61 + 1) + 'px';
}