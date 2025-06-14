// ==UserScript==
// @name            Spotify Genius Lyrics
// @description     Shows lyrics from genius.com on the Spotify web player
// @description:es  Mostra la letra de genius.com de las canciones en el reproductor web de Spotify
// @description:de  Zeigt den Songtext von genius.com im Spotify-Webplayer an
// @description:fr  Présente les paroles de chansons de genius.com sur Spotify
// @description:pl  Pokazuje teksty piosenek z genius.com na Spotify
// @description:pt  Mostra letras de genius.com no Spotify
// @description:it  Mostra i testi delle canzoni di genius.com su Spotify
// @description:ja  スクリプトは、Spotify (スポティファイ)上の genius.com から歌詞を表示します
// @namespace       https://greasyfork.org/users/20068
// @license         GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @copyright       2020, cuzi (https://github.com/cvzi)
// @supportURL      https://github.com/cvzi/Spotify-Genius-Lyrics-userscript/issues
// @icon            https://avatars.githubusercontent.com/u/251374?s=200&v=4
// @version         23.6.15
// @require         https://greasyfork.org/scripts/406698-geniuslyrics/code/GeniusLyrics.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js
// @grant           GM.xmlHttpRequest
// @grant           GM.setValue
// @grant           GM.getValue
// @grant           GM.registerMenuCommand
// @grant           GM_openInTab
// @connect         genius.com
// @match           https://open.spotify.com/*
// @match           https://genius.com/songs/new
// @sandbox         JavaScript
// ==/UserScript==

/*
    Copyright (C) 2020 cuzi (cuzi@openmail.cc)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/* global genius, geniusLyrics, unsafeWindow, GM, GM_openInTab, KeyboardEvent */ // eslint-disable-line no-unused-vars
/* jshint asi: true, esversion: 8 */

'use strict'

const scriptName = 'Spotify Genius Lyrics'
let genius
let resizeLeftContainer
let resizeContainer
let optionCurrentSize = 30.0
GM.getValue('optioncurrentsize', optionCurrentSize).then(function (value) {
  optionCurrentSize = value
})

function setFrameDimensions (container, iframe, bar) {
  iframe.style.width = container.clientWidth - 6 + 'px'
  iframe.style.height = document.documentElement.clientHeight - bar.clientHeight - 15 + 'px'
}

