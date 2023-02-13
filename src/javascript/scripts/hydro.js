import Hydrolang from "../../../hydrolang/hydro.js";

let hydrolang = new Hydrolang();

export const hydro = {
  dataRetrieve: async (d) => {
    let genConfig = {
      source: "waterOneFlow",
      datatype: "GetValuesObject",
      proxyServer: "local-proxy",
    };

    let dataMod = await hydrolang.data.retrieve({
      params: genConfig,
      args: {
        sourceType: d.source,
        location: d.location,
        variable: d.variable,
        startDate: d.starteDate,
        endDate: d.endDate,
      },
    });
    console.log(await dataMod)
    return dataMod
  },
  main: (name, data) => {
    if (typeof hydro[name] === "undefined") {
      return console.error("Function is not found in the given script.");
    } else {
      return hydro[name](data);
    }
  },
};
