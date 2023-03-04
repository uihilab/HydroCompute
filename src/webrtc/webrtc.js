/**
 * 
 *
 */
export default class webrtc {
  constructor(){
    this.initialize()
  }
  initialize() {
    this.MAX_MESSAGE_SIZE = 65535; 
    this.connectionTime = undefined;
    this.candidates = undefined;
    this.dataChannel = undefined;
    //this can either be the host channel or the receiver.
    this.type = "host";
    this.results = [];
    this.selfData = [];
    this.connection = new RTCPeerConnection();
    //initializing connection
    console.log(`WebRTC engine initialized. Initial connection: host/request.`);
  }

  /**
   *
   */
  run(res) {
    this.type === "host" ? 
    (() => {
        this.setDataChannel();
        this.setConnection()
        this.candidates();
        this.creatingOfferdescription()
        //initialize the connection with answer response
        if (res) this.openConnection(res)
        else console.error(`Please input the answer of the response machine.`)
    })()
    :
    ((res) => {
        this.setConnection()
        this.onAvailableChannel();
        if (res) {
            //set offer and create answer based on response
            this.settingOfferDescription(res);
            this.createAnswer()
        }
        else console.error(`Please set the ICE from the main machine.`)
    })(res)
  }

  /**
   *
   */
  setConnection() {
    this.candidates = this.connection.onicecandidate = e => {
      console.log("New ice candidate. Local conection in console.");
      console.log(JSON.stringify(this.connection.localDescription));
    };
  }

  /**
   *
   */
  setDataChannel() {
    this.dataChannel = this.connection.createDataChannel("dataChannel");
    //Same as above, this might need change
    this.dataChannel.binaryType = "arraybuffer";
    this.dataChannel.onmessage = e => console.log(`Data received: ${e.data}`);
    this.dataChannel.onopen = e => console.log(`Data channel open on ${this.type} machine.`);
    this.dataChannel.onclose = e => console.log(`Data channel closed.`);
  }

  /**
   *
   */
  onAvailableChannel() {
    this.connection.ondatachannel = e => {
      const receiveChannel = e.channel;
      //Might need to change this according to future changes
      receiveChannel.binaryType = "arraybuffer";
      receiveChannel.onmessage = async e => {
        let rBuffers = []
        const { data } = e
        //waits for all the chunks to arrive
        if (data !== 'Done'){
        console.log(`Data chunk received!`);
        rBuffers.push(data)
      }
      //triggers the aggregation
      else {
        // const buff = rBuffers.reduce((acc, buff) => {
        //   const tmp = new Float32Array(acc.byteLength + buff.byteLength);
        //   tmp.set(new Float32Array(acc), 0);
        //   tmp.set(new Float32Array(buff), acc.byteLength);
        //   return tmp;
        // },
        // new Float32Array());
        this.selfData.push(rBuffers)
      }
      };
      receiveChannel.onopen = e => console.log(`Data channel open on ${this.type} machine.`);
      receiveChannel.onclose = e => console.log(`Data channel closed.`);
      this.connection.channel = receiveChannel;
    };
  }

  /**
   *
   */
  settingOfferDescription(offer) {
    this.connection
      .setRemoteDescription(offer)
      .then(a => console.log(`Offer set up and connection done.`));
  }

  /**
   *
   */
  creatingOfferdescription() {
    this.connection
      .createOffer()
      .then((o) => this.connection.setLocalDescription(o));
  }

  /**
   *
   */
  async createAnswer() {
    await this.connection
      .createAnswer()
      .then(a =>
        this.connection
          .setLocalDescription(a)
          .then((a) =>
            console.log(JSON.stringify(this.connection.localDescription))
          )
      );
  }

  /**
   * 
   * @param {*} data 
   */
  sendData(data) {
    this.type === "host" ? 
    this.dataChannel.send(data)
    :
    this.connection.channel.send(data)    
  }

  /**
   * 
   * @param {Object[]} data - Transformed typed array (Uint8 or Float32s)
   */

  submitArray(data){
    const arrayBuffer = data.buffer
    for (let i = 0; i < arrayBuffer.byteLength; i += this.MAX_MESSAGE_SIZE){
      this.sendData(arrayBuffer.slice(i, i+this.MAX_MESSAGE_SIZE))
    }
    this.sendData("Done")
  }

  /**
   * 
   */
  openConnection(answer) {
    this.connection.setRemoteDescription(answer).
    then(a => console.log(`Connection openned.`))
  }

  /**
   * Restarts a the data channel from a host with an already
   * RTC connection.
   */

  restartDataChannel(){
    this.setDataChannel()
  }

  oncloseReceiver(){}

  oncloseHost(){}
}
