// ==UserScript==
// @name         Spotify Genius Lyrics
// @description  Show lyrics from genius.com on the Spotify web player
// @namespace    https://greasyfork.org/users/20068
// @license      GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @copyright    2019, cuzi (https://github.com/cvzi)
// @supportURL   https://github.com/cvzi/Spotify-Genius-Lyrics-userscript/issues
// @version      13
// @require      https://github.com/cvzi/GeniusLyricsUserscriptLibrary/raw/master/GeniusLyrics.js
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @connect      genius.com
// @include      https://open.spotify.com/*
// ==/UserScript==

/* global genius, geniusLyrics, unsafeWindow, GM */ // eslint-disable-line no-unused-vars

'use strict'

const scriptName = 'SpotifyGeniusScript'
var resizeLeftContainer
var resizeContainer
var optionCurrentSize = 30.0
GM.getValue('optioncurrentsize', optionCurrentSize).then(function (value) {
  optionCurrentSize = value
})

function setFrameDimensions (container, iframe, bar) {
  iframe.style.width = container.clientWidth - 1 + 'px'
  iframe.style.height = (document.querySelector('.Root__nav-bar .navBar').clientHeight + document.querySelector('.now-playing-bar ').clientHeight - bar.clientHeight) + 'px'
}

function onResize () {
  const iframe = document.getElementById('lyricsiframe')
  if (iframe) {
    iframe.style.width = document.getElementById('lyricscontainer').clientWidth - 1 + 'px'
    iframe.style.height = (document.querySelector('.Root__nav-bar .navBar').clientHeight + document.querySelector('.now-playing-bar ').clientHeight - document.querySelector('.lyricsnavbar').clientHeight) + 'px'
  }
}
function initResize () {
  window.addEventListener('mousemove', onMouseMoveResize)
  window.addEventListener('mouseup', stopResize)
  window.removeEventListener('resize', onResize)
}
function onMouseMoveResize (e) {
  optionCurrentSize = 100 - (e.clientX / document.body.clientWidth * 100)
  resizeLeftContainer.style.width = (100 - optionCurrentSize) + '%'
  resizeContainer.style.width = optionCurrentSize + '%'
}
function stopResize () {
  window.removeEventListener('mousemove', onMouseMoveResize)
  window.removeEventListener('mouseup', stopResize)
  window.addEventListener('resize', onResize)
  onResize()
  GM.setValue('optioncurrentsize', optionCurrentSize)
}
function getCleanLyricsContainer () {
  document.querySelectorAll('.loadingspinner').forEach((spinner) => spinner.remove())

  const topContainer = document.querySelector('.Root__top-container')
  if (!document.getElementById('lyricscontainer')) {
    topContainer.style.width = (100 - optionCurrentSize) + '%'
    topContainer.style.float = 'left'
    resizeContainer = document.createElement('div')
    resizeContainer.id = 'lyricscontainer'
    resizeContainer.style = 'min-height: 100%; width: ' + optionCurrentSize + '%; position: relative; z-index: 1; float:left'
    topContainer.parentNode.insertBefore(resizeContainer, topContainer.nextSibling)
  } else {
    resizeContainer = document.getElementById('lyricscontainer')
    resizeContainer.innerHTML = ''
    topContainer.parentNode.insertBefore(resizeContainer, topContainer.nextSibling)
  }
  resizeLeftContainer = topContainer

  return document.getElementById('lyricscontainer')
}

function hideLyrics () {
  document.querySelectorAll('.loadingspinner').forEach((spinner) => spinner.remove())
  if (document.getElementById('lyricscontainer')) {
    document.getElementById('lyricscontainer').parentNode.removeChild(document.getElementById('lyricscontainer'))
    const topContainer = document.querySelector('.Root__top-container')
    topContainer.style.width = '100%'
    topContainer.style.removeProperty('float')
  }
  addLyricsButton()
}