function onResize () {
  const iframe = document.getElementById('lyricsiframe')
  if (iframe) {
    setFrameDimensions(document.getElementById('lyricscontainer'), document.getElementById('lyricsiframe'), document.querySelector('.lyricsnavbar'))
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

  const topContainer = document.querySelector('div.Root')
  if (!document.getElementById('lyricscontainer')) {
    topContainer.style.width = (100 - optionCurrentSize) + '%'
    topContainer.style.float = 'left'
    if (topContainer.style.getPropertyValue('--panel-gap')) {
      topContainer.style.marginRight = '-' + topContainer.style.getPropertyValue('--panel-gap')
    }
    resizeContainer = document.createElement('div')
    resizeContainer.id = 'lyricscontainer'
    resizeContainer.style = 'min-height: 100%; width: ' + optionCurrentSize + '%; position: relative; z-index: 1; float:left;background:black'
    topContainer.parentNode.insertBefore(resizeContainer, topContainer.nextSibling)
  } else {
    resizeContainer = document.getElementById('lyricscontainer')
    resizeContainer.innerHTML = ''
    topContainer.parentNode.insertBefore(resizeContainer, topContainer.nextSibling)
  }
  resizeLeftContainer = topContainer
  resizeContainer.style.zIndex = 10

  return document.getElementById('lyricscontainer')
}

function onNewSongPlaying () {
  genius.f.closeModalUIs()
}

async function onNoResults (songTitle, songArtistsArr) {
  const showSpotifyLyricsEnabled = await GM.getValue('show_spotify_lyrics', true)
  const submitSpotifyLyricsIgnored = JSON.parse(await GM.getValue('submit_spotify_lyrics_ignore', '[]'))

  const key = songTitle + ' - ' + songArtistsArr.join(', ')
  if (submitSpotifyLyricsIgnored.indexOf(key) !== -1) {
    // User has previously clicked "Cancel" on the confirm dialog for this song
    console.debug('onNoResults() Key "' + key + '" is ignored')
    return
  }

  if (showSpotifyLyricsEnabled && document.querySelector('[data-testid="lyrics-button"]')) {
    openAndAskToSubmitSpotifyLyrics(songTitle, songArtistsArr, false)
  }
}

async function openAndAskToSubmitSpotifyLyrics (songTitle, songArtistsArr, forceSubmit = false) {
  const submitSpotifyLyricsEnabled = forceSubmit || (await GM.getValue('submit_spotify_lyrics', true))
  const key = songTitle + ' - ' + songArtistsArr.join(', ')

  // Open lyrics if they are not already open
  if (!document.querySelector('[data-testid="fullscreen-lyric"]')) {
    document.querySelector('[data-testid="lyrics-button"]').click()
  }
  // Wait one second for lyrics to open
  window.setTimeout(async function () {
    const lyrics = Array.from(document.querySelectorAll('[data-testid="fullscreen-lyric"]')).map(div => div.textContent).join('\n')

    // Close lyrics again, if there are no lyrics
    if (document.querySelectorAll('[data-testid="fullscreen-lyric"]').length === 0) {
      console.debug('Closing lyrics-view, because Spotify has no lyrics either.')
      document.querySelector('[data-testid="lyrics-button"]').click()
      return
    }

    // Check if the lyrics are behind a premium modal overlay
    for (let p = document.querySelector('[data-testid="fullscreen-lyric"]'); p && p.parentElement; p = p.parentElement) {
      if (p.tagName === 'MAIN') {
        if (p.querySelector('button span')) {
          console.debug('Lyrics are behind paywall, abort submit to genius.')
          improveLyricsPaywall()
          return
        }
        break
      }
    }

    if (submitSpotifyLyricsEnabled && lyrics && lyrics.trim()) {
      // Add this song to the ignored list so we don't ask again
      GM.getValue('submit_spotify_lyrics_ignore', '[]').then(async function (s) {
        const arr = JSON.parse(s)
        arr.push(key)
        await GM.setValue('submit_spotify_lyrics_ignore', JSON.stringify(arr))
      })
      // Ask user if they want to submit the lyrics
      genius.f.closeModalUIs()
      if (forceSubmit || (await genius.f.modalConfirm(`Genius.com doesn't have the lyrics for this song but Spotify has the lyrics. Would you like to submit the lyrics from Spotify to Genius.com?\n(You need a Genius.com account to do this)\n${songTitle} by ${songArtistsArr.join(', ')}`))) {
        submitLyricsToGenius(songTitle, songArtistsArr, lyrics)
      } else {
        // Once (globally) show the suggestion to disable this feature
        GM.getValue('suggest_to_disable_submit_spotify_lyrics', true).then(async function (suggestToDisable) {
          if (suggestToDisable) {
            genius.f.modalAlert('You can disable this suggestion in the options of the script.')
            GM.setValue('suggest_to_disable_submit_spotify_lyrics', false)
          }
        })
      }
    }
  }, 1000)
}

function improveLyricsPaywall () {
  if (!document.querySelector('[data-testid="fullscreen-lyric"]')) {
    return
  }
  let main
  for (let p = document.querySelector('[data-testid="fullscreen-lyric"]'); p && p.parentElement; p = p.parentElement) {
    if (p.tagName === 'MAIN') {
      if (p.querySelector('button span')) {
        main = p
        break
      } else {
        return
      }
    }
  }
  const modal = main.querySelector('button span').parentNode.parentNode.parentNode
  modal.style.width = '50%'
  modal.style.height = '30%'
  modal.style.top = 'auto'
  modal.style.bottom = 0
  modal.style.left = 'auto'
  modal.style.right = 0
  const lyricsHolder = document.querySelector('[data-testid="fullscreen-lyric"]').parentNode
  const style = window.getComputedStyle(document.querySelector('[data-testid="fullscreen-lyric"]').firstElementChild, null)
  lyricsHolder.className = ''
  lyricsHolder.style.fontSize = style.fontSize
  lyricsHolder.style.fontWeight = style.fontWeight
  lyricsHolder.style.color = style.color
}

function submitLyricsFromMenu () {
  genius.f.closeModalUIs()

  const [ret, songTitle, songArtistsArr] = getSongTitleAndArtist()
  if (ret < 0) return

  if (songTitle && document.querySelector('[data-testid="lyrics-button"]')) {
    openAndAskToSubmitSpotifyLyrics(songTitle, songArtistsArr, true)
  } else {
    genius.f.modalAlert('Spotify lyrics are not available for this song.')
  }
}

function submitLyricsToGenius (songTitle, songArtistsArr, lyrics) {
  GM.setValue('submitToGenius', JSON.stringify({
    lyrics,
    songTitle,
    songArtistsArr
  })).then(function () {
    GM_openInTab('https://genius.com/songs/new', { active: true })
  })
}

async function fillGeniusForm () {
  const data = JSON.parse(await GM.getValue('submitToGenius', '{}'))
  await GM.setValue('submitToGenius', '{}')
  if ('lyrics' in data && 'songTitle' in data && 'songArtistsArr' in data) {
    document.getElementById('song_primary_artists__name').value = data.songArtistsArr.join(', ')
    document.getElementById('song_title').value = data.songTitle
    document.getElementById('song_lyrics').value = data.lyrics

    // Create keyup event on song name, to generate the warning about duplicates
    const evt = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'e', char: 'e' })
    document.getElementById('song_primary_artists__name').dispatchEvent(evt)
    document.getElementById('song_title').dispatchEvent(evt)
  }
}

