'use strict'; 
const apiKey = window.__APIKEY__;
let peer;
const localVideo = document.getElementById("local-video");
const remoteVideos = document.getElementById("remote-videos");
const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
// 各面談室へのリンク。これがクリックされたときにroomを開く仕様にしている
const meetings = document.querySelectorAll(".room-trigger");

const gotStream = ((stream) => {
    window.stream = stream;
    localVideo.srcObject = stream;
    localVideo.muted = true;
    localVideo.playsInline = true;
    localVideo.play().catch(console.error);
    return navigator.mediaDevices.enumerateDevices();
});
// https://github.com/webrtc/samples/blob/gh-pages/src/content/devices/input-output/js/main.js を参考にほぼそのまま
const gotDevices = ((deviceInfos) => {
    const selectors = [videoSelect];
    const values = selectors.map(select => select.value);
    selectors.forEach(select => {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
    });
    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            // 一旦こちらは無効に
            //option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
            //audioInputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'audiooutput') {
            // 一旦こちらは無効に
            // option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
            //audioOutputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);
        } else {
            console.log('Some other kind of source/device: ', deviceInfo);
        }
    }
    selectors.forEach((select, selectorIndex) => {
        if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
            select.value = values[selectorIndex];
        }
    });
});
const main = () =>  {
    if (window.stream) {
        window.stream.getTracks().forEach(track => { track.stop() });
    }
    const videoSource = videoSelect.value;
    const constraints =  {
        audio: true,
        video: { deviceId: videoSource ? { exact: videoSource } : undefined }
    };
    navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(console.error);


    // skyway 接続
    peer = new Peer({
        key: apiKey,
        debug: 0,
    });

    // イベント
    peer.on('open', () => { 
        console.log("peer open", `YOUR peerId=${peer.id}`, peer);
    });
    peer.on("error", console.error);
    // 一旦使う予定のないイベントを列挙
    peer.on('close', (arg) => { console.log("close", arg); });
    peer.on('disconnected', (arg) => { console.log("disconnected", arg); });
    peer.on('call', (arg) => { console.log("call", arg); });
};


/**
 * room入室のリンクがクリックされた
 */
const onClickRoomTrigger = ( (e) => {
    if (!peer.connect) {
        return;
    }

    const room = peer.joinRoom(e.target.id, {
        stream: window.stream,
    });
    // TODO: 要調査 これによりなんらかの数字が設定されるが効果がない...リファレンスにない関数呼んでるんだけど
    // これ自体は同じ画面でroomに二度入ろうとすることを防げるっぽい
    room.setMaxListeners(window.__MAX_LISTENERS__);

    // roomへの入室
    room.on('open', () => {
        console.log(`room open. room.name=${room.name}`);
        localVideo.setAttribute("class", "in-room");
        // 自分自身じゃないroomは退室する。接続相手のstreamを消す
        Object.keys(peer.rooms).forEach(roomName => {
            if (room.name !== roomName) {
                // 画面から相手のpeerIdを全部消してroomを退出する
                Object.keys(peer.rooms[roomName].connections).forEach(peerId => {
                    const remoteVideo = remoteVideos.querySelector(`[data-peer-id="${peerId}"]`);
                    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
                    remoteVideo.srcObject = null;
                    remoteVideo.remove();
                });
                peer.rooms[roomName].close();
            }
        });
    });

    // 誰かがroomに入ってきた
    room.on('peerJoin', (peerId) => {
        console.log("room peerJoin", `peerId=${peerId}`);
        console.log(`remotevideos count=${remoteVideos.getElementsByTagName("video").length}`);
    });

    // 新規参加者の映像を受信
    // そのpeerIdでvideo要素を作成する
    room.on('stream', async stream => {
        console.log("stream", stream);
        if (remoteVideos.getElementsByTagName("video").length === 0) {
            const newVideo = document.createElement("video");
            newVideo.srcObject = stream;
            newVideo.playsInline = true;
            newVideo.setAttribute("data-peer-id", stream.peerId);
            newVideo.setAttribute("class", "remote");
            remoteVideos.appendChild(newVideo);
            newVideo.play().catch(console.error);
        } else {
            // 上記のコードでどんどん追加することはできるが、1:1面談前提なのでここで切る
            // TODO: 入られる方は問題ないが、入った人が既存の部屋を見れてしまうので修正したほうが良い
            console.warn("二人目以降の接続は表示しません");
        }
    });
    // 参加者がroomから抜けた: leaveしたpeerIdに対応するvideo要素を消す
    room.on('peerLeave', (peerId) => {
        console.log("peerLeave", `peerId=${peerId}`); 
        const remoteVideo = remoteVideos.querySelector(`[data-peer-id="${peerId}"]`);
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
    });

    // 一旦使う予定のないイベントを列挙
    room.on('log', (arg) => { console.log("log", arg); });
    room.on('data', (arg) => { console.log("data", arg); });
    // TODO: 何かお掃除の必要があるかも
    room.on('close', () => { console.log("close"); });
});


// main
// 最初に取得可能なデバイス群をリストして、プルダウンを生成する
navigator.mediaDevices.enumerateDevices().then(gotDevices).then(() => {
    meetings.forEach(meeting => meeting.addEventListener("click", onClickRoomTrigger));
    videoSelect.addEventListener("change", main);
    main();
}).catch(console.error);
