/**
 * WebRTC engine class. Implements a data P2P service that can be used through the HydroCompute library.
 *
 * @class WebRTC
 * @description WebRTC engine class. Implements a data P2P service that can be used through the HydroCompute library.
 * @property {number} MAX_MESSAGE_SIZE - Maximum size of a WebRTC message.
 * @property {undefined|number} connectionTime - Time when the connection was established.
 * @property {undefined|Array} candidates - Array of candidates for establishing the connection.
 * @property {undefined|RTCPeerConnection} connection - RTCPeerConnection instance.
 * @property {undefined|RTCDataChannel} dataChannel - RTCDataChannel instance.
 * @property {string} type - Type of the WebRTC connection.
 * @property {Array} results - Array to store results.
 * @property {Array} selfData - Array to store self data.
 */
export default class WebRTC {
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
 * @memberof WebRTC
 */
initialize() {
  this.setConnection();
  this.setDataChannel();

  console.log(`WebRTC engine initialized. Initial connection: host/request.`);
}

  /**
 * Runs the WebRTC engine.
 * @memberof WebRTC
 * @param {Object} res - The response.
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
 * @memberof WebRTC
 */
setConnection() {
  this.candidates = this.connection.onicecandidate = (e) => {
    console.log("New ice candidate. Local connection in console.");
    console.log(JSON.stringify(this.connection.localDescription));
  };
}

   /**
 * Sets the a data channel connection for data transfer and receiving.
 * @memberof WebRTC
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
 * @memberof WebRTC
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
 * @memberof WebRTC
 */
setOfferDescription(offer) {
  this.connection
    .setRemoteDescription(offer)
    .then(() => console.log(`Offer set up and connection done.`));
}

  /**
 * Creates the offer description for WebRTC.
 * @memberof WebRTC
 */
createOfferDescription() {
  this.connection
    .createOffer()
    .then((offer) => this.connection.setLocalDescription(offer));
}

  /**
 * Creates the answer for WebRTC.
 * @memberof WebRTC
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
 * @param {Object} data - The data to send.
 * @memberof WebRTC
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
 * @param {Object} data - The array of data to submit.
 * @memberof WebRTC
 */
submitArray(data) {
  const arrayBuffer = data.buffer;

  for (let i = 0; i < arrayBuffer.byteLength; i += this.MAX_MESSAGE_SIZE) {
    this.sendData(arrayBuffer.slice(i, i + this.MAX_MESSAGE_SIZE));
  }

  this.sendData("Done");
}

/**
 * Opens the connection between two peers.
 * @param {String} answer - The answer.
 * @memberof WebRTC
 */
openConnection(answer) {
  this.connection.setRemoteDescription(answer).
  then(a => console.log(`Connection openned.`))
}

/**
 * Restarts the data channel from a host with an already RTC connection.
 * @memberof WebRTC
 */
restartDataChannel(){
  this.setDataChannel()
}

/**
 * Handles the event when the data channel is closed on the receiver machine.
 * @memberof WebRTC
 */
oncloseReceiver() {
  console.log(`Data channel closed on receiver machine.`);
  // Reopen the data channel
  this.restartDataChannel();
}

/**
 * Handles the event when the data channel is closed on the host machine.
 * @memberof WebRTC
 */
oncloseHost() {
  console.log(`Data channel closed on host machine.`);
  // Reopen the data channel
  this.restartDataChannel();
} 
}
