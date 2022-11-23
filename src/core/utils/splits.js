import { ValueErr, NotImplemented } from "./errors.js";
//Different types of data splits can be added into this section.

/**
 * @namespace splits
 */

export const splits = {
  //specific split function based on what the user requires
  bySize: (args) => {
    var d = args.data;
    var size = args.size;
    var container = [];
    if (d[0].length % size != 0) {
      throw new ValueErr(
        `The data cannot be partitioned given the size ${size}. Please input a size according to your data.`
      );
    }
    d.forEach((arr) => {
      var r = [];
      for (let i = size; i > 0; i--) {
        r.push(arr.splice(0, Math.ceil(arr.length / i)));
      }
      container.push(r);
    });
    console.log(`Data has been partitioned into ${size} parts.`);
    return container;
  },

  //Main function to run any of the functions described in the object.
  main: (name, data) => {
    if (typeof splits[name] === "undefined") {
      throw new NotImplemented(`Function is not found in the given script.`);
    } else {
      return splits[name](data);
    }
  },
};
