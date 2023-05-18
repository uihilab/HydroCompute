## WebRTC Engine
### Introduction
This class provides an interface for using WebRTC (Web Real-Time Communication) to send and receive data between peers in real-time. It uses the RTCPeerConnection API to establish a direct communication channel between peers.

### Set Up
Initialize a `hydrocompute` instance and set the engine as webrtc like follows:
```javascript
const compute = new hydrocompute('webrtc')
```
The constructor method initializes the WebRTC engine and sets up the RTCPeerConnection.

### Usage
The `run()` method is the entry point for using the WebRTC engine. It takes an optional parameter that can be used to pass the answer description from the receiver to the host. If no answer is provided, an error message will be logged.

The `sendData()` method is used to send data between peers. It takes an array of typed arrays (Uint8 or Float32s) and breaks them into smaller chunks to be sent through the data channel. It then triggers the aggregation of the chunks on the receiving end.

The `sendData()` method can also be used to send data directly through the data channel.

### Best Practices
When using the WebRTC engine, it is recommended to follow these best practices:

* Always set up the data channel before sending or receiving data.
* Use the submitArray() method to send large amounts of data.
* Handle connection events to properly close and restart data channels.

### Contribution and Support
Contributing to the WebRTC engine can be done in the following ways:

* Create an issue to submit a feature request or update.
* Create tailor methods for the WebRTC engine, following the structure described above, and share it through forks and by submitting a pull request. Before submitting, please ensure that the changes pass unit tests and adhere to the project's code style guidelines.
If you encounter any issues while using the engine, please submit an issue on the project's GitHub page. The team will do their best to resolve it as soon as possible.
