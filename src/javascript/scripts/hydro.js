import * as datasources from "../../../hydrolang/modules/data/datasources.js";

export const hydro = {
  retrieve: async ({ params, args, data } = {}) => {
    await import('./domparser.js');
    //obtain data from parameters set by user.
    var source = params["source"],
      dataType = params["datatype"],
      args = args,
      result = [],
      //if source exists, then obtain the object from sources.
      dataSource = datasources[source][dataType],
      endpoint,
      met = dataSource["methods"]["method"],
      type,
      //define proxy if required by the source
      proxy = "",
      proxif = datasources[source]["requirements"]["needProxy"];

    //verify if the data is contained within the hydrolang databases.
    if (
      !(datasources[source] && datasources[source].hasOwnProperty(dataType))
    ) {
      alert("No data has been found for given specifications.");
      return;
    }

    //Change the type of endpoint based on the request. In the future for SOAP requests, new sources will be added to the if statement.
    source === "waterOneFlow" || source === "hisCentral"
      ? (endpoint = datasources[source]["sourceType"](args["sourceType"]))
      : (endpoint = dataSource["endpoint"]);
    //Grab the default parameter specified within the datasource type
    (() =>
      params["type"] === undefined
        ? (type = dataSource["methods"]["type"])
        : (type = params["type"]))();

    //Allowing the proxy server that is continously working to be called and used whenever it is required.
    if (proxif)
      (() =>
        params.hasOwnProperty("proxyServer")
          ? (proxy = datasources.proxies[params["proxyServer"]]["endpoint"])
          : //this considering that a local proxy server is in charge.
            (proxy = datasources.proxies["local-proxy"]["endpoint"]))();

    //create headers if required depending on the type supported.
    var head = {
      "content-type": (() => {
        if (type === "json") {
          return "application/json";
        } else if (type === "xml" || type === "soap") {
          return "text/xml; charset=utf-8";
        } else if (type === "csv" || type === "tab") {
          return "application/text";
        }
      })(),
    };
    //Add an additonal header to the request in case the request is SOAP type
    type === "soap"
      ? (head["SOAPAction"] = datasources[source]["action"] + dataType)
      : null;

    //Additiona keyname in case it is required by the resource
    var keyname = "";

    //assign key or token to value in case it is required by the source.
    if (datasources[source]["requirements"].hasOwnProperty("keyname")) {
      keyname = datasources[source]["requirements"]["keyname"];
      if (params.hasOwnProperty(keyname)) {
        Object.assign(head, { [keyname]: params[keyname] });
      } else {
        alert("info: please verify the keyname of the source.");
      }
    }

    //Change the data request type depending on the type of request (GET, POST)
    if (met === "POST" && type === "json") args = JSON.stringify(args);
    if (met === "POST" && (type === "soap" || type === "xml"))
      args = (() => {
        var val = Object.values(args),
          env =
            val.length != 0
              ? datasources.envelope(dataSource["body"](args))
              : datasources.envelope(dataSource["body"]());
        return env;
      })();

    //retrieve the data and feed the data into callback.
    var xhr = new XMLHttpRequest();
    xhr.open(met, proxy + endpoint);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
        var data = JSON.parse(this.responseText);
        if (type === "soap") result.push(data.responseText);
        else if (type === "xml" || type === "tab" || type === "CSV")
          result.push(JSON.stringify(data));
        else result.push(lowercasing(data));
      } else if (this.status >= 400) {
        if (type === "soap" || type === "xml") {
          var xmlDoc = new DOMParser().parseFromString(
            xhr.responseText,
            "application/xml"
          );
          var j = xml2json(xmlDoc);
          type === "soap"
            ? result.push(j["soap:Envelope"]["soap:Body"])
            : result.push(j);
          return result;
        } else {
          alert(
            `There was an error with the request. Please revise requirements.`
          );
        }
      }
    };
    xhr.send(args);

    return result;
  },
  //Function that runs the configuration
  dataRetrieve: async (d) => {
    let genConfig = {
      source: "waterOneFlow",
      datatype: "GetValuesObject",
      proxyServer: "local-proxy",
    };

    let dataMod = await hydro.retrieve({
      params: genConfig,
      args: {
        sourceType: d.source,
        location: d.location,
        variable: d.variable,
        startDate: d.starteDate,
        endDate: d.endDate,
      },
    });
    return dataMod;
  },
  main: (name, data) => {
    if (typeof hydro[name] === "undefined") {
      return console.error("Function is not found in the given script.");
    } else {
      return hydro[name](data);
    }
  },
};

const xml2json = (xml) => {
  try {
    var obj = {};
    if (xml.children.length > 0) {
      for (var i = 0; i < xml.children.length; i++) {
        var item = xml.children.item(i),
          nodeName = item.nodeName;

        if (typeof obj[nodeName] == "undefined") {
          obj[nodeName] = xml2json(item);
        } else {
          if (typeof obj[nodeName].push == "undefined") {
            var old = obj[nodeName];

            obj[nodeName] = [];
            obj[nodeName].push(old);
          }
          obj[nodeName].push(xml2json(item));
        }
      }
    } else {
      obj = xml.textContent;
    }
    return obj;
  } catch (e) {
    console.log(e.message);
  }
}
