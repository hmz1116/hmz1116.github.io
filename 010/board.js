/*
add dragon:hmz1116
add shield:hmz1116
board.js - Source Code for XiangQi Wizard Light, Part IV

XiangQi Wizard Light - a Chinese Chess Program for JavaScript
Designed by Morning Yellow, Version: 1.0, Last Modified: Sep. 2012
Copyright (C) 2004-2012 www.xqbase.com

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

"use strict";

var RESULT_UNKNOWN = 0;
var RESULT_WIN = 1;
var RESULT_DRAW = 2;
var RESULT_LOSS = 3;

var BOARD_WIDTH = 521;
var BOARD_HEIGHT = 577;
var SQUARE_SIZE = 57;
var SQUARE_LEFT = (BOARD_WIDTH - SQUARE_SIZE * 9) >> 1;
var SQUARE_TOP = (BOARD_HEIGHT - SQUARE_SIZE * 10) >> 1;
var THINKING_SIZE = 32;
var THINKING_LEFT = (BOARD_WIDTH - THINKING_SIZE) >> 1;
var THINKING_TOP = (BOARD_HEIGHT - THINKING_SIZE) >> 1;
var MAX_STEP = 8;
var PIECE_NAME = [
  "oo", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  "rk", "ra", "rb", "rn", "rr", "rc", "rp", "rs", "rd", "rv", "rx", "rf", "rw", "rt", "rz", "ru", "ro", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  "bk", "ba", "bb", "bn", "br", "bc", "bp", "bs", "bd", "bv", "bx", "bf", "bw", "bt", "bz", "bu", "bo", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
];

function SQ_X(sq) {
  return SQUARE_LEFT + (FILE_X(sq) - 3) * SQUARE_SIZE;
}

function SQ_Y(sq) {
  return SQUARE_TOP + (RANK_Y(sq) - 3) * SQUARE_SIZE;
}

function MOVE_PX(src, dst, step) {
  return Math.floor((src * step + dst * (MAX_STEP - step)) / MAX_STEP + .5) + "px";
}

function alertDelay(message) {
  setTimeout(function() {
    alert(message);
  }, 250);
}

function Board(container, images, sounds) {
  this.images = images;
  this.sounds = sounds;
  this.pos = new Position();
  //this.pos.fromFen("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1");
  this.pos.fromFen("rnbakabnr/9/1c5c1/s1p1p1p1s/9/9/S1P1P1P1S/1C5C1/9/RNBAKABNR Xxw - - 0 1");
  this.animated = true;
  this.sound = true;
  this.search = null;
  this.imgSquares = [];
  this.sqSelected = 0;
  this.mvLast = 0;
  this.millis = 0;
  this.computer = -1;
  this.result = RESULT_UNKNOWN;
  this.busy = false;
  this.dragonready = [false,false];
  this.phantomready = [false, false];
  this.pcZready = [false, false];
  this.pcKZready = [false, false];

  var style = container.style;
  style.position = "relative";
  style.width = BOARD_WIDTH + "px";
  style.height = BOARD_HEIGHT + "px";
  style.background = "url(" + images + "dragonboard.jpg)";
  var this_ = this;
  for (var sq = 0; sq < 256; sq ++) {
    if (!IN_BOARD(sq)) {
      this.imgSquares.push(null);
      continue;
    }
    var img = document.createElement("img");
    var style = img.style;
    style.position = "absolute";
    style.left = SQ_X(sq);
    style.top = SQ_Y(sq);
    style.width = SQUARE_SIZE;
    style.height = SQUARE_SIZE;
    style.zIndex = 0;
    img.onmousedown = function(sq_) {
      return function() {
        this_.clickSquare(sq_);
      }
    } (sq);
    container.appendChild(img);
    this.imgSquares.push(img);
  }

  this.thinking = document.createElement("img");
  this.thinking.src = images + "thinking.gif";
  style = this.thinking.style;
  style.visibility = "hidden";
  style.position = "absolute";
  style.left = THINKING_LEFT + "px";
  style.top = THINKING_TOP + "px";
  container.appendChild(this.thinking);

  this.dummy = document.createElement("div");
  this.dummy.style.position = "absolute";
  container.appendChild(this.dummy);

  this.flushBoard();
}

Board.prototype.playSound = function(soundFile) {
  if (!this.sound) {
    return;
  }
  try {
    new Audio(this.sounds + soundFile + ".wav").play();
  } catch (e) {
    this.dummy.innerHTML= "<embed src=\"" + this.sounds + soundFile +
        ".wav\" hidden=\"true\" autostart=\"true\" loop=\"false\" />";
  }
}

Board.prototype.setSearch = function(hashLevel) {
  this.search = hashLevel == 0 ? null : new Search(this.pos, hashLevel);
}

Board.prototype.flipped = function(sq) {
  return this.computer == 0 ? SQUARE_FLIP(sq) : sq;
}

Board.prototype.computerMove = function() {
  return this.pos.sdPlayer == this.computer;
}

Board.prototype.computerLastMove = function() {
  return 1 - this.pos.sdPlayer == this.computer;
}

Board.prototype.addMove = function(mv, computerMove) {
  if (!this.pos.legalMove(mv)) {
    return;
  }
  if (!this.pos.makeMove(mv)) {
    this.playSound("illegal");
    return;
  }
  this.dragonready[0] = false;
  this.dragonready[1] = false;
  this.phantomready[0] = false;
  this.phantomready[1] = false;
  this.pcZready[0] = false;
  this.pcZready[1] = false;
  this.pcKZready[0] = false;
  this.pcKZready[1] = false;
  this.busy = true;
  if (!this.animated) {
    this.postAddMove(mv, computerMove);
    return;
  }
  
  if (SRC(mv) < 48 || DST(mv) < 48) {
    this.postAddMove(mv, computerMove);
    return;
  }
  var sqSrc = this.flipped(SRC(mv));
  var xSrc = SQ_X(sqSrc);
  var ySrc = SQ_Y(sqSrc);
  var sqDst = this.flipped(DST(mv));
  var xDst = SQ_X(sqDst);
  var yDst = SQ_Y(sqDst);
  var style = this.imgSquares[sqSrc].style;
  style.zIndex = 256;
  var step = MAX_STEP - 1;
  var this_ = this;
  var timer = setInterval(function() {
    if (step == 0) {
      clearInterval(timer);
      style.left = xSrc + "px";
      style.top = ySrc + "px";
      style.zIndex = 0;
      this_.postAddMove(mv, computerMove);
    } else {
      style.left = MOVE_PX(xSrc, xDst, step);
      style.top = MOVE_PX(ySrc, yDst, step);
      step --;
    }
  }, 16);
}

/*Board.prototype.postAddMove = function(mv, computerMove) {
  if (this.mvLast > 0) {
    this.drawSquare(SRC(this.mvLast), false);
    this.drawSquare(DST(this.mvLast), false);
  }
  this.drawSquare(SRC(mv), true);
  this.drawSquare(DST(mv), true);
  this.sqSelected = 0;
  this.mvLast = mv;

  if (this.pos.isMate()) {
    this.playSound(computerMove ? "loss" : "win");
    this.result = computerMove ? RESULT_LOSS : RESULT_WIN;

    var pc = SIDE_TAG(this.pos.sdPlayer) + PIECE_KING;
    var sqMate = 0;
    for (var sq = 0; sq < 256; sq ++) {
      if (this.pos.squares[sq] == pc) {
        sqMate = sq;
        break;
      }
    }
    if (!this.animated || sqMate == 0) {
      this.postMate(computerMove);
      return;
    }

    sqMate = this.flipped(sqMate);
    var style = this.imgSquares[sqMate].style;
    style.zIndex = 256;
    var xMate = SQ_X(sqMate);
    var step = MAX_STEP;
    var this_ = this;
    var timer = setInterval(function() {
      if (step == 0) {
        clearInterval(timer);
        style.left = xMate + "px";
        style.zIndex = 0;
        this_.imgSquares[sqMate].src = this_.images +
            (this_.pos.sdPlayer == 0 ? "r" : "b") + "km.gif";
        this_.postMate(computerMove);
      } else {
        style.left = (xMate + ((step & 1) == 0 ? step : -step) * 2) + "px";
        step --;
      }
    }, 50);
    return;
  }

  var vlRep = this.pos.repStatus(3);
  if (vlRep > 0) {
    vlRep = this.pos.repValue(vlRep);
    if (vlRep > -WIN_VALUE && vlRep < WIN_VALUE) {
      this.playSound("draw");
      this.result = RESULT_DRAW;
      alertDelay("双方不变作和，辛苦了！");
    } else if (computerMove == (vlRep < 0)) {
      this.playSound("loss");
      this.result = RESULT_LOSS;
      alertDelay("长打作负，请不要气馁！");
    } else {
      this.playSound("win");
      this.result = RESULT_WIN;
      alertDelay("长打作负，祝贺你取得胜利！");
    }
    this.postAddMove2();
    this.busy = false;
    return;
  }

  if (this.pos.captured()) {
    var hasMaterial = false;
    for (var sq = 0; sq < 256; sq ++) {
      if (IN_BOARD(sq) && (this.pos.squares[sq] & 7) > 2) {
        hasMaterial = true;
        break;
      }
    }
    if (!hasMaterial) {
      this.playSound("draw");
      this.result = RESULT_DRAW;
      alertDelay("双方都没有进攻棋子了，辛苦了！");
      this.postAddMove2();
      this.busy = false;
      return;
    }
  } else if (this.pos.pcList.length > 100) {
    var captured = false;
    for (var i = 2; i <= 100; i ++) {
      if (this.pos.pcList[this.pos.pcList.length - i] > 0) {
        captured = true;
        break;
      }
    }
    if (!captured) {
      this.playSound("draw");
      this.result = RESULT_DRAW;
      alertDelay("超过自然限着作和，辛苦了！");
      this.postAddMove2();
      this.busy = false;
      return;
    }
  }

  if (this.pos.inCheck()) {
    this.playSound(computerMove ? "check2" : "check");
  } else if (this.pos.captured()) {
    this.playSound(computerMove ? "capture2" : "capture");
  } else {
    this.playSound(computerMove ? "move2" : "move");
  }

  this.postAddMove2();
  this.response();
}*/
Board.prototype.postAddMove = function(mv, computerMove) {
  var oldmv = mv;
  var sqSrc = SRC(mv);
  var sqDst = DST(mv);
  var sqDg = 0;
  if(sqDst < 0x10){
    sqDg = DG(sqSrc,sqDst);
    mv = MOVE(sqSrc,sqDg);
  }
  if (this.mvLast > 0) {
    var sqSrcLast = SRC(this.mvLast);
    var sqDstLast = DST(this.mvLast);
    if(sqDstLast < 0x10){
      this.drawSquare(sqSrcLast, false);
      this.drawSquare(DG(sqSrcLast,sqDstLast), false);
    }
    else{
      this.drawSquare(SRC(this.mvLast), false);
      this.drawSquare(DST(this.mvLast), false);
    }
  }
  this.drawSquare(SRC(mv), true);
  this.drawSquare(DST(mv), true);
  this.sqSelected = 0;
  this.mvLast = oldmv;

  if (this.pos.isMate()) {
    this.playSound(computerMove ? "loss" : "win");
    this.result = computerMove ? RESULT_LOSS : RESULT_WIN;

    var pc = SIDE_TAG(this.pos.sdPlayer) + PIECE_KING;
    var sqMate = 0;
    for (var sq = 0; sq < 256; sq ++) {
      if (this.pos.squares[sq] == pc) {
        sqMate = sq;
        break;
      }
    }
    if (!this.animated || sqMate == 0) {
      this.postMate(computerMove);
      return;
    }

    sqMate = this.flipped(sqMate);
    var style = this.imgSquares[sqMate].style;
    style.zIndex = 256;
    var xMate = SQ_X(sqMate);
    var step = MAX_STEP;
    var this_ = this;
    var timer = setInterval(function() {
      if (step == 0) {
        clearInterval(timer);
        style.left = xMate + "px";
        style.zIndex = 0;
        this_.imgSquares[sqMate].src = this_.images +
            (this_.pos.sdPlayer == 0 ? "r" : "b") + "km.gif";
        this_.postMate(computerMove);
      } else {
        style.left = (xMate + ((step & 1) == 0 ? step : -step) * 2) + "px";
        step --;
      }
    }, 50);
    return;
  }

  var vlRep = this.pos.repStatus(3);
  if (vlRep > 0) {
    vlRep = this.pos.repValue(vlRep);
    if (vlRep > -WIN_VALUE && vlRep < WIN_VALUE) {
      this.playSound("draw");
      this.result = RESULT_DRAW;
      alertDelay("双方不变作和，辛苦了！");
    } else if (computerMove == (vlRep < 0)) {
      this.playSound("loss");
      this.result = RESULT_LOSS;
      alertDelay("长打作负，请不要气馁！");
    } else {
      this.playSound("win");
      this.result = RESULT_WIN;
      alertDelay("长打作负，祝贺你取得胜利！");
    }
    this.postAddMove2();
    this.busy = false;
    return;
  }

  if (this.pos.captured()) {
    var hasMaterial = false;
    for (var sq = 0; sq < 256; sq ++) {
      if (IN_BOARD(sq) && (this.pos.squares[sq] & PCNOMAX) > 2) {
        hasMaterial = true;
        break;
      }
    }
    if (!hasMaterial) {
      this.playSound("draw");
      this.result = RESULT_DRAW;
      alertDelay("双方都没有进攻棋子了，辛苦了！");
      this.postAddMove2();
      this.busy = false;
      return;
    }
  } else if (this.pos.pcList.length > 100) {
    var captured = false;
    for (var i = 2; i <= 100; i ++) {
      if (this.pos.pcList[this.pos.pcList.length - i] > 0) {
        captured = true;
        break;
      }
    }
    if (!captured) {
      this.playSound("draw");
      this.result = RESULT_DRAW;
      alertDelay("超过自然限着作和，辛苦了！");
      this.postAddMove2();
      this.busy = false;
      return;
    }
  }

  if (this.pos.inCheck()) {
    this.playSound(computerMove ? "check2" : "check");
  } else if (this.pos.captured()) {
    this.playSound(computerMove ? "capture2" : "capture");
  } else {
    this.playSound(computerMove ? "move2" : "move");
  }

  this.postAddMove2();
  this.response();
}

