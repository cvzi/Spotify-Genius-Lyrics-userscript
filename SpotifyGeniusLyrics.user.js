// ==UserScript==
// @name         Spotify Genius Lyrics
// @description  Show lyrics from genius.com on the Spotify web player
// @license      GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @copyright    2019, cuzi (https://github.com/cvzi
// @supportURL   https://github.com/cvzi/Spotify-Genius-Lyrics-userscript/issues
// @version      1
// @include      https://open.spotify.com/*
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @connect      genius.com
// ==/UserScript==

var requestCache = {}
var selectionCache = {}
var currentTitle = ''
var currentArtists = ''

function getHostname (url) {
  const a = document.createElement('a')
  a.href = url
  return a.hostname
}

function metricPrefix (bytes, precision) {
  // http://stackoverflow.com/a/18650828
  bytes = parseInt(bytes, 10)
  if (bytes === 0) {
    return '0'
  }
  var k = 1024
  var sizes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y']
  var i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toPrecision(precision)) + sizes[i]
}

async function loadCache () {
  selectionCache = JSON.parse(await GM.getValue('selectioncache', '{}'))

  requestCache = JSON.parse(await GM.getValue('requestcache', '{}'))
  /*
  requestCache = {
     "cachekey0": "121648565.5\njsondata123",
     ...
     }
  */
  for (var prop in requestCache) {
    // Delete cached values, that are older than 2 hours
    let time = JSON.parse(requestCache[prop].split('\n')[0])
    if ((new Date()).getTime() - (new Date(time)).getTime() > 2 * 60 * 60 * 1000) {
      delete requestCache[prop]
    }
  }
}

function request (obj) {
  const cachekey = JSON.stringify(obj)
  if (cachekey in requestCache) {
    return obj.load(JSON.parse(requestCache[cachekey].split('\n')[1]))
  }

  let headers = {
    'Referer': obj.url,
    'data': obj.data,
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Host': getHostname(obj.url),
    'User-Agent': navigator.userAgent
  }
  if (obj.headers) {
    headers = Object.assign(headers, obj.headers)
  }

  return GM.xmlHttpRequest({
    url: obj.url,
    method: obj.method ? obj.method : 'GET',
    headers: headers,
    onerror: obj.error ? obj.error : function genericOnError (response) { console.log(response) },
    onload: function xmlHttpRequestOnLoad (response) {
      const time = (new Date()).toJSON()
      // Chrome fix: Otherwise JSON.stringify(requestCache) omits responseText
      var newobj = {}
      for (var key in response) {
        newobj[key] = response[key]
      }
      newobj.responseText = response.responseText
      requestCache[cachekey] = time + '\n' + JSON.stringify(newobj)

      GM.setValue('requestcache', JSON.stringify(requestCache))

      obj.load(response)
    }
  })
}

function rememberLyricsSelection (title, artists, jsonHit) {
  const cachekey = title + '--' + artists
  selectionCache[cachekey] = jsonHit
  GM.setValue('selectioncache', JSON.stringify(selectionCache))
}

function getLyricsSelection (title, artists) {
  const cachekey = title + '--' + artists
  if (cachekey in selectionCache) {
    return JSON.parse(selectionCache[cachekey])
  } else {
    return false
  }
}

function onResize (ev) {
  let iframe = document.getElementById('lyricsiframe')
  if (iframe) {
    iframe.style.width = document.getElementById('lyricscontainer').clientWidth - 1 + 'px'
    iframe.style.height = document.querySelector('.Root__nav-bar .navBar').clientHeight + 'px'
  }
}

function geniusSearch (query, cb) {
  request({
    url: 'https://genius.com/api/search/song?page=1&q=' + encodeURIComponent(query),
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    },
    error: function geniusSearchOnError (response) {
      alert('Error geniusSearch(' + JSON.stringify(query) + ', cb):\n' + response)
    },
    load: function geniusSearchOnLoad (response) {
      cb(JSON.parse(response.responseText))
    }
  })
}

