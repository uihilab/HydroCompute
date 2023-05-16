/**
 * WebRTC engine class.
 */
export default class WebRTC {
  /**
 * Constructs a new instance of the WebRTC engine.
 */
constructor() {
  this.MAX_MESSAGE_SIZE = 65535;
  this.connectionTime = undefined;
  this.candidates = undefined;
  this.dataChannel = undefined;
  this.type = "host";
  this.results = [];
  this.selfData = [];
  this.connection = new RTCPeerConnection();

  this.initialize();
}


/**
 * Initializes the WebRTC engine.
 */
initialize() {
  this.setConnection();
  this.setDataChannel();

  console.log(`WebRTC engine initialized. Initial connection: host/request.`);
}

  /**
 * Runs the WebRTC engine.
 * @param {*} res - The response.
 */
run(res) {
  if (this.type === "host") {
    this.setDataChannel();
    this.setConnection();
    this.candidates();
    this.createOfferDescription();

    if (res) {
      this.openConnection(res);
    } else {
      console.error(`Please input the answer of the response machine.`);
    }
  } else {
    this.setConnection();
    this.onAvailableChannel();

    if (res) {
      this.setOfferDescription(res);
      this.createAnswer();
    } else {
      console.error(`Please set the ICE from the main machine.`);
    }
  }
}

 /**
 * Sets the connection for WebRTC.
 */
setConnection() {
  this.candidates = this.connection.onicecandidate = (e) => {
    console.log("New ice candidate. Local connection in console.");
    console.log(JSON.stringify(this.connection.localDescription));
  };
}

   /**
 * Sets the connection for WebRTC.
 */
setDataChannel() {
  this.dataChannel = this.connection.createDataChannel("dataChannel");
  this.dataChannel.binaryType = "arraybuffer";
  this.dataChannel.onmessage = (e) => console.log(`Data received: ${e.data}`);
  this.dataChannel.onopen = (e) => console.log(`Data channel open on ${this.type} machine.`);
  this.dataChannel.onclose = (e) => this.onCloseHost();
}

 /**
 * Handles the available channel for WebRTC.
 */
onAvailableChannel() {
  this.connection.ondatachannel = (e) => {
    const receiveChannel = e.channel;
    receiveChannel.binaryType = "arraybuffer";
    receiveChannel.onmessage = async (e) => {
      let rBuffers = [];
      const { data } = e;

      if (data !== "Done") {
        console.log(`Data chunk received!`);
        rBuffers.push(data);
      } else {
        this.selfData.push(rBuffers);
      }
    };
    receiveChannel.onopen = (e) => console.log(`Data channel open on ${this.type} machine.`);
    receiveChannel.onclose = (e) => this.onCloseReceiver();

    this.connection.channel = receiveChannel;
  };
}

  /**
 * Sets the offer description for WebRTC.
 * @param {*} offer - The offer.
 */
setOfferDescription(offer) {
  this.connection
    .setRemoteDescription(offer)
    .then(() => console.log(`Offer set up and connection done.`));
}

  /**
 * Creates the offer description for WebRTC.
 */
createOfferDescription() {
  this.connection
    .createOffer()
    .then((offer) => this.connection.setLocalDescription(offer));
}

  /**
 * Creates the answer for WebRTC.
 */
async createAnswer() {
  await this.connection.createAnswer().then((answer) =>
    this.connection.setLocalDescription(answer).then(() =>
      console.log(JSON.stringify(this.connection.localDescription))
    )
  );
}

  /**
 * Sends data through WebRTC.
 * @param {*} data - The data to send.
 */
sendData(data) {
  if (this.type === "host") {
    this.dataChannel.send(data);
  } else {
    this.connection.channel.send(data);
  }
}

  /**
 * Submits an array of data through WebRTC.
 * @param {*} data - The array of data to submit.
 */
submitArray(data) {
  const arrayBuffer = data.buffer;

  for (let i = 0; i < arrayBuffer.byteLength; i += this.MAX_MESSAGE_SIZE) {
    this.sendData(arrayBuffer.slice(i, i + this.MAX_MESSAGE_SIZE));
  }

  this.sendData("Done");
}

/**
 * Opens the connection for WebRTC.
 * @param {*} answer - The answer.
 */
openConnection(answer) {
  this.connection.setRemoteDescription(answer).
  then(a => console.log(`Connection openned.`))
}

/**
 * Restarts the data channel from a host with an already RTC connection.
 */
restartDataChannel(){
  this.setDataChannel()
}

/**
 * Handles the event when the data channel is closed on the receiver machine.
 */
oncloseReceiver() {
  console.log(`Data channel closed on receiver machine.`);
  // Reopen the data channel
  this.restartDataChannel();
}

/**
 * Handles the event when the data channel is closed on the host machine.
 */
oncloseHost() {
  console.log(`Data channel closed on host machine.`);
  // Reopen the data channel
  this.restartDataChannel();
} 
}