Board.prototype.postAddMove2 = function() {
  if (typeof this.onAddMove == "function") {
    this.onAddMove();
  }
}

Board.prototype.postMate = function(computerMove) {
  alertDelay(computerMove ? "请再接再厉！" : "祝贺你取得胜利！");
  this.postAddMove2();
  this.busy = false;
}

Board.prototype.response = function() {
  if (this.search == null || !this.computerMove()) {
    this.busy = false;
    return;
  }
  this.thinking.style.visibility = "visible";
  var this_ = this;
  this.busy = true;
  setTimeout(function() {
    this_.addMove(board.search.searchMain(LIMIT_DEPTH, board.millis), true);
    this_.thinking.style.visibility = "hidden";
  }, 250);
}

Board.prototype.useComputerMove = function() {
  if (this.search == null) {
    this.busy = false;
    return;
  }
  this.thinking.style.visibility = "visible";
  var this_ = this;
  this.busy = true;
  setTimeout(function() {
    this_.addMove(board.search.searchMain(LIMIT_DEPTH, board.millis), true);
    this_.thinking.style.visibility = "hidden";
  }, 250);
}

/*Board.prototype.clickSquare = function(sq_) {
  if (this.busy || this.result != RESULT_UNKNOWN) {
    return;
  }
  var sq = this.flipped(sq_);
  var pc = this.pos.squares[sq];
  if ((pc & SIDE_TAG(this.pos.sdPlayer)) != 0) {
    this.playSound("click");
    if (this.mvLast != 0) {
      this.drawSquare(SRC(this.mvLast), false);
      this.drawSquare(DST(this.mvLast), false);
    }
    if (this.sqSelected) {
      this.drawSquare(this.sqSelected, false);
    }
    this.drawSquare(sq, true);
    this.sqSelected = sq;
  } else if (this.sqSelected > 0) {
    this.addMove(MOVE(this.sqSelected, sq), false);
  }
}*/
Board.prototype.clickSquare = function(sq_) {
  if (this.busy || this.result != RESULT_UNKNOWN) {
    return;
  }
  var sq = this.flipped(sq_);
  var pc = this.pos.squares[sq];
  var sd = this.pos.sdPlayer;
  if ((pc & SIDE_TAG(this.pos.sdPlayer)) != 0 && !this.phantomready[sd]) {
    this.playSound("click");
    if (this.mvLast != 0) {
      var sqSrcLast = SRC(this.mvLast);
      var sqDstLast = DST(this.mvLast);
      if(sqDstLast < 0x10){
        this.drawSquare(sqSrcLast, false);
        this.drawSquare(DG(sqSrcLast,sqDstLast), false);
      }
      else{
        this.drawSquare(SRC(this.mvLast), false);
        this.drawSquare(DST(this.mvLast), false);
      }
    }
    if (this.sqSelected) {
      this.drawSquare(this.sqSelected, false);
    }
    if(this.sqSelected == sq){
      if((pc & PCNOMAX) == 0){
        if(this.pcKZready[sd]){
          this.pcKZready[sd] = false;
        }
        else if(this.dragonready[sd]){
          this.dragonready[sd] = false;
          this.pcKZready[sd] = this.pos.bStealth(sd);
        }
        else{
          this.dragonready[sd] = this.pos.bDragon(sd);
          if(!this.dragonready[sd])this.pcKZready[sd] = this.pos.bStealth(sd);
        }
      }
      else if ((pc & PCNOMAX) == 11) {
          this.phantomready[sd] = !this.phantomready[sd];
      }
      else if ((pc & PCNOMAX) == 14) {
          this.pcZready[sd] = !this.pcZready[sd];
      }
    }
    this.drawSquare(sq, true);
    this.sqSelected = sq;
  }
  else if ((pc & SIDE_TAG(this.pos.sdPlayer)) != 0 && this.phantomready[sd]) {
    if (this.sqSelected == sq) {
      this.phantomready[sd] = !this.phantomready[sd];
      this.drawSquare(sq, true);
      this.sqSelected = sq;
    }
    else{
      this.addMove(MOVE(this.sqSelected, sq), false);
    }
  }
  else if (this.sqSelected > 0) {
    if(this.dragonready[sd] && (this.pos.squares[this.sqSelected] & PCNOMAX) == 0){
      var sqdg = 0;
      switch(sq-this.sqSelected){
        case 16:
          sqdg = 2;
          break;
        case -1:
          sqdg = 4;
          break;
        case 1:
          sqdg = 6;
          break;
        case -16:
          sqdg = 8;
          break;
        default:
          sqdg = 0;
      }
      this.addMove(MOVE(this.sqSelected, sqdg), false);
    }
    else if(this.pcKZready[sd] && (this.pos.squares[this.sqSelected] & PCNOMAX) == 0){
      for(var i = 16; i < 20; i++){
        if((this.pos.squares[i] & SIDE_TAG(this.pos.sdPlayer)) != 0){
          this.addMove(MOVE(i, sq), false);
          break;
        }
      }
    }
    else if(this.pcZready[sd] && (this.pos.squares[this.sqSelected] & PCNOMAX) == 14){
      for(var i = 16; i < 20; i++){
        if(this.pos.squares[i] == 0){
          this.addMove(MOVE(this.sqSelected, i), false);
          break;
        }
      }
    }
    else{
      this.addMove(MOVE(this.sqSelected, sq), false);
    }
  }
}

