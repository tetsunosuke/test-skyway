'use strict'; 
const apiKey = window.__APIKEY__;
let members = 0;
let peer;
let localStream;
let localVideo;
let remoteVideos;

(async function main() {
    remoteVideos = document.getElementById("remote-videos");
    localVideo = document.getElementById("local-video");

    // 自分のビデオを描画
    localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
    }).catch(console.error);

    localVideo.muted = true;
    localVideo.srcObject = localStream;
    localVideo.playsInline = true;
    await localVideo.play().catch(console.error);

    // 各面談室へのリンク。これがクリックされたときにroomを開く仕様にしている
    const meetings = document.querySelectorAll(".room-trigger");
    meetings.forEach(meeting => meeting.addEventListener("click", onClickRoomTrigger));

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
})();


/**
 * room入室のリンクがクリックされた
 */
const onClickRoomTrigger = ( (e) => {
    if (!peer.connect) {
        return;
    }

    const room = peer.joinRoom(e.target.id, {
        stream: localStream,
    });
    // TODO: 要調査 これによりなんらかの数字が設定されるが効果がない...リファレンスにない関数呼んでるんだけど
    // これ自体は同じ画面でroomに二度入ろうとすることを防げるっぽい
    room.setMaxListeners(1);

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
