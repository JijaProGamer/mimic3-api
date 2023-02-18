import axios from 'axios';

class mimicInstance {
    #server_url

    constructor(server_url) {
        this.#server_url = server_url
    }

    async getVoices() {
        return new Promise((resolve, reject) => {
            axios({
                method: "GET",
                url: `${this.#server_url}/api/voices`
            }).then((data) => {
                let voices = data.data
                    .filter(voice => voice.speakers)
                    .map(voice => voice = {
                        key: voice.key,
                        language: voice.language_english,
                        name: voice.name,
                        properties: voice.properties,
                        speakers: voice.speakers,
                    })
                    .map(voice => voice = {
                        ...voice,
                        speakers: voice.speakers.length && voice.speakers || ["default"],
                        properties: Object.keys(voice.properties).length && {
                            speaking_rate: voice.properties.length_scale,
                            audio_noise: voice.properties.noise_scale,
                            phoneme_noise: voice.properties.noise_w,
                        } || {
                            speaking_rate: 1,
                            audio_noise: 0.333,
                            phoneme_noise: 0.333,
                        }
                    })

                resolve(voices)
            }).catch(reject)
        })
    }

    async speak() {
        let texts = Array.from(arguments)
        let voice = texts.pop()

        return new Promise((resolve, reject) => {
            if (typeof texts == "string") texts = [texts]
            let result = []
            let finished = 0
            let failed = false

            for (let text of texts) {
                let ttsURL = new URL(`${this.#server_url}/api/tts`)
                ttsURL.searchParams.set("text", encodeURIComponent(text))
                ttsURL.searchParams.set("ssml", true)

                ttsURL.searchParams.set("lengthScale", voice.properties.speaking_rate)
                ttsURL.searchParams.set("noiseScale", voice.properties.audio_noise)
                ttsURL.searchParams.set("noiseW", voice.properties.phoneme_noise)

                ttsURL.searchParams.set("voice", `${voice.key}#${voice.speaker}`)
                ttsURL.searchParams.set("audioTarget", `client`)

                axios({
                    method: "GET",
                    url: ttsURL.toString(),
                    responseType: "stream"
                }).then((data) => {
                    let currentBuffers = []

                    data.data.on("data", (data) => currentBuffers.push(data))
                    data.data.on("end", () => {
                        let audio = Buffer.concat(currentBuffers)

                        result.push({
                            text,
                            audioBuffer: audio,
                            duration: audio.length / (22050 * (16 / 8))
                                      // duration = storage / (sample rate * (bit_depth / 8))
                        })

                        finished += 1
                        if (finished == texts.length && !failed) {
                            resolve(result)
                        }
                    })
                }).catch((err) => {
                    failed = true
                    reject(err)
                })
            }

            return result
        })
    }
}

function createMimicInterface(server_url) {
    return new mimicInstance(server_url)
}

createMimicInterface.mimicInstance = mimicInstance;
createMimicInterface.proxyTester = createMimicInterface;
createMimicInterface.default = createMimicInterface;

export { createMimicInterface }
export default createMimicInterface