/*Board.prototype.drawSquare = function(sq, selected) {
  var img = this.imgSquares[this.flipped(sq)];
  img.src = this.images + PIECE_NAME[this.pos.squares[sq]] + ".gif";
  img.style.backgroundImage = selected ? "url(" + this.images + "oos.gif)" : "";
}*/
Board.prototype.drawSquare = function(sq, selected) {
  if(sq < 48)return;
  var img = this.imgSquares[this.flipped(sq)];
  var pn = PIECE_NAME[this.pos.squares[sq]];
  //img.src = this.images + PIECE_NAME[this.pos.squares[sq]] + ".gif";
  if(this.dragonready[0] && pn == "rk"){
    img.src = this.images + "rkd" + ".gif";
  }
  else if(this.dragonready[1] && pn == "bk"){
    img.src = this.images + "bkd" + ".gif";
  }
  else if(this.pcKZready[0] && pn == "rk"){
    img.src = this.images + "rkz" + ".gif";
  }
  else if(this.pcKZready[1] && pn == "bk"){
    img.src = this.images + "bkz" + ".gif";
  }
  else if(this.phantomready[0] && pn == "rf"){
    img.src = this.images + "rfR" + ".gif";
  }
  else if(this.phantomready[1] && pn == "bf"){
    img.src = this.images + "bfR" + ".gif";
  }
  else if(this.pcZready[0] && pn == "rz"){
    img.src = this.images + "rzR" + ".gif";
  }
  else if(this.pcZready[1] && pn == "bz"){
    img.src = this.images + "bzR" + ".gif";
  }
  else{
    img.src = this.images + PIECE_NAME[this.pos.squares[sq]] + ".gif";
  }
  img.style.backgroundImage = selected ? "url(" + this.images + "oos.gif)" : "";
}

