
export default class workers{
    constructor(){
        this.worker;
    }
    
    static initialize() {
        window.Worker ? this.worker = new Worker("./workers/worker.js") : console.error("Web workers API not supported!")
        console.log("Web workers scripts called!!")

    }


    static digestData(...args){
        var results = []
        this.worker.postMessage(args);
        console.log("Message posted to worker")
        this.worker.onmessage = e => {
                console.log(`Result pushed into resuts.`);
                results.push(e.data)
    }
    return results

}

    static showData(){
        return this.results
    }
}