function hideLyrics () {
  addLyricsButton()
  document.querySelectorAll('.loadingspinner').forEach((spinner) => spinner.remove())
  if (document.getElementById('lyricscontainer')) {
    document.getElementById('lyricscontainer').parentNode.removeChild(document.getElementById('lyricscontainer'))
    const topContainer = document.querySelector('div.Root')
    topContainer.style.width = '100%'
    topContainer.style.removeProperty('float')
  }
}

function listSongs (hits, container, query) {
  if (!container) {
    container = getCleanLyricsContainer()
  }
  container.style.backgroundColor = 'rgba(0,0,0,.8)'

  // Back to search button
  const backToSearchButton = document.createElement('a')
  backToSearchButton.href = '#'
  backToSearchButton.appendChild(document.createTextNode('Back to search'))
  backToSearchButton.addEventListener('click', function backToSearchButtonClick (ev) {
    ev.preventDefault()
    if (query) {
      showSearchField(query)
    } else if (genius.current.compoundTitle) {
      showSearchField(genius.current.compoundTitle.replace('\t', ' '))
    } else if (genius.current.artists && genius.current.title) {
      showSearchField(genius.current.artists + ' ' + genius.current.title)
    } else if (genius.current.artists) {
      showSearchField(genius.current.artists)
    } else {
      showSearchField()
    }
  })

  const separator = document.createElement('span')
  separator.setAttribute('class', 'second-line-separator')
  separator.setAttribute('style', 'padding:0px 10px')

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
  const trackhtml = `
<div class="geniushiticon">
  <div class="geniushiticonout">
    <span style="color:silver;font-size:2.0em">🅖</span>
  </div>
  <div class="geniushiticonover">
    <span style="opacity:0.7;font-size:1.5em">📄</span>
  </div>
</div>
<div class="geniushitname">
  <div class="track-name-wrapper tracklist-top-align">
    <div class="tracklist-name ellipsis-one-line" dir="auto">$title</div>
    <div class="second-line">
      <span class="ellipsis-one-line" dir="auto">$artist</span>
      <span class="second-line-separator" aria-label="in album">•</span>
      <span class="ellipsis-one-line" dir="auto">👁 <span style="font-size:0.8em">$stats.pageviews</span></span>
      <span class="second-line-separator" aria-label="in album">•</span>
      <span class="geniusbadge">$lyrics_state</span>
    </div>
  </div>
</div>`
  container.innerHTML = '<section class="tracklist-container"><ol class="tracklist geniushits" style="width:99%"></ol></section>'

  container.insertBefore(hideButton, container.firstChild)
  container.insertBefore(separator, container.firstChild)
  container.insertBefore(backToSearchButton, container.firstChild)

  const ol = container.querySelector('ol.tracklist')
  const searchresultsLengths = hits.length
  const compoundTitle = genius.current.compoundTitle
  const onclick = function onclick () {
    genius.f.rememberLyricsSelection(compoundTitle, null, this.dataset.hit)
    genius.f.showLyrics(JSON.parse(this.dataset.hit), searchresultsLengths)
  }
  hits.forEach(function forEachHit (hit) {
    const li = ol.appendChild(document.createElement('li'))
    li.setAttribute('class', 'tracklist-row')
    li.setAttribute('role', 'button')
    li.innerHTML = trackhtml.replace(/\$title/g, hit.result.title_with_featured).replace(/\$artist/g, hit.result.primary_artist.name).replace(/\$lyrics_state/g, hit.result.lyrics_state).replace(/\$stats\.pageviews/g, 'pageviews' in hit.result.stats ? genius.f.metricPrefix(hit.result.stats.pageviews, 1) : ' - ')
    li.dataset.hit = JSON.stringify(hit)

    li.addEventListener('click', onclick)

    const geniushitname = li.querySelector('.geniushitname')

    const widthDiff = geniushitname.clientWidth - (li.clientWidth - 30)
    if (widthDiff > 0) {
      geniushitname.style.width = (li.clientWidth - 30) + 'px'
      geniushitname.classList.add('runningtext')
      if (geniushitname.querySelector('.tracklist-name')) {
        const animationTime = Math.ceil(Math.max(3, widthDiff / 100))
        geniushitname.querySelector('.tracklist-name').style.animation = `${animationTime}s linear 1s infinite normal runtext`
      }
    }
  })
  if (hits.length === 0) {
    const li = ol.appendChild(document.createElement('li'))
    li.style.fontSize = 'larger'
    li.innerHTML = 'No results found'
  }
}