function loadGeniusAssets (song, annotations, cb) {
  let script = []
  let onload = []
  let headhtml = ''

  // Define globals
  script.push('var iv458,annotations1234;')

  // Hide cookies box function
  script.push('function hideCookieBox458() {if(document.querySelector(".optanon-allow-all")){document.querySelector(".optanon-allow-all").click(); clearInterval(iv458)}}')
  script.push('function decodeHTML652(s) { return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">") }')
  onload.push('iv458 = window.setInterval(hideCookieBox458, 500)')

  // Show annotations function
  script.push('function showAnnotation1234(id) { if(id in annotations1234) { let annotation = annotations1234[id]; let main = document.querySelector(".column_layout-column_span-initial_content"); main.querySelector(".annotation_label h3").innerHTML = decodeHTML652(annotation.created_by.name); main.querySelector(".rich_text_formatting").innerHTML = decodeHTML652(annotation.body.html); }}')
  onload.push('annotations1234 = JSON.parse(document.getElementById("annotationsdata1234").innerHTML);')

  request({
    url: song.result.url,
    error: function loadGeniusAssetsOnError (response) {
      alert('Error loadGeniusAssets(' + JSON.stringify(song) + ', cb):\n' + response)
    },
    load: function loadGeniusAssetsOnLoad (response) {
      let html = response.responseText

      // Make annotations clickable
      const regex = /annotation-fragment="(\d+)"/g
      html = html.replace(regex, 'onclick="showAnnotation1234($1)"')

      // Add onload attribute to body
      let parts = html.split('<body')
      html = parts[0] + '<body onload="onload7846552()"' + parts.slice(1).join('<body')
      // Add script code
      headhtml += '\n<script type="text/javascript">\n\n' + script.join('\n') + '\n\nfunction onload7846552() {\n' + onload.join('\n') + '\n}\n\n</script>'
      // Add annotation data
      headhtml += '\n<script id="annotationsdata1234" type="application/json">' + JSON.stringify(annotations).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</script>'
      // Add to <head>
      parts = html.split('</head>')
      html = parts[0] + '\n' + headhtml + '\n</head>' + parts.slice(1).join('</head>')

      cb(html)
    }
  })
}

function loadGeniusAnnotations (song, cb) {
  const apiurl = 'https://genius.com/api/referents/?text_format=html&song_id=' + song.result.id
  // TODO multiple pages e.g. https://genius.com/api/referents/?text_format=html&song_id=81159&page=1 and https://genius.com/api/referents/?text_format=html&song_id=81159&page=2 and ...
  request({
    url: apiurl,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    },
    error: function loadGeniusAnnotationsOnError (response) {
      alert('Error loadGeniusAnnotations(' + JSON.stringify(song) + ', cb):\n' + response)
    },
    load: function loadGeniusAnnotationsOnLoad (response) {
      const r = JSON.parse(response.responseText).response
      const annotations = {}
      r.referents.forEach(function forEachReferent (referent) {
        referent.annotations.forEach(function forEachAnnotation (annotation) {
          annotations[annotation.id] = annotation
        })
      })
      cb(song, annotations)
    }
  })
}

function getCleanLyricsContainer () {
  if (!document.getElementById('lyricscontainer')) {
    const topContainer = document.querySelector('.Root__top-container')
    topContainer.style.width = '70%'
    topContainer.style.float = 'left'
    const container = document.createElement('div')
    container.id = 'lyricscontainer'
    container.style = 'min-height: 100%; width: 30%; position: relative; z-index: 1; float:left; '
    topContainer.parentNode.insertBefore(container, topContainer.nextSibling)
  } else {
    document.getElementById('lyricscontainer').innerHTML = ''
  }
  return document.getElementById('lyricscontainer')
}

function hideLyrics () {
  if (document.getElementById('lyricscontainer')) {
    document.getElementById('lyricscontainer').parentNode.removeChild(document.getElementById('lyricscontainer'))
    const topContainer = document.querySelector('.Root__top-container')
    topContainer.style.width = '100%'
    topContainer.style.removeProperty('float')
  }
}

