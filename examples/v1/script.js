'use strict'; 
const apiKey = '578c3538-0921-4902-98de-9472d78169ca'; 
let members = 0;

(async function main() {
    const remoteVideos = document.getElementById("remote-videos");
    const localVideo = document.getElementById("local-video");
    const counter = document.getElementById("counter");
    const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
    }).catch(console.error);

    // 自分のビデオを描画
    localVideo.muted = true;
    localVideo.srcObject = localStream;
    localVideo.playsInline = true;
    await localVideo.play().catch(console.error);

    // Peer({}); で IDを自動割当てするか、初期値として与えることもできる
    // turnは基本的に無効でも使えそうだが環境の問題を起こす可能性も？
    const peer = new Peer({
        key: apiKey,
        debug: 0,
        turn: false,
    });
    peer.on("error", console.error);


    peer.on('open', () => { 
        console.log("peer open", `YOUR peerId=${peer.id}`, peer);
        // room〜room.on はこの時点で自動的にjoinさせるよりも、ボタンを押す等のトリガーでの入室のほうがきれい
        const room = peer.joinRoom('myRoomName', {
            stream: localStream,
        });
        // 新規入室
        room.on('open', () => {
            console.log("room open");
            // 入室時にも算出する？？
            console.log(room.name, Object.keys(room.connections))
            counter.innerText = Object.keys(room.connections).length + 1;
        });
        room.on('peerJoin', (peerId) => { 
            console.log("peerJoin", `peerId=${peerId}`); 
            // TODO: このroomにいる他の人たちを表示したいが２名だとうまく取れない
            // これを取得することで特定人数より多い参加を許可しないようにする
            // このイベントはそもそも「誰かが入室したとき」に発火するので自分が参加したときに取れない
            console.log(room.name, Object.keys(room.connections))
            counter.innerText = Object.keys(room.connections).length + 1;
        });

        // streamが届いたら新規参加者の映像を受信したことになるはず
        // そのpeerIdでvideo要素を作成する
        room.on('stream', async stream => {
            console.log("stream", stream);
            const newVideo = document.createElement("video");
            newVideo.srcObject = stream;
            newVideo.playsInline = true;
            newVideo.setAttribute("data-peer-id", stream.peerId);
            newVideo.setAttribute("class", "remote");
            remoteVideos.appendChild(newVideo);
            newVideo.play().catch(console.error);
        });
        // leaveしたpeerIdに対応するvideo要素を消す
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
        // TODO: お掃除の必要があるかも
        room.on('close', (arg) => { console.log("close", arg); });
    });

    // 一旦使う予定のないイベントを列挙
    peer.on('close', (arg) => { console.log("close", arg); });
    peer.on('disconnected', (arg) => { console.log("disconnected", arg); });
    peer.on('call', (arg) => { console.log("call", arg); });
})();