const songTitleQuery = '.Root [data-testid="now-playing-bar"] .standalone-ellipsis-one-line a[href*="/album/"],[data-testid="context-item-info-title"] a[href*="/album/"],[data-testid="context-item-info-title"] a[href*="/track/"]'
const songArtistsQuery = '.Root [data-testid="now-playing-bar"] .standalone-ellipsis-one-line a[href*="/artist/"],a[data-testid="context-item-info-artist"][href*="/artist/"],[data-testid="context-item-info-artist"] a[href*="/artist/"]'

function getSongTitleAndArtist () {
  const songTitleDOM = document.querySelector(songTitleQuery)
  if (!songTitleDOM) {
    console.warn('The song title element is not found.')
    return [-1]
  }
  const songTitle = genius.f.cleanUpSongTitle(songTitleDOM.textContent)
  if (!songTitle) {
    console.warn('The song title is empty.')
    return [-2]
  }
  const songArtistsArr = []
  const ArtistLinks = document.querySelectorAll(songArtistsQuery)
  for (const e of ArtistLinks) {
    songArtistsArr.push(e.textContent)
  }

  return [0, songTitle, songArtistsArr]
}

function addLyrics (force, beLessSpecific) {
  let musicIsPlaying = false
  const buttons = document.querySelectorAll('.Root button[data-testid="control-button-playpause"]')
  if (buttons.length) {
    buttons.forEach(function (button) {
      if (button.getAttribute('aria-label') === 'Pause' ||
          button.innerHTML.indexOf('M3 2h3v12H3zM10 2h3v12h-3z') !== -1 ||
          button.innerHTML.indexOf('M3 2h3v12H3zm7 0h3v12h-3z') !== -1 ||
          button.innerHTML.indexOf('M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0') !== -1 ||
          button.innerHTML.indexOf('M2.7 1a.7.7 0 0 0-.7.7v12.6a') !== -1
      ) {
        musicIsPlaying = true
      }
    })
  }
  const [ret, songTitle, songArtistsArr] = getSongTitleAndArtist()
  if (ret < 0) return
  genius.f.loadLyrics(force, beLessSpecific, songTitle, songArtistsArr, musicIsPlaying)
}

