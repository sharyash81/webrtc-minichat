//const socket = io('http://5.34.195.146:8000');
const socket = io('https://signaling.faranegareh.com');
const videoGrid = document.getElementById('videoGrid');
const peers = {};
const localVideo = document.createElement('video');
const muteVoiceButton = document.getElementById('muteVoice');
const OncameraButton = document.getElementById('CameraEnable');
const chatInput = document.getElementById('chatInput');
const sendMessageButton = document.getElementById('sendMessage');
const messagesContainer = document.getElementById('messages');

sendMessageButton.addEventListener('click', sendMessage);

const userColors = {}; 
const colors = ['#1c1c1c', '#6055ffc0'];

function getUserColor(userId) {
    if (!userColors[userId]) {
        userColors[userId] = colors[Object.keys(userColors).length % colors.length];
    }
    return userColors[userId];
}

socket.on('chat-message', (message, senderId) => {
    addMessageToChat(`${senderId.substring(0, 5)}: ${message}`);
});

muteVoiceButton.addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            muteVoiceButton.textContent = audioTrack.enabled ? '🔇' : '🔊';
            muteVoiceButton.style.backgroundColor = audioTrack.enabled ? '' : 'rgba(224, 0, 0, 0.8)';

            socket.emit('mute-state', { peerId: socket.id, audio: !audioTrack.enabled, video: undefined });
        }
    }
});

OncameraButton.addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            OncameraButton.textContent = videoTrack.enabled ? '📹' : '📷';
            OncameraButton.style.backgroundColor = videoTrack.enabled ? '' : 'rgba(224, 0, 0, 0.8)';
            socket.emit('mute-state', { peerId: socket.id, audio: undefined, video: !videoTrack.enabled });
        }
    }
});

let localStream = null;
let audioAnalyzers = {};

localVideo.muted = true;
localVideo.classList.add('video');
videoGrid.appendChild(localVideo);

function voiceLevelAdapter(stream, videoElement) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    source.connect(analyser);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function checkAudioLevel() {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;

        if (volume > 15) {
            videoElement.classList.add('speaking');
        } else {
            videoElement.classList.remove('speaking');
        }

        requestAnimationFrame(checkAudioLevel);
    }

    checkAudioLevel();
    return audioContext;
}

async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localVideo.play();

        audioAnalyzers[socket.id] = voiceLevelAdapter(localStream, localVideo);

        socket.emit('join-call');
    } catch (error) {
        console.error('error media devices:', error);
    }
}

function createPeerConnection(peerSocketId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
	    {
    		urls: "turn:5.34.195.146:3478",
    		username: "my-turn-server",
    		credential: "this-is-credential",
	    }
        ],
    });

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, peerSocketId);
        }
    };

    const remoteStream = new MediaStream();
    peerConnection.ontrack = event => {
        remoteStream.addTrack(event.track);

        if (!peers[peerSocketId]?.remoteVideo) {
            const remoteVideo = document.createElement('video');
            remoteVideo.srcObject = remoteStream;
            remoteVideo.autoplay = true;
            remoteVideo.classList.add('video');
            videoGrid.appendChild(remoteVideo);
            peers[peerSocketId].remoteVideo = remoteVideo;

            audioAnalyzers[peerSocketId] = voiceLevelAdapter(remoteStream, remoteVideo);
        }
    };

    return peerConnection;
}


function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
        addMessageToChat(`Me: ${message}`, 'self');
        socket.emit('chat-message', message);
        chatInput.value = '';
    }
}

function addMessageToChat(message, sender = 'other') {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    const userColor = getUserColor(sender); 
    messageElement.style.backgroundColor = '#1c1c1c';

    if (sender === 'self') {
        messageElement.style.backgroundColor = '#6055ffc0';
        messageElement.style.color = '#fff'; 
        messageElement.style.alignSelf = 'flex-end'; 
    }

    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

socket.on('user-connected', peerSocketId => {
    const peerConnection = createPeerConnection(peerSocketId);
    peers[peerSocketId] = { peerConnection };

    peerConnection.createOffer()
        .then(offer => {
            peerConnection.setLocalDescription(offer);
            socket.emit('offer', offer, peerSocketId);
        });
});

socket.on('offer', async (offer, peerSocketId) => {
    const peerConnection = createPeerConnection(peerSocketId);
    peers[peerSocketId] = { peerConnection };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer, peerSocketId);
});

socket.on('answer', async (answer, peerSocketId) => {
    await peers[peerSocketId].peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate, peerSocketId) => {
    const peerConnection = peers[peerSocketId]?.peerConnection;
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

socket.on('user-disconnected', peerSocketId => {
    if (peers[peerSocketId]?.remoteVideo) {
        videoGrid.removeChild(peers[peerSocketId].remoteVideo);
    }
    if (peers[peerSocketId]?.peerConnection) {
        peers[peerSocketId].peerConnection.close();
    }
    if (audioAnalyzers[peerSocketId]) {
        audioAnalyzers[peerSocketId].close();
        delete audioAnalyzers[peerSocketId];
    }
    delete peers[peerSocketId];
});

socket.on('mute-state', ({ peerId, audio, video }) => {
    const peerVideo = peers[peerId]?.remoteVideo;
    if (peerVideo) {
        if (audio !== undefined) {
            peerVideo.dataset.audioMuted = audio ? 'true' : 'false';
        }
        if (video !== undefined) {
            peerVideo.style.opacity = video ? '0.5' : '1'; 
        }
    }
});

getLocalStream();
