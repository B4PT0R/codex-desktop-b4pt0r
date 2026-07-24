import {
  acceptsRealtimeEvent,
  applyActivationSignal,
  connectionStatus,
  createActivationState,
  isRealtimeActive,
} from "/realtime-session.mjs";
import {
  applyTranscriptEvent,
  createTranscriptState,
  renderTranscript,
} from "/transcript.mjs";

const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const realtimeButton = document.querySelector("#realtime");
const status = document.querySelector("#status");
const details = document.querySelector("#details");
const channels = document.querySelector("#channels");
const sampleRate = document.querySelector("#sample-rate");
const device = document.querySelector("#device");
const canvas = document.querySelector("#meter");
const transcript = document.querySelector("#transcript");
const canvasContext = canvas.getContext("2d");

let stream;
let audioContext;
let animationFrame;
let peerConnection;
let realtimeThreadId;
let unsubscribeRealtime;
let transcriptState = createTranscriptState();
let answerTimeout;
let disconnectTimeout;
let lastRealtimeError;
let activationState = createActivationState();

function recordActivationSignal(signal) {
  activationState = applyActivationSignal(activationState, signal);
  if (isRealtimeActive(activationState)) {
    setStatus("active", "Realtime actif", "Parle naturellement avec Codex.");
  }
}

function updateTranscript(method, params) {
  transcriptState = applyTranscriptEvent(
    transcriptState,
    method,
    params,
  );
  transcript.textContent = renderTranscript(transcriptState);
}

function setStatus(kind, label, message) {
  status.className = `status ${kind}`;
  status.textContent = label;
  details.textContent = message;
}

function clearMeter() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.fillStyle = "#202226";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);
}

function drawMeter(analyser) {
  const samples = new Uint8Array(analyser.fftSize);
  const draw = () => {
    analyser.getByteTimeDomainData(samples);
    let energy = 0;
    for (const value of samples) {
      const centered = (value - 128) / 128;
      energy += centered * centered;
    }
    const level = Math.min(1, Math.sqrt(energy / samples.length) * 4);
    clearMeter();
    canvasContext.fillStyle = "#75b684";
    canvasContext.fillRect(
      0,
      0,
      Math.max(2, canvas.width * level),
      canvas.height,
    );
    animationFrame = requestAnimationFrame(draw);
  };
  draw();
}

async function stopCapture() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = undefined;
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  if (audioContext) await audioContext.close();
  audioContext = undefined;
  clearMeter();
  startButton.disabled = false;
  stopButton.disabled = true;
  setStatus("idle", "Inactif", "La capture est arrêtée.");
}

function waitForIceGathering(connection) {
  if (connection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(done, 5_000);
    function done() {
      clearTimeout(timeout);
      connection.removeEventListener("icegatheringstatechange", changed);
      resolve();
    }
    function changed() {
      if (connection.iceGatheringState === "complete") done();
    }
    connection.addEventListener("icegatheringstatechange", changed);
  });
}

async function stopRealtime() {
  clearTimeout(answerTimeout);
  clearTimeout(disconnectTimeout);
  answerTimeout = undefined;
  disconnectTimeout = undefined;
  unsubscribeRealtime?.();
  unsubscribeRealtime = undefined;
  await window.electronProbe?.stopRealtime().catch(() => undefined);
  peerConnection?.close();
  peerConnection = undefined;
  realtimeThreadId = undefined;
  lastRealtimeError = undefined;
  activationState = createActivationState();
  realtimeButton.disabled = false;
  realtimeButton.textContent = "Tester Realtime v3";
  await stopCapture();
}