/*Board.prototype.flushBoard = function() {
  this.mvLast = this.pos.mvList[this.pos.mvList.length - 1];
  for (var sq = 0; sq < 256; sq ++) {
    if (IN_BOARD(sq)) {
      this.drawSquare(sq, sq == SRC(this.mvLast) || sq == DST(this.mvLast));
    }
  }
}*/
Board.prototype.flushBoard = function() {
  this.mvLast = this.pos.mvList[this.pos.mvList.length - 1];
  var mv = this.mvLast;
  var sqSrc = SRC(mv);
  var sqDst = DST(mv);
  var sqDg = 0;
  if(sqDst < 0x10){
    sqDg = DG(sqSrc,sqDst);
  }
  for (var sq = 0; sq < 256; sq ++) {
    if (IN_BOARD(sq)) {
      //this.drawSquare(sq, sq == SRC(this.mvLast) || sq == DST(this.mvLast));
      this.drawSquare(sq, sq == sqSrc || sq == sqDg);
    }
  }
}

Board.prototype.restart = function(fen) {
  if (this.busy) {
    return;
  }
  this.dragonready[0] = false;
  this.dragonready[1] = false;
  this.phantomready[0] = false;
  this.phantomready[1] = false;
  this.pcZready[0] = false;
  this.pcZready[1] = false;
  this.pcKZready[0] = false;
  this.pcKZready[1] = false;
  this.pos.lastmovepc[1-this.pos.sdPlayer] = PIECE_WIZARD;
  this.pos.lastmovepc[this.pos.sdPlayer] = PIECE_WIZARD;
  this.result = RESULT_UNKNOWN;
  this.pos.fromFen(fen);
  this.flushBoard();
  this.playSound("newgame");
  this.response();
}

Board.prototype.retract = function() {
  if (this.busy) {
    return;
  }
  this.result = RESULT_UNKNOWN;
  if (this.pos.mvList.length > 1) {
    this.pos.undoMakeMove();
  }
  if (this.pos.mvList.length > 1 && this.computerMove()) {
    this.pos.undoMakeMove();
  }
  this.flushBoard();
  this.response();
}

Board.prototype.setSound = function(sound) {
  this.sound = sound;
  if (sound) {
    this.playSound("click");
  }
}