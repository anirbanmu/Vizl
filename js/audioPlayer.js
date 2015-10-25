'use strict';

function Track(trackData) {
    this.url = trackData.stream_url;
    this.title = trackData.title;
    this.artwork_url = trackData.artwork_url ? trackData.artwork_url.replace('-large', '-t500x500') : null; // Use highest size image
}

function Playlist() {
    var tracks = [];
    var currentIndex = 0;

    function addTrack(trackData) {
        if (trackData.streamable){
            tracks.push(new Track(trackData));
        }
    }

    this.addItem = function(itemInfo) {
        var atEnd = this.ended();
        if (itemInfo.kind === 'track') {
            addTrack(itemInfo);
        }
        if (itemInfo.kind === 'playlist') {
            itemInfo.tracks.forEach(addTrack);
        }
        return atEnd;
    };

    this.next = function () {
        if (this.ended()) {
            return null;
        }
        return tracks[currentIndex++];
    };

    this.prev = function() {
        if (currentIndex == 1) {
            return null;
        }
        --currentIndex;
        return tracks[currentIndex - 1];
    };

    this.ended = function() {
        return currentIndex === tracks.length;
    }
}

function AudioPlayer(audioElement, playPause, progressBar, trackInfoDisplay) {
    var trackTitle = '';

    var innerProgressBar = $("<div id='bar' />");
    progressBar.append(innerProgressBar);

    this.playTrack = function(track, clientId) {
        audioElement.src = new URL(track.url + '?client_id=' + clientId);
        trackTitle = track.title;
    };

    this.playPauseToggle = function() {
        if (audioElement.paused) {
            audioElement.play();
            return;
        }
        audioElement.pause();
    };

    this.onPause = function() {
        playPause.className = 'i fontawesome-play';
        trackInfoDisplay.textContent = 'Paused';
    };

    this.onPlay = function() {
        playPause.className = 'i fontawesome-pause';
        trackInfoDisplay.textContent = trackTitle;
    };

    this.onTimeUpdate = function() {
        var progress = 100 * audioElement.currentTime / audioElement.duration;
        innerProgressBar[0].style.width = progress + '%';
    };

    this.seekTo = function(normalizedPosition) {
        if (audioElement.src) {
            var newTime = audioElement.duration * normalizedPosition;
            audioElement.currentTime = newTime;
        }
    };

    this.onEnd = function() {
        audioElement.src = '';
    };

    this.trackInProgress = function() {
        return audioElement.src !== '';
    };
}