function listSongs (hits, container, query) {
  if (!container) {
    container = getCleanLyricsContainer()
  }

  // Back to search button
  const backToSearchButton = document.createElement('a')
  backToSearchButton.href = '#'
  backToSearchButton.appendChild(document.createTextNode('Back to search'))
  backToSearchButton.addEventListener('click', function backToSearchButtonClick (ev) {
    ev.preventDefault()
    if (query) {
      showSearchField(query)
    } else if (genius.current.artists) {
      showSearchField(genius.current.artists + ' ' + genius.current.title)
    } else {
      showSearchField()
    }
  })

  const separator = document.createElement('span')
  separator.setAttribute('class', 'second-line-separator')
  separator.setAttribute('style', 'padding:0px 3px')
  separator.appendChild(document.createTextNode('•'))

  // Hide button
  const hideButton = document.createElement('a')
  hideButton.href = '#'
  hideButton.appendChild(document.createTextNode('Hide'))
  hideButton.addEventListener('click', function hideButtonClick (ev) {
    ev.preventDefault()
    hideLyrics()
  })

  // List search results
  const trackhtml = '<div class="tracklist-col position-outer"><div class="tracklist-play-pause tracklist-top-align"><span style="color:silver;font-size:2.0em">🅖</span></div><div class="position tracklist-top-align"><span style="font-size:1.5em">📄</span></div></div><div class="tracklist-col name"><div class="track-name-wrapper tracklist-top-align"><div class="tracklist-name ellipsis-one-line" dir="auto">$title</div><div class="second-line"><span class="TrackListRow__explicit-label">$lyrics_state</span><span class="ellipsis-one-line" dir="auto"><a tabindex="-1" class="tracklist-row__artist-name-link" href="#">$artist</a></span><span class="second-line-separator" aria-label="in album">•</span><span class="ellipsis-one-line" dir="auto"><a tabindex="-1" class="tracklist-row__album-name-link" href="#">👁 <span style="font-size:0.8em">$stats.pageviews</span></a></span></div></div></div>'
  container.innerHTML = '<section class="tracklist-container"><ol class="tracklist" style="width:99%"></ol></section>'

  container.insertBefore(hideButton, container.firstChild)
  container.insertBefore(separator, container.firstChild)
  container.insertBefore(backToSearchButton, container.firstChild)

  const ol = container.querySelector('ol.tracklist')
  const searchresultsLengths = hits.length
  const title = genius.current.title
  const artists = genius.current.artists
  const onclick = function onclick () {
    genius.f.rememberLyricsSelection(title, artists, this.dataset.hit)
    genius.f.showLyrics(JSON.parse(this.dataset.hit), searchresultsLengths)
  }
  hits.forEach(function forEachHit (hit) {
    const li = document.createElement('li')
    li.setAttribute('class', 'tracklist-row')
    li.setAttribute('role', 'button')
    li.innerHTML = trackhtml.replace(/\$title/g, hit.result.title_with_featured).replace(/\$artist/g, hit.result.primary_artist.name).replace(/\$lyrics_state/g, hit.result.lyrics_state).replace(/\$stats\.pageviews/g, 'pageviews' in hit.result.stats ? genius.f.metricPrefix(hit.result.stats.pageviews, 1) : ' - ')
    li.dataset.hit = JSON.stringify(hit)

    li.addEventListener('click', onclick)
    ol.appendChild(li)
  })
}

function addLyrics (force, beLessSpecific) {
  let songTitle = document.querySelector('a[data-testid="nowplaying-track-link"]').innerText
  const feat = songTitle.indexOf(' (feat')
  if (feat !== -1) {
    songTitle = songTitle.substring(0, feat).trim()
  }
  const musicIsPlaying = document.querySelector('.now-playing-bar .player-controls__buttons .control-button.control-button--circled').className.toLowerCase().indexOf('pause') !== -1
  const songArtistsArr = []
  document.querySelectorAll('.Root__now-playing-bar .now-playing .ellipsis-one-line a[href^="/artist/"]').forEach((e) => songArtistsArr.push(e.innerText))

  genius.f.loadLyrics(force, beLessSpecific, songTitle, songArtistsArr, musicIsPlaying)
}