let lastPos = null
function updateAutoScroll () {
  let pos = null
  try {
    const els = document.querySelectorAll('[data-testid="player-controls"] [data-testid="playback-position"],[data-testid="player-controls"] [data-testid="playback-duration"]')
    if (els.length !== 2) {
      throw new Error(`Expected 2 playback elements, found ${els.length}`)
    }
    const [current, remaining] = Array.from(els).map(e => e.textContent.trim().replace('-', '')).map(s => s.split(':').reverse().map((d, i, a) => parseInt(d) * Math.pow(60, i)).reduce((a, c) => a + c, 0))
    pos = current / (current + remaining)
  } catch (e) {
    // Could not parse current song position
    pos = null
  }
  if (pos != null && !Number.isNaN(pos) && lastPos !== pos) {
    genius.f.scrollLyrics(pos)
    lastPos = pos
  }
}

function startSearch (query, container) {
  genius.f.searchByQuery(query, container, (res) => {
    if (res && res.status === 200) {
      listSongs(res.hits, container, query)
    } else {
      const div = container.appendChild(document.createElement('div'))
      div.classList.add('geniushit')
      div.innerHTML = `Error:<pre>${JSON.stringify(res, null, 2)}</pre>`
    }
  })
}

function showSearchField (query) {
  const b = getCleanLyricsContainer()
  const div = b.appendChild(document.createElement('div'))
  div.style = 'padding:5px'
  div.appendChild(document.createTextNode('Search genius.com: '))

  // Hide button
  const hideButton = div.appendChild(document.createElement('a'))
  hideButton.href = '#'
  hideButton.style = 'float: right; padding-right: 10px;'
  hideButton.appendChild(document.createTextNode('Hide'))
  hideButton.addEventListener('click', function hideButtonClick (ev) {
    ev.preventDefault()
    hideLyrics()
  })

  const br = div.appendChild(document.createElement('br'))
  br.style.clear = 'right'

  div.style.paddingRight = '15px'
  const input = div.appendChild(document.createElement('input'))
  input.style = 'width:92%;border:0;border-radius:500px;padding:8px 5px 8px 25px;text-overflow:ellipsis'
  input.placeholder = 'Search genius.com...'
  if (query) {
    input.value = query
  } else if (genius.current.compoundTitle) {
    input.value = genius.current.compoundTitle.replace('\t', ' ')
  } else if (genius.current.artists && genius.current.title) {
    input.value = genius.current.artists + ' ' + genius.current.title
  } else if (genius.current.artists) {
    input.value = genius.current.artists
  }
  input.addEventListener('focus', function onSearchLyricsButtonFocus () {
    this.style.color = 'black'
  })
  input.addEventListener('change', function onSearchLyricsButtonClick () {
    this.style.color = 'black'
    if (input.value) {
      startSearch(input.value, b)
    }
  })
  input.addEventListener('keyup', function onSearchLyricsKeyUp (ev) {
    this.style.color = 'black'
    if (ev.code === 'Enter' || ev.code === 'NumpadEnter') {
      ev.preventDefault()
      if (input.value) {
        startSearch(input.value, b)
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
  b.setAttribute('style', 'position:absolute; top: 0px; right:0px; font-size:14px; color:#ffff64; cursor:pointer; z-index:3000;')
  b.setAttribute('title', 'Load lyrics from genius.com')
  b.appendChild(document.createTextNode('🅖'))
  b.addEventListener('click', function onShowLyricsButtonClick () {
    genius.option.autoShow = true // Temporarily enable showing lyrics automatically on song change
    window.clearInterval(genius.iv.main)
    genius.iv.main = window.setInterval(main, 2000)
    b.remove()
    addLyrics(true)
  })
  document.body.appendChild(b)
  if (b.clientWidth < 10) {
    b.setAttribute('style', 'position:absolute; top: 0px; right:0px; font-size:14px; background-color:#0007; color:#ffff64; cursor:pointer; z-index:3000;border:1px solid #ffff64;border-radius: 100%;padding: 0px 5px;font-size: 10px;')
    b.innerHTML = 'G'
  }
}

function configShowSpotifyLyrics (div) {
  // Input: Show lyrics from Spotify if no lyrics found on genius.com
  const id = 'input945455'

  const input = div.appendChild(document.createElement('input'))
  input.type = 'checkbox'
  input.id = id
  GM.getValue('show_spotify_lyrics', true).then(function (v) {
    input.checked = v
  })

  const label = div.appendChild(document.createElement('label'))
  label.setAttribute('for', id)
  label.appendChild(document.createTextNode('Open lyrics from Spotify if no lyrics found on genius.com'))

  const onChange = function onChangeListener () {
    GM.setValue('show_spotify_lyrics', input.checked)
  }
  input.addEventListener('change', onChange)
}

function configSubmitSpotifyLyrics (div) {
  // Input: Submit lyrics from Spotify to genius.com
  const id = 'input337565'

  const input = div.appendChild(document.createElement('input'))
  input.type = 'checkbox'
  input.id = id
  input.setAttribute('title', '...in case Spotify has lyrics that genius.com does not have')
  GM.getValue('submit_spotify_lyrics', true).then(function (v) {
    input.checked = v
  })

  const label = div.appendChild(document.createElement('label'))
  label.setAttribute('for', id)
  label.appendChild(document.createTextNode('Suggest to submit lyrics from Spotify to genius.com'))
  label.setAttribute('title', '...in case Spotify has lyrics that genius.com does not have')

  const onChange = function onChangeListener () {
    GM.setValue('submit_spotify_lyrics', input.checked)
  }
  input.addEventListener('change', onChange)
}

function configHideSpotifySuggestions (div) {
  // Input: Hide suggestions and hints from Spotify about new features
  const id = 'input875687'

  const input = div.appendChild(document.createElement('input'))
  input.type = 'checkbox'
  input.id = id
  input.setAttribute('title', 'Hide suggestions and hints from Spotify about new features')
  GM.getValue('hide_spotify_suggestions', true).then(function (v) {
    input.checked = v
  })

  const label = div.appendChild(document.createElement('label'))
  label.setAttribute('for', id)
  label.appendChild(document.createTextNode('Hide suggestions and hints from Spotify about new features'))

  const onChange = function onChangeListener () {
    GM.setValue('hide_spotify_suggestions', input.checked)
  }
  input.addEventListener('change', onChange)
}

function configHideSpotifyNowPlayingView (div) {
  // Input: Hide "Now Playing View"
  const id = 'input12567826'

  const input = div.appendChild(document.createElement('input'))
  input.type = 'checkbox'
  input.id = id
  input.setAttribute('title', 'Hide Spotify\'s "Now Playing View"')
  GM.getValue('hide_spotify_now_playing_view', true).then(function (v) {
    input.checked = v
  })

  const label = div.appendChild(document.createElement('label'))
  label.setAttribute('for', id)
  label.appendChild(document.createTextNode('Hide Spotify\'s "Now Playing View"'))

  const onChange = function onChangeListener () {
    GM.setValue('hide_spotify_now_playing_view', input.checked)
  }
  input.addEventListener('change', onChange)
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
  .lyricsnavbar {
    background-color: rgb(80, 80, 80);
    background-image: linear-gradient(rgba(0, 0, 0, 0.6), rgb(18, 18, 18));
    border-radius: 8px 8px 0px 0px;
    margin: 8px 0px 0px 0px;
    padding:0px 10px;
  }

  .lyricsnavbar span,.lyricsnavbar a:link,.lyricsnavbar a:visited {
    color: rgb(179, 179, 179);
    text-decoration:none;
    transition:color 400ms;
  }
  .lyricsnavbar a:hover,.lyricsnavbar span:hover {
    color:white;
    text-decoration:none;
  }
  .lyricsnavbar .second-line-separator,.lyricsnavbar .second-line-separator:hover {
    padding:0px 10px !important;
    color: transparent;
    vertical-align: text-bottom;
  }
  .geniushits li.tracklist-row {
    cursor:pointer
  }
  .geniushits li.tracklist-row:hover {
    background-color: #fff5;
    border-radius: 5px;
  }
  .geniushits li .geniushiticonout {
    display:inline-block;
  }
  .geniushits li:hover .geniushiticonout {
    display:none
  }
  .geniushits li .geniushiticonover {
    display:none
  }
  .geniushits li:hover .geniushiticonover {
    display:inline-block;
    padding-top:5px;
  }
  .geniushiticon {
    width:25px;
    height:2em;
    display:inline-block;
    vertical-align: top;
  }
  .geniushitname {
    display:inline-block;
    position: relative;
    overflow:hidden
  }
  .geniushitname .tracklist-name {
    font-size: 16px;
    font-weight: 400;
    color:white;
  }
  .geniushitname.runningtext .tracklist-name {
    display: inline-block;
    position: relative;
    animation: 3s linear 1s infinite normal runtext;
  }

  .geniushitname.runningtext:hover .tracklist-name {
    animation: none !important;
  }

  .geniushits .second-line-separator {
    opacity: 0.7
  }

  .geniushitname .geniusbadge {
    color: #121212;
    background-color: hsla(0,0%,100%,.6);
    border-radius: 2px;
    text-transform: uppercase;
    font-size: 9px;
    line-height: 10px;
    min-width: 16px;
    height: 16px;
    padding: 0 2px;
    margin: 0 3px;
  }

  @keyframes runtext {
    0%, 25% {
      transform: translateX(0%);
      left: 0%;
    }
    75%, 100% {
      transform: translateX(-100%);
      left: 100%;
    }
  }

  `
}

function styleIframeContent () {
  if (genius.option.themeKey === 'genius' || genius.option.themeKey === 'geniusReact') {
    genius.style.enabled = true
    genius.style.setup = () => {
      genius.style.setup = null // run once; set variables to genius.styleProps
      if (genius.option.themeKey !== 'genius' && genius.option.themeKey !== 'geniusReact') {
        genius.style.enabled = false
        return false
      }
      return true
    }
  } else {
    genius.style.enabled = false
    genius.style.setup = null
  }
}

function main () {
  if (document.querySelector('.Root [data-testid="player-controls"] [data-testid="playback-progressbar"]') && document.querySelector(songTitleQuery)) {
    if (genius.option.autoShow) {
      addLyrics()
    } else {
      addLyricsButton()
    }
  }
}

if (document.location.hostname === 'genius.com') {
  // https://genius.com/songs/new
  fillGeniusForm()
} else {
  window.setInterval(function removeAds () {
    // Remove "premium" button
    try {
      const button = document.querySelector('button[class^=Button][aria-label*=Premium]')
      if (button) {
        button.style.display = 'none'
      }
    } catch (e) {
      console.warn(e)
    }
    // Remove "install app" button
    try {
      const button = document.querySelector('a[href*="/download"]')
      if (button) {
        button.style.display = 'none'
      }
    } catch (e) {
      console.warn(e)
    }
    // Remove iframe "GET 3 MONTHS FREE"
    try {
      const iframe = document.querySelector('iframe[data-testid="inAppMessageIframe"]')
      if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.querySelectorAll('button').forEach(function (button) {
          if (button.parentNode.innerHTML.indexOf('Dismiss_action') !== -1) {
            button.click()
          }
        })
      }
    } catch (e) {
      console.warn(e)
    }
    // Remove another iframe "GET 3 MONTHS FREE"
    try {
      const iframe = document.querySelector('.ReactModalPortal iframe[srcdoc*="/purchase/"]')
      if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
        const dismissButtons = Array.from(iframe.contentDocument.body.querySelectorAll('button')).filter(b => b.textContent.toLowerCase().includes('dismiss'))
        if (dismissButtons.length) {
          dismissButtons[0].click()
        }
        const nonUrlButtons = Array.from(iframe.contentDocument.body.querySelectorAll('button')).filter(b => b.dataset.clickToActionAction !== 'URL')
        if (nonUrlButtons.length) {
          nonUrlButtons[0].click()
        }
      }
    } catch (e) {
      console.warn(e)
    }

    GM.getValue('hide_spotify_suggestions', true).then(function (hideSuggestions) {
      if (hideSuggestions) {
        // Remove hints and suggestions
        document.querySelectorAll('.encore-announcement-set button[class*="Button-"]').forEach(b => b.click())
        // Check "show never again"
        document.querySelectorAll('#dont.show.onboarding.npv').forEach(c => (c.checked = true))
        // Close bubble
        document.querySelectorAll('.tippy-box button[class*="Button-"]').forEach(b => b.click())
      }
    })

    GM.getValue('hide_spotify_now_playing_view', true).then(function (hideNowPlaying) {
      if (hideNowPlaying) {
        // Close "Now Playing View"
        // New: 2025-04
        document.querySelectorAll('[data-testid="control-button-npv"][data-active="true"]').forEach(function (b) {
          b.click()
        })
        // Old: 2024-10
        document.querySelectorAll('#Desktop_PanelContainer_Id [data-testid="PanelHeader_CloseButton"] button[class*="Button-"]').forEach(function (b) {
          if (b.parentNode.previousElementSibling && b.parentNode.previousElementSibling.querySelector('button[data-testid="more-button"]')) {
            // Second button is the "Now Playing View" button but not in the "Queue view"
            b.click()
          }
        })
      }
    })
  }, 3000)

  genius = geniusLyrics({
    GM,
    scriptName,
    scriptIssuesURL: 'https://github.com/cvzi/Spotify-Genius-Lyrics-userscript/issues',
    scriptIssuesTitle: 'Report problem: github.com/cvzi/Spotify-Genius-Lyrics-userscript/issues',
    domain: 'https://open.spotify.com',
    emptyURL: 'https://open.spotify.com/robots.txt',
    main,
    addCss,
    listSongs,
    showSearchField,
    addLyrics,
    hideLyrics,
    getCleanLyricsContainer,
    setFrameDimensions,
    initResize,
    onResize,
    config: [
      configShowSpotifyLyrics,
      configSubmitSpotifyLyrics,
      configHideSpotifySuggestions,
      configHideSpotifyNowPlayingView
    ],
    toggleLyricsKey: {
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      key: 'L'
    },
    onNoResults,
    onNewSongPlaying
  })

  genius.option.enableStyleSubstitution = true
  genius.option.cacheHTMLRequest = true // 1 lyrics page consume 2XX KB [OR 25 ~ 50KB under ]

  genius.onThemeChanged.push(styleIframeContent)

  GM.registerMenuCommand(scriptName + ' - Show lyrics', () => addLyrics(true))
  GM.registerMenuCommand(scriptName + ' - Options', () => genius.f.config())
  GM.registerMenuCommand(scriptName + ' - Submit lyrics to Genius', () => submitLyricsFromMenu())
  window.setInterval(updateAutoScroll, 1000)
  window.setInterval(improveLyricsPaywall, 10000)
}