function showLyrics (song, searchresultsLengths) {
  const container = getCleanLyricsContainer()

  if (searchresultsLengths) {
    const bar = document.createElement('div')
    bar.style.fontSize = '0.7em'
    container.appendChild(bar)
    const backbutton = document.createElement('a')
    backbutton.href = '#'
    if (searchresultsLengths === true) {
      backbutton.appendChild(document.createTextNode('Back to search results'))
    } else {
      backbutton.appendChild(document.createTextNode('Back to search (' + (searchresultsLengths - 1) + ' other result' + (searchresultsLengths === 2 ? '' : 's') + ')'))
    }
    backbutton.addEventListener('click', function backbuttonClick (ev) {
      ev.preventDefault()
      addLyrics(true)
    })
    bar.appendChild(backbutton)
  }

  const iframe = document.createElement('iframe')
  iframe.id = 'lyricsiframe'
  container.appendChild(iframe)
  const spinner = '<style>.loadingspinner { pointer-events: none; width: 2.5em; height: 2.5em; border: 0.4em solid transparent; border-color: rgb(255, 255, 100) #181818 #181818 #181818; border-radius: 50%; animation: loadingspin 2s ease infinite;} @keyframes loadingspin { 25% { transform: rotate(90deg) } 50% { transform: rotate(180deg) } 75% { transform: rotate(270deg) } 100% { transform: rotate(360deg) }}</style><div class="loadingspinner"></div>'
  iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(spinner)
  iframe.style.width = container.clientWidth - 1 + 'px'
  iframe.style.height = document.querySelector('.Root__nav-bar .navBar').clientHeight + 'px'

  loadGeniusAnnotations(song, function loadGeniusAnnotationsCb (song, annotations) {
    loadGeniusAssets(song, annotations, function loadGeniusAssetsCb (html) {
      iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    })
  })
}

function listSongs (hits) {
  const container = getCleanLyricsContainer()

  const trackhtml = '<div class="tracklist-col position-outer"><div class="tracklist-play-pause tracklist-top-align"><span style="color:silver;font-size:2.0em">🅖</span></div><div class="position tracklist-top-align"><span style="font-size:1.5em">📄</span></div></div><div class="tracklist-col name"><div class="track-name-wrapper tracklist-top-align"><div class="tracklist-name ellipsis-one-line" dir="auto">$title</div><div class="second-line"><span class="TrackListRow__explicit-label">$lyrics_state</span><span class="ellipsis-one-line" dir="auto"><a tabindex="-1" class="tracklist-row__artist-name-link" href="#">$artist</a></span><span class="second-line-separator" aria-label="in album">•</span><span class="ellipsis-one-line" dir="auto"><a tabindex="-1" class="tracklist-row__album-name-link" href="#">👁 <span style="font-size:0.8em">$stats.pageviews</span></a></span></div></div></div>'
  container.innerHTML = '<section class="tracklist-container"><ol class="tracklist" style="width:99%"></ol></section>'

  const ol = container.querySelector('ol.tracklist')
  const searchresultsLengths = hits.length
  const title = currentTitle
  const artists = currentArtists
  const onclick = function onclick () {
    rememberLyricsSelection(title, artists, this.dataset.hit)
    showLyrics(JSON.parse(this.dataset.hit), searchresultsLengths)
  }
  hits.forEach(function forEachHit (hit) {
    let li = document.createElement('li')
    li.setAttribute('class', 'tracklist-row')
    li.setAttribute('role', 'button')
    li.innerHTML = trackhtml.replace(/\$title/g, hit.result.title_with_featured).replace(/\$artist/g, hit.result.primary_artist.name).replace(/\$lyrics_state/g, hit.result.lyrics_state).replace(/\$stats\.pageviews/g, metricPrefix(hit.result.stats.pageviews, 1))
    li.dataset.hit = JSON.stringify(hit)

    li.addEventListener('click', onclick)
    ol.appendChild(li)
  })
}

function addLyrics (force) {
  const songTitle = document.querySelector('.track-info__name.ellipsis-one-line').innerText
  const songArtistsArr = []
  document.querySelector('.track-info__artists.ellipsis-one-line').querySelectorAll('a[href^="/artist/"]').forEach((e) => songArtistsArr.push(e.innerText))
  const songArtists = songArtistsArr.join(' ')
  if (force || currentTitle !== songTitle || currentArtists !== songArtists) {
    currentTitle = songTitle
    currentArtists = songArtists
    let hitFromCache = getLyricsSelection(songTitle, songArtists)
    if (!force && hitFromCache) {
      showLyrics(hitFromCache, true)
    } else {
      geniusSearch(songTitle + ' ' + songArtists, function geniusSearchCb (r) {
        const hits = r.response.sections[0].hits
        if (hits.length === 0) {
          hideLyrics()
        } else if (hits.length === 1) {
          showLyrics(hits[0])
        } else {
          listSongs(hits)
        }
      })
    }
  }
}

function main () {
  if (document.querySelector('.now-playing')) {
    addLyrics()
  }
}

loadCache()
window.setInterval(main, 2000)
window.addEventListener('resize', onResize)