async function startRealtime() {
  realtimeButton.disabled = true;
  transcriptState = createTranscriptState();
  lastRealtimeError = undefined;
  transcript.textContent = "";
  setStatus("idle", "Connexion…", "Préparation de WebRTC et de Codex Realtime v3.");
  try {
    await stopCapture();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const connection = new RTCPeerConnection();
    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    connection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
      void remoteAudio.play().catch(() => undefined);
    };
    connection.addTrack(stream.getAudioTracks()[0], stream);
    const eventsChannel = connection.createDataChannel("oai-events");
    eventsChannel.addEventListener("close", () => {
      if (
        connection.connectionState !== "closed" &&
        !lastRealtimeError
      ) {
        setStatus(
          "error",
          "Canal Realtime fermé",
          "Le serveur a fermé le canal de contrôle WebRTC.",
        );
      }
    });
    eventsChannel.addEventListener("error", (event) => {
      lastRealtimeError =
        event.error?.message ?? "Le canal SCTP a signalé une erreur.";
      setStatus("error", "Erreur du canal Realtime", lastRealtimeError);
    });
    eventsChannel.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (
          message?.type === "session.started" ||
          message?.type === "session.updated"
        ) {
          recordActivationSignal("session-initialized");
        }
      } catch {
        // Realtime may add data-channel messages that this diagnostic does not use.
      }
    });
    connection.addEventListener("connectionstatechange", () => {
      const next = connectionStatus(connection.connectionState);
      if (connection.connectionState === "connected") {
        recordActivationSignal("webrtc-connected");
      } else {
        setStatus(next.kind, next.label, next.message);
      }
      clearTimeout(disconnectTimeout);
      disconnectTimeout = undefined;
      if (connection.connectionState === "disconnected") {
        disconnectTimeout = setTimeout(() => {
          if (connection.connectionState === "disconnected") {
            setStatus(
              "error",
              "Connexion figée",
              "WebRTC n’a pas récupéré après 8 secondes. Relance la session.",
            );
          }
        }, 8_000);
      }
    });
    peerConnection = connection;
    unsubscribeRealtime = window.electronProbe.onRealtimeEvent((message) => {
      const params = message?.params ?? {};
      if (!acceptsRealtimeEvent(realtimeThreadId, params.threadId)) return;
      if (message.method === "thread/realtime/sdp" && params.sdp) {
        clearTimeout(answerTimeout);
        answerTimeout = undefined;
        void connection
          .setRemoteDescription({ type: "answer", sdp: params.sdp })
          .then(() => {
            if (!isRealtimeActive(activationState)) {
              setStatus(
                "idle",
                "Initialisation…",
                "La signalisation est établie, Codex initialise la session.",
              );
            }
          })
          .catch((error) =>
            setStatus("error", "Erreur SDP", String(error)),
          );
      }
      if (message.method === "thread/realtime/started") {
        recordActivationSignal("thread-started");
      }
      if (message.method === "thread/realtime/transcript/delta") {
        updateTranscript(message.method, params);
      }
      if (message.method === "thread/realtime/transcript/done") {
        updateTranscript(message.method, params);
      }
      if (message.method === "thread/realtime/error") {
        lastRealtimeError = params.message ?? "Erreur inconnue";
        setStatus("error", "Realtime interrompu", lastRealtimeError);
      }
      if (message.method === "thread/realtime/closed") {
        const reason = params.reason ?? "sans raison fournie";
        if (lastRealtimeError) {
          setStatus(
            "error",
            "Realtime fermé après erreur",
            `${lastRealtimeError} — fermeture : ${reason}`,
          );
        } else if (reason === "requested") {
          setStatus("idle", "Fermé", "La session a été arrêtée localement.");
        } else {
          setStatus(
            "error",
            "Realtime fermé par le transport",
            `App Server a fermé la session : ${reason}.`,
          );
        }
      }
    });
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await waitForIceGathering(connection);
    const sdp = connection.localDescription?.sdp;
    if (!sdp) throw new Error("Chromium n’a produit aucune offre SDP.");
    const result = await window.electronProbe.startRealtime(sdp);
    realtimeThreadId = result.threadId;
    recordActivationSignal("request-accepted");
    if (!connection.remoteDescription) {
      answerTimeout = setTimeout(() => {
        if (!connection.remoteDescription) {
          setStatus(
            "error",
            "Signalisation expirée",
            "Codex n’a pas fourni de réponse SDP sous 15 secondes.",
          );
        }
      }, 15_000);
      setStatus("idle", "Signalisation…", "Offre envoyée à Codex App Server.");
    }
    realtimeButton.disabled = false;
    realtimeButton.textContent = "Arrêter Realtime";
  } catch (error) {
    realtimeButton.disabled = false;
    await stopRealtime();
    setStatus(
      "error",
      "Erreur Realtime",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function startCapture() {
  startButton.disabled = true;
  setStatus("idle", "Demande…", "Chromium demande l’accès au microphone.");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    audioContext = new AudioContext();
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    channels.textContent = String(settings.channelCount ?? 1);
    sampleRate.textContent = `${settings.sampleRate ?? audioContext.sampleRate} Hz`;
    device.textContent = track.label || "Microphone par défaut";
    stopButton.disabled = false;
    setStatus(
      "active",
      "Actif",
      "La capture Chromium fonctionne. Parle pour vérifier le niveau.",
    );
    drawMeter(analyser);
  } catch (error) {
    startButton.disabled = false;
    stopButton.disabled = true;
    setStatus(
      "error",
      "Erreur",
      `${error instanceof Error ? error.name : "Erreur"} : ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

startButton.addEventListener("click", () => void startCapture());
stopButton.addEventListener("click", () => void stopCapture());
realtimeButton.addEventListener("click", () => {
  if (peerConnection) void stopRealtime();
  else void startRealtime();
});
window.addEventListener("beforeunload", () => {
  stream?.getTracks().forEach((track) => track.stop());
  peerConnection?.close();
});
clearMeter();
