// Generated arcade tones, with separate music/effect preferences.
export function createGameAudio({preferences, muted, playing, contextFactory,schedule=setInterval,cancel=clearInterval,delay=setTimeout}) {
let audioCtx = null;

function ensureAudio() {
	if (muted()) return null;
	if (!audioCtx) {
  try{audioCtx=contextFactory();}catch{return null;}
 }
	if (audioCtx.state === "suspended") {
		Promise.resolve(audioCtx.resume()).catch(()=>{});
	}
	return audioCtx;
}

function playTone(freq, duration, type = "square", volume = 0.15, channel="effects") {
 const p=preferences();if(channel==="music"?!p.music:!p.effects)return;volume*=p.volume;if(volume<=0)return;
	try {
		const ctx = ensureAudio();
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, ctx.currentTime);
		gain.gain.setValueAtTime(volume, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + duration);
	} catch (e) { /* silent fail */ }
}

function sfxJump() {
	playTone(400, 0.12, "square", 0.1);
	delay(() => playTone(600, 0.1, "square", 0.08), 50);
}

function sfxCoin() {
	playTone(880, 0.08, "sine", 0.12);
	delay(() => playTone(1200, 0.12, "sine", 0.1), 60);
}

function sfxCrash() {
	playTone(120, 0.3, "sawtooth", 0.2);
	playTone(80, 0.5, "sawtooth", 0.15);
}

function sfxPowerup() {
	playTone(523, 0.1, "sine", 0.12);
	delay(() => playTone(659, 0.1, "sine", 0.12), 80);
	delay(() => playTone(784, 0.15, "sine", 0.12), 160);
}

function sfxShieldBreak() {
	playTone(300, 0.15, "triangle", 0.15);
	delay(() => playTone(200, 0.2, "triangle", 0.1), 100);
}

let musicInterval = null;
let musicBeat = 0;

const BASS_NOTES = [130.81, 130.81, 164.81, 146.83];
const ARP_NOTES = [523.25, 659.25, 783.99, 659.25, 523.25, 392.00, 523.25, 659.25];

function startMusic() {
	if (muted() || !preferences().music || musicInterval) return;
	musicBeat = 0;
	const beatMs = Math.floor(60000 / 140 / 2);
	musicInterval = schedule(() => {
		if (!playing() || muted()) { stopMusic(); return; }
		try {
			if (musicBeat % 4 === 0) {
				playTone(BASS_NOTES[(musicBeat / 4) % BASS_NOTES.length], 0.15, "triangle", 0.05, "music");
			}
			playTone(ARP_NOTES[musicBeat % ARP_NOTES.length], 0.08, "square", 0.025, "music");
			musicBeat++;
		} catch (e) { /* silent */ }
	}, beatMs);
}

function stopMusic() {
	if (musicInterval) { cancel(musicInterval); musicInterval = null; }
}

return {ensureAudio,playTone,sfxJump,sfxCoin,sfxCrash,sfxPowerup,sfxShieldBreak,startMusic,stopMusic};
}