function showSearchField (query) {
  const b = getCleanLyricsContainer()
  const div = b.appendChild(document.createElement('div'))
  div.style = 'padding:5px'
  div.appendChild(document.createTextNode('Search genius.com: '))
  div.appendChild(document.createElement('br'))
  div.style.paddingRight = '15px'
  const input = div.appendChild(document.createElement('input'))
  input.style = 'width:92%;border:0;border-radius:500px;padding:8px 5px 8px 25px;text-overflow:ellipsis'
  input.placeholder = 'Search genius.com...'
  if (query) {
    input.value = query
  } else if (genius.current.artists) {
    input.value = genius.current.artists
  }
  input.addEventListener('change', function onSearchLyricsButtonClick () {
    this.style.color = 'black'
    if (input.value) {
      genius.f.searchByQuery(input.value, b)
    }
  })
  input.addEventListener('keyup', function onSearchLyricsKeyUp (ev) {
    this.style.color = 'black'
    if (ev.keyCode === 13) {
      ev.preventDefault()
      if (input.value) {
        genius.f.searchByQuery(input.value, b)
      }
    }
  })
  input.focus()
  const mag = div.appendChild(document.createElement('div'))
  mag.style.marginTop = '-27px'
  mag.style.marginLeft = '3px'
  mag.appendChild(document.createTextNode('🔎'))
}

function addLyricsButton () {
  if (document.getElementById('showlyricsbutton')) {
    return
  }
  const b = document.createElement('div')
  b.setAttribute('id', 'showlyricsbutton')
  b.setAttribute('style', 'position:absolute; top: 0px; right:0px; color:#ffff64; cursor:pointer')
  b.setAttribute('title', 'Load lyrics from genius.com')
  b.appendChild(document.createTextNode('🅖'))
  b.addEventListener('click', function onShowLyricsButtonClick () {
    genius.option.autoShow = true // Temporarily enable showing lyrics automatically on song change
    genius.iv.main = window.setInterval(main, 2000)
    addLyrics(true)
  })
  document.body.appendChild(b)
}

function addCss () {
  document.head.appendChild(document.createElement('style')).innerHTML = `
  .lyricsiframe {
    opacity:0.1;
    transition:opacity 2s;
    margin:0px;
    padding:0px;
  }
  .loadingspinnerholder {
    position:absolute;
    top:100px;
    left:100px;
    cursor:progress
  }
  .lyricsnavbar span,.lyricsnavbar a:link,.lyricsnavbar a:visited {
    color: rgb(179, 179, 179);
    text-decoration:none;
    transition:color 400ms;
  }
  .lyricsnavbar a:hover,.lyricsnavbar span:hover {
    color:white;
    text-decoration:none;
  }`
}

function main () {
  if (document.querySelector('.now-playing')) {
    if (genius.option.autoShow) {
      addLyrics()
    } else {
      addLyricsButton()
    }
  }
}

const genius = geniusLyrics({
  GM: GM,
  scriptName: scriptName,
  scriptIssuesURL: 'https://github.com/cvzi/Spotify-Genius-Lyrics-userscript/issues',
  scriptIssuesTitle: 'Report problem: github.com/cvzi/Spotify-Genius-Lyrics-userscript/issues',
  domain: 'https://open.spotify.com',
  emptyURL: 'https://open.spotify.com/robots.txt',
  main: main,
  addCss: addCss,
  listSongs: listSongs,
  showSearchField: showSearchField,
  addLyrics: addLyrics,
  hideLyrics: hideLyrics,
  getCleanLyricsContainer: getCleanLyricsContainer,
  setFrameDimensions: setFrameDimensions,
  initResize: initResize,
  onResize: onResize